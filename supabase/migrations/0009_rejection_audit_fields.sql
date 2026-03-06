-- Week 1 / Milestone 3
-- Add rejection audit fields + rejection reason to time_entries
-- Update workflow trigger to stamp rejected_by / rejected_at

begin;

alter table public.time_entries
  add column if not exists rejected_by uuid,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'time_entries_rejected_by_fkey'
  ) then
    alter table public.time_entries
      add constraint time_entries_rejected_by_fkey
      foreign key (rejected_by) references public.profiles(id)
      on delete set null;
  end if;
end $$;

-- Extend workflow enforcement to include rejection stamps.
create or replace function public.enforce_time_entry_workflow()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $$
begin
  -- lock approved entries from user edits (only admin/manager allowed)
  if old.status = 'approved' and new.status = 'approved' then
    if public.current_role() not in ('admin','manager') then
      raise exception 'Approved entries are locked.';
    end if;
  end if;

  -- user can't approve/reject (only manager/admin)
  if public.current_role() not in ('admin','manager') then
    if new.status in ('approved','rejected') then
      raise exception 'Only manager/admin can approve or reject.';
    end if;
    if new.approved_by is not null or new.approved_at is not null then
      raise exception 'Only manager/admin can set approval fields.';
    end if;
    if new.rejected_by is not null or new.rejected_at is not null then
      raise exception 'Only manager/admin can set rejection fields.';
    end if;
  end if;

  -- manager/admin: approve stamps
  if public.current_role() in ('admin','manager') then
    if new.status = 'approved' and old.status = 'submitted' then
      new.approved_by := auth.uid();
      new.approved_at := now();
      -- clear rejection stamps
      new.rejected_by := null;
      new.rejected_at := null;
      new.rejection_reason := null;
    end if;

    -- reject stamps
    if new.status = 'rejected' and old.status = 'submitted' then
      new.rejected_by := auth.uid();
      new.rejected_at := now();
      -- clear approval stamps
      new.approved_by := null;
      new.approved_at := null;
    end if;

    -- if reverting to draft/submitted, clear stamps
    if new.status in ('draft','submitted') then
      new.approved_by := null;
      new.approved_at := null;
      new.rejected_by := null;
      new.rejected_at := null;
      new.rejection_reason := null;
    end if;
  end if;

  return new;
end;
$$;

commit;
