-- 0012_payroll_hardening.sql
-- Purpose:
-- 1) Make pay periods robust (week_start nullable + uniqueness)
-- 2) Make pay period locking airtight (block INSERT/UPDATE/DELETE into locked ranges)
-- 3) Make payroll exports reproducible (prefer project_name_snapshot in v_time_entries)

begin;

-----------------------------------------------------------------------
-- 1) PAY PERIODS: week_start mismatch + duplicates + uniqueness
-----------------------------------------------------------------------

-- Allow API contract to be period_start/period_end without needing week_start.
-- (If your code wants week_start for weekly periods, it can still populate it.)
alter table public.pay_periods
  alter column week_start drop not null;

-- Optional sanity check: period_end >= period_start (safe if not already present).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pay_periods_period_range_chk'
      and conrelid = 'public.pay_periods'::regclass
  ) then
    alter table public.pay_periods
      add constraint pay_periods_period_range_chk
      check (period_end >= period_start);
  end if;
end $$;

-- Dedupe any existing pay_period rows before adding unique index.
-- Keep the "best" row per (org_id, period_start, period_end):
--   prefer locked=true, then newest locked_at, then newest created_at.
with ranked as (
  select
    ctid,
    row_number() over (
      partition by org_id, period_start, period_end
      order by locked desc,
               locked_at desc nulls last,
               created_at desc nulls last
    ) as rn
  from public.pay_periods
)
delete from public.pay_periods p
using ranked r
where p.ctid = r.ctid
  and r.rn > 1;

-- Add uniqueness so status/lock lookups are deterministic and upserts are safe.
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'pay_periods_org_period_uniq'
  ) then
    create unique index pay_periods_org_period_uniq
      on public.pay_periods (org_id, period_start, period_end);
  end if;
end $$;

-----------------------------------------------------------------------
-- 2) LOCK ENFORCEMENT: Block INSERT/UPDATE/DELETE inside locked periods
-----------------------------------------------------------------------

-- A single trigger function that blocks mutation of time_entries that fall
-- within any locked pay period for the same org.
create or replace function public.prevent_time_entry_mutation_in_locked_period()
returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
  v_entry_date date;
  v_locked boolean;
begin
  if (tg_op = 'DELETE') then
    v_org_id := old.org_id;
    v_entry_date := old.entry_date;
  else
    v_org_id := new.org_id;
    v_entry_date := new.entry_date;
  end if;

  -- If either is null, be permissive (shouldn't happen with NOT NULL cols).
  if v_org_id is null or v_entry_date is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select exists (
    select 1
    from public.pay_periods pp
    where pp.org_id = v_org_id
      and pp.locked = true
      and v_entry_date between pp.period_start and pp.period_end
  ) into v_locked;

  if v_locked then
    raise exception 'Pay period is locked for this date range. Changes are not allowed.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Replace any previous locking triggers cleanly (idempotent).
drop trigger if exists trg_prevent_edit_locked_period on public.time_entries;

-- Create a single trigger that covers INSERT/UPDATE/DELETE.
create trigger trg_prevent_mutation_locked_period
before insert or update or delete on public.time_entries
for each row
execute function public.prevent_time_entry_mutation_in_locked_period();

-----------------------------------------------------------------------
-- 3) VIEW HARDENING: Prefer snapshot project name for reproducible exports
-----------------------------------------------------------------------

create or replace view public.v_time_entries as
select
  te.id,
  te.org_id,
  te.user_id,
  te.entry_date,
  te.time_in,
  te.time_out,
  te.lunch_hours,
  te.project_id,
  te.notes,
  te.mileage,
  te.status,
  te.approved_by,
  te.approved_at,
  te.created_at,
  te.updated_at,
  te.hourly_rate_snapshot,
  p.full_name,
  coalesce(te.project_name_snapshot, pr.name) as project_name,
  case
    when te.time_in is null or te.time_out is null then null::numeric
    else greatest(
      (extract(epoch from (te.time_out - te.time_in)) / 3600.0)
      - coalesce(te.lunch_hours, 0::numeric),
      0::numeric
    )
  end as hours_worked
from public.time_entries te
left join public.profiles p on p.id = te.user_id
left join public.projects pr on pr.id = te.project_id;

commit;
