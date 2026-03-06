-- 0014_payroll_runs.sql
-- Adds reproducible payroll runs + line items + optional entry snapshots.

begin;

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,

  period_start date not null,
  period_end date not null,

  status text not null default 'closed', -- closed | voided
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  locked_pay_period_id uuid references public.pay_periods(id) on delete set null,

  total_hours numeric not null default 0,
  total_amount numeric not null default 0,

  currency text not null default 'USD',
  notes text
);

create unique index if not exists payroll_runs_org_period_uniq
  on public.payroll_runs(org_id, period_start, period_end)
  where status <> 'voided';

alter table public.payroll_runs enable row level security;

create table if not exists public.payroll_run_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,

  contractor_id uuid not null references public.profiles(id) on delete restrict,
  contractor_name_snapshot text,
  hourly_rate_snapshot numeric not null default 0,

  hours numeric not null default 0,
  amount numeric not null default 0,

  created_at timestamptz not null default now(),

  unique(payroll_run_id, contractor_id)
);

alter table public.payroll_run_lines enable row level security;

create table if not exists public.payroll_run_entries (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete restrict,

  contractor_id uuid not null,
  contractor_name_snapshot text,
  project_id uuid,
  project_name_snapshot text,
  entry_date date not null,
  hours numeric not null default 0,
  hourly_rate_snapshot numeric not null default 0,
  amount numeric not null default 0,

  created_at timestamptz not null default now(),

  unique(payroll_run_id, time_entry_id)
);

alter table public.payroll_run_entries enable row level security;

commit;
