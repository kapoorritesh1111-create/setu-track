-- 0020_export_events.sql
-- Export receipts / audit trail for payroll exports.

begin;

create table if not exists public.export_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  run_id uuid null references public.payroll_runs(id) on delete set null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  actor_name_snapshot text null,

  -- High-level classification
  export_type text not null,          -- e.g. payroll_csv_summary, payroll_pdf_detail, payroll_client_bundle
  file_format text not null,          -- csv | pdf | zip
  scope text not null,                -- org | run | project
  project_id uuid null references public.projects(id) on delete set null,

  period_start date not null,
  period_end date not null,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.export_events enable row level security;

-- Read receipts: admin + manager can see org receipts.
do $$
begin
  if not exists (select 1 from pg_policies where tablename='export_events' and policyname='export_events_select_org_admin_manager') then
    create policy export_events_select_org_admin_manager
    on public.export_events
    for select
    using (
      org_id = public.current_org_id()
      and public.current_role() in ('admin','manager')
    );
  end if;
end $$;

-- Insert receipts: admin only, and actor_id must be the caller.
do $$
begin
  if not exists (select 1 from pg_policies where tablename='export_events' and policyname='export_events_insert_admin') then
    create policy export_events_insert_admin
    on public.export_events
    for insert
    with check (
      org_id = public.current_org_id()
      and public.current_role() = 'admin'
      and actor_id = auth.uid()
    );
  end if;
end $$;

-- No update/delete policies by design (immutable receipts).

create index if not exists export_events_org_created_at_idx
  on public.export_events (org_id, created_at desc);

create index if not exists export_events_run_created_at_idx
  on public.export_events (org_id, run_id, created_at desc);

create index if not exists export_events_project_created_at_idx
  on public.export_events (org_id, project_id, created_at desc);

commit;
