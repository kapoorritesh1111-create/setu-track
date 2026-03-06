-- 0013_fix_pay_periods_week_start.sql
-- Patch: 0012 references pay_periods.week_start but 0011 did not create it.

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pay_periods' and column_name='week_start'
  ) then
    alter table public.pay_periods add column week_start text;
  end if;

  -- Ensure nullable (matches 0012 intent)
  alter table public.pay_periods alter column week_start drop not null;
end $$;

commit;
