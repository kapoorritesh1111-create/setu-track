-- 0017_payroll_preview_rpc.sql
-- Preview blockers for closing payroll (admin UX helper)

begin;

create or replace function public.payroll_close_blockers(
  p_period_start date,
  p_period_end date
) returns table (
  contractor_id uuid,
  contractor_name text,
  status text,
  entries_count bigint,
  hours numeric,
  amount numeric
)
language sql
security definer
as $$
  select
    te.user_id as contractor_id,
    coalesce(p.full_name, 'Unknown') as contractor_name,
    te.status::text as status,
    count(*) as entries_count,
    coalesce(sum(v.hours_worked), 0) as hours,
    coalesce(sum(v.hours_worked * coalesce(te.hourly_rate_snapshot, 0)), 0) as amount
  from public.time_entries te
  join public.v_time_entries v on v.id = te.id
  left join public.profiles p on p.id = te.user_id
  where te.org_id = public.current_org_id()
    and te.entry_date between p_period_start and p_period_end
    and te.status <> 'approved'
  group by te.user_id, p.full_name, te.status
  order by contractor_name asc, status asc;
$$;

revoke all on function public.payroll_close_blockers(date, date) from public;
grant execute on function public.payroll_close_blockers(date, date) to authenticated;

commit;
