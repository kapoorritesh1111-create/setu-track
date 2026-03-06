-- Phase 1 — Financial Integrity patch
-- Idempotent migration for EXISTING databases

begin;

-- 1) Add missing snapshot + lifecycle columns
alter table public.time_entries
  add column if not exists project_name_snapshot text,
  add column if not exists role_snapshot text,
  add column if not exists updated_by uuid;

-- FK for updated_by (safe + optional)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'time_entries_updated_by_fkey'
  ) then
    alter table public.time_entries
      add constraint time_entries_updated_by_fkey
      foreign key (updated_by) references public.profiles(id)
      on delete set null;
  end if;
end $$;

-- 2) Snapshot setter (populate on INSERT; also fills any missing values safely)
create or replace function public.set_time_entry_snapshots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Hourly rate + role snapshot from profiles
  if new.hourly_rate_snapshot is null or new.role_snapshot is null then
    select
      p.hourly_rate,
      p.role
    into
      new.hourly_rate_snapshot,
      new.role_snapshot
    from public.profiles p
    where p.id = new.user_id;
  end if;

  -- Project name snapshot from projects
  if new.project_name_snapshot is null then
    select pr.name
    into new.project_name_snapshot
    from public.projects pr
    where pr.id = new.project_id;
  end if;

  return new;
end;
$$;

-- 3) updated_by setter (tracks who changed the row)
create or replace function public.set_time_entry_updated_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

-- 4) Triggers
drop trigger if exists trg_time_entries_set_snapshots on public.time_entries;
create trigger trg_time_entries_set_snapshots
before insert on public.time_entries
for each row execute function public.set_time_entry_snapshots();

-- Replace the generic updated_at trigger for time_entries with updated_meta (updated_at + updated_by)
drop trigger if exists set_updated_at_time_entries on public.time_entries;
drop trigger if exists trg_time_entries_set_updated_meta on public.time_entries;

create trigger trg_time_entries_set_updated_meta
before update on public.time_entries
for each row execute function public.set_time_entry_updated_meta();

-- 5) Backfill existing rows (safe, only where missing)
update public.time_entries te
set
  hourly_rate_snapshot = coalesce(te.hourly_rate_snapshot, p.hourly_rate),
  role_snapshot = coalesce(te.role_snapshot, p.role)
from public.profiles p
where p.id = te.user_id
  and (te.hourly_rate_snapshot is null or te.role_snapshot is null);

update public.time_entries te
set project_name_snapshot = coalesce(te.project_name_snapshot, pr.name)
from public.projects pr
where pr.id = te.project_id
  and te.project_name_snapshot is null;

commit;
