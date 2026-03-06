-- 0016_payroll_close_rpc.sql
-- RPC: closes payroll for a date range by (1) validating approvals, (2) locking pay_periods,
-- (3) creating a payroll_run, (4) snapshotting run entries + per-contractor totals.

begin;

create or replace function public.close_payroll_period(
  p_period_start date,
  p_period_end date
) returns uuid
language plpgsql
security definer
as $$
declare
  v_org uuid;
  v_role text;
  v_user uuid;
  v_run_id uuid;
  v_pay_period_id uuid;
  v_has_unapproved boolean;
begin
  v_org := public.current_org_id();
  v_role := public.current_role();
  v_user := auth.uid();

  if v_org is null then
    raise exception 'No org context';
  end if;

  if v_role <> 'admin' then
    raise exception 'Admin only';
  end if;

  select exists (
    select 1
    from public.time_entries te
    where te.org_id = v_org
      and te.entry_date between p_period_start and p_period_end
      and te.status <> 'approved'
  ) into v_has_unapproved;

  if v_has_unapproved then
    raise exception 'Cannot close payroll: unapproved entries exist in this period';
  end if;

  insert into public.pay_periods(org_id, period_start, period_end, locked, locked_at, locked_by)
  values (v_org, p_period_start, p_period_end, true, now(), v_user)
  on conflict (org_id, period_start, period_end)
  do update set locked=true, locked_at=excluded.locked_at, locked_by=excluded.locked_by
  returning id into v_pay_period_id;

  insert into public.payroll_runs(org_id, period_start, period_end, created_by, locked_pay_period_id, status)
  values (v_org, p_period_start, p_period_end, v_user, v_pay_period_id, 'closed')
  on conflict (org_id, period_start, period_end)
  where status <> 'voided'
  do update set locked_pay_period_id = excluded.locked_pay_period_id
  returning id into v_run_id;

  delete from public.payroll_run_entries where payroll_run_id = v_run_id;
  delete from public.payroll_run_lines where payroll_run_id = v_run_id;

  insert into public.payroll_run_entries (
    payroll_run_id, org_id, time_entry_id,
    contractor_id, contractor_name_snapshot,
    project_id, project_name_snapshot, entry_date,
    hours, hourly_rate_snapshot, amount
  )
  select
    v_run_id,
    te.org_id,
    te.id,
    te.user_id,
    p.full_name,
    te.project_id,
    coalesce(te.project_name_snapshot, pr.name),
    te.entry_date,
    coalesce(v.hours_worked, 0),
    coalesce(te.hourly_rate_snapshot, 0),
    coalesce(v.hours_worked, 0) * coalesce(te.hourly_rate_snapshot, 0)
  from public.time_entries te
  join public.v_time_entries v on v.id = te.id
  left join public.profiles p on p.id = te.user_id
  left join public.projects pr on pr.id = te.project_id
  where te.org_id = v_org
    and te.entry_date between p_period_start and p_period_end
    and te.status = 'approved';

  insert into public.payroll_run_lines (
    payroll_run_id, org_id, contractor_id, contractor_name_snapshot,
    hourly_rate_snapshot, hours, amount
  )
  select
    v_run_id,
    v_org,
    e.contractor_id,
    max(e.contractor_name_snapshot),
    max(e.hourly_rate_snapshot),
    sum(e.hours),
    sum(e.amount)
  from public.payroll_run_entries e
  where e.payroll_run_id = v_run_id
  group by e.contractor_id;

  update public.payroll_runs r
  set
    total_hours = coalesce(x.h, 0),
    total_amount = coalesce(x.a, 0)
  from (
    select sum(hours) as h, sum(amount) as a
    from public.payroll_run_lines
    where payroll_run_id = v_run_id
  ) x
  where r.id = v_run_id;

  return v_run_id;
end;
$$;

revoke all on function public.close_payroll_period(date, date) from public;
grant execute on function public.close_payroll_period(date, date) to authenticated;

commit;
