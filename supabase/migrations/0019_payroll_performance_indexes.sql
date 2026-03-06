-- 0019_payroll_performance_indexes.sql
-- Performance indexes for dashboard + payroll exports

begin;

create index if not exists time_entries_org_date_idx
  on public.time_entries(org_id, entry_date);

create index if not exists time_entries_org_date_status_idx
  on public.time_entries(org_id, entry_date, status);

create index if not exists payroll_run_entries_run_contractor_idx
  on public.payroll_run_entries(payroll_run_id, contractor_id);

create index if not exists payroll_runs_org_period_idx
  on public.payroll_runs(org_id, period_start, period_end);

commit;
