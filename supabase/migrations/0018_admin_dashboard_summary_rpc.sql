-- 0018_admin_dashboard_summary_rpc.sql
-- Server-side aggregation for admin dashboard KPIs

begin;

create or replace function public.admin_dashboard_summary(
  p_period_start date,
  p_period_end date
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_org uuid;
  v_role text;
  v_total_hours numeric;
  v_total_amount numeric;
  v_pending_count bigint;
  v_active_contractors bigint;
begin
  v_org := public.current_org_id();
  v_role := public.current_role();

  if v_org is null then
    raise exception 'No org context';
  end if;

  if v_role <> 'admin' then
    raise exception 'Admin only';
  end if;

  select
    coalesce(sum(v.hours_worked), 0),
    coalesce(sum(v.hours_worked * coalesce(te.hourly_rate_snapshot, 0)), 0)
  into v_total_hours, v_total_amount
  from public.time_entries te
  join public.v_time_entries v on v.id = te.id
  where te.org_id = v_org
    and te.entry_date between p_period_start and p_period_end
    and te.status = 'approved';

  select
    count(*)
  into v_pending_count
  from public.time_entries te
  where te.org_id = v_org
    and te.entry_date between p_period_start and p_period_end
    and te.status <> 'approved';

  select
    count(*)
  into v_active_contractors
  from public.profiles p
  where p.org_id = v_org
    and p.role = 'contractor'
    and p.is_active = true;

  return jsonb_build_object(
    'total_hours', v_total_hours,
    'total_amount', v_total_amount,
    'pending_entries', v_pending_count,
    'active_contractors', v_active_contractors
  );
end;
$$;

revoke all on function public.admin_dashboard_summary(date, date) from public;
grant execute on function public.admin_dashboard_summary(date, date) to authenticated;

commit;
