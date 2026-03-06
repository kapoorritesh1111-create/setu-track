-- 0015_payroll_rls.sql
-- RLS for payroll run tables (org-scoped read; admin full control)

begin;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='payroll_runs' and policyname='payroll_runs_select_org') then
    create policy payroll_runs_select_org
    on public.payroll_runs
    for select
    using (org_id = public.current_org_id());
  end if;

  if not exists (select 1 from pg_policies where tablename='payroll_runs' and policyname='payroll_runs_admin_all') then
    create policy payroll_runs_admin_all
    on public.payroll_runs
    for all
    using (public.current_role() = 'admin')
    with check (public.current_role() = 'admin');
  end if;
end $$;


do $$
begin
  if not exists (select 1 from pg_policies where tablename='payroll_run_lines' and policyname='payroll_run_lines_select_org') then
    create policy payroll_run_lines_select_org
    on public.payroll_run_lines
    for select
    using (org_id = public.current_org_id());
  end if;

  if not exists (select 1 from pg_policies where tablename='payroll_run_lines' and policyname='payroll_run_lines_admin_all') then
    create policy payroll_run_lines_admin_all
    on public.payroll_run_lines
    for all
    using (public.current_role() = 'admin')
    with check (public.current_role() = 'admin');
  end if;
end $$;


do $$
begin
  if not exists (select 1 from pg_policies where tablename='payroll_run_entries' and policyname='payroll_run_entries_select_org') then
    create policy payroll_run_entries_select_org
    on public.payroll_run_entries
    for select
    using (org_id = public.current_org_id());
  end if;

  if not exists (select 1 from pg_policies where tablename='payroll_run_entries' and policyname='payroll_run_entries_admin_all') then
    create policy payroll_run_entries_admin_all
    on public.payroll_run_entries
    for all
    using (public.current_role() = 'admin')
    with check (public.current_role() = 'admin');
  end if;
end $$;

commit;
