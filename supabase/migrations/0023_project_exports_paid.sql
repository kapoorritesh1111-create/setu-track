-- 0023_project_exports_paid.sql
-- Project-level export records with paid lifecycle (separate from immutable export_events receipts).

begin;

create table if not exists public.project_exports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  export_type text not null,          -- e.g. payroll_client_bundle
  period_start date not null,
  period_end date not null,

  payload_hash text not null,         -- hash of exported payload/manifest for diff tracking
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,

  -- Paid lifecycle
  is_paid boolean not null default false,
  paid_by uuid null references public.profiles(id) on delete set null,
  paid_at timestamptz null,
  paid_note text not null default ''
);

-- One logical export record per project + period + export_type (allow upsert)
create unique index if not exists project_exports_unique
  on public.project_exports (org_id, project_id, export_type, period_start, period_end);

alter table public.project_exports enable row level security;

-- Read: admin + manager can see project exports in their org
do $$
begin
  if not exists (select 1 from pg_policies where tablename='project_exports' and policyname='project_exports_select_org_admin_manager') then
    create policy project_exports_select_org_admin_manager
    on public.project_exports
    for select
    using (
      org_id = public.current_org_id()
      and public.current_role() in ('admin','manager')
    );
  end if;
end $$;

-- Insert: admin only, creator must be caller
do $$
begin
  if not exists (select 1 from pg_policies where tablename='project_exports' and policyname='project_exports_insert_admin') then
    create policy project_exports_insert_admin
    on public.project_exports
    for insert
    with check (
      org_id = public.current_org_id()
      and public.current_role() = 'admin'
      and created_by = auth.uid()
    );
  end if;
end $$;

-- Update (paid lifecycle): admin only
do $$
begin
  if not exists (select 1 from pg_policies where tablename='project_exports' and policyname='project_exports_update_admin') then
    create policy project_exports_update_admin
    on public.project_exports
    for update
    using (
      org_id = public.current_org_id()
      and public.current_role() = 'admin'
    )
    with check (
      org_id = public.current_org_id()
      and public.current_role() = 'admin'
    );
  end if;
end $$;

-- Link immutable receipts to a project export record
alter table public.export_events
  add column if not exists project_export_id uuid null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'export_events_project_export_id_fkey'
      and table_name = 'export_events'
  ) then
    alter table public.export_events
      add constraint export_events_project_export_id_fkey
      foreign key (project_export_id)
      references public.project_exports(id)
      on delete set null;
  end if;
end $$;

create index if not exists export_events_project_export_idx
  on public.export_events (org_id, project_export_id, created_at desc);

commit;
