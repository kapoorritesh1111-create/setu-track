-- 0011_pay_period_locking.sql
-- Adds pay period locking (close payroll) to prevent edits after a period is finalized.

begin;

create table if not exists public.pay_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  locked boolean not null default false,
  locked_at timestamptz,
  locked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(org_id, period_start, period_end)
);

alter table public.pay_periods enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pay_periods' and policyname='pay_periods_select_org') then
    create policy pay_periods_select_org
    on public.pay_periods
    for select
    using (org_id = public.current_org_id());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='pay_periods' and policyname='pay_periods_admin_all') then
    create policy pay_periods_admin_all
    on public.pay_periods
    for all
    using (public.current_role() = 'admin')
    with check (public.current_role() = 'admin');
  end if;
end $$;

-- Prevent updating or deleting time entries that belong to a locked pay period.
create or replace function public.prevent_edit_if_pay_period_locked()
returns trigger
language plpgsql
as $$
declare
  is_locked boolean;
begin
  select p.locked
  into is_locked
  from public.pay_periods p
  where p.org_id = old.org_id
    and old.entry_date between p.period_start and p.period_end
  order by p.period_start desc
  limit 1;

  if coalesce(is_locked, false) then
    raise exception 'This pay period is locked. Entries cannot be modified.';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_prevent_edit_locked_period on public.time_entries;

create trigger trg_prevent_edit_locked_period
before update or delete on public.time_entries
for each row
execute function public.prevent_edit_if_pay_period_locked();

commit;
