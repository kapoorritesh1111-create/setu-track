-- Schema (tables) for Timesheet
-- Apply on a NEW database. For existing db, use diff/patch.
begin;

create table if not exists public."orgs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

create table if not exists public."profiles" (
  "id" uuid NOT NULL,
  "org_id" uuid,
  "full_name" text,
  "role" text DEFAULT 'contractor'::text NOT NULL,
  "hourly_rate" numeric DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "manager_id" uuid,
  "phone" text,
  "address" text,
  "avatar_url" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "onboarding_completed_at" timestamp with time zone,
  "ui_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL
);

create table if not exists public."project_members" (
  "org_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "profile_id" uuid NOT NULL,
  "id" uuid DEFAULT gen_random_uuid() NOT NULL
);

create table if not exists public."projects" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "name" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "parent_id" uuid,
  "week_start" text DEFAULT 'sunday'::text NOT NULL
);

create table if not exists public."time_entries" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "entry_date" date NOT NULL,
  "time_in" time without time zone,
  "time_out" time without time zone,
  "lunch_hours" numeric DEFAULT 0 NOT NULL,
  "project_id" uuid NOT NULL,
  "notes" text,
  "mileage" numeric,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "approved_by" uuid,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "hourly_rate_snapshot" numeric
);


-- Audit log (added for production readiness)
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  before jsonb,
  after jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

commit;
