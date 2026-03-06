-- 0022_org_settings.sql
-- Organization branding + invoice settings (admin-managed)
-- NOTE: Keep SELECT open to org members for branding tokens.

create table if not exists public.org_settings (
  org_id uuid primary key references public.orgs(id) on delete cascade,
  company_name text not null default '',
  legal_name text not null default '',
  logo_url text null,

  -- Accept either a preset key (blue/indigo/emerald/rose/slate) OR a hex color (#RRGGBB)
  accent_color text not null default 'blue',

  -- Flexible header fields for invoices (address, tax id, phone, etc.)
  invoice_header_json jsonb not null default '{}'::jsonb,
  invoice_footer_text text not null default '',
  default_currency text not null default 'USD',

  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id)
);

alter table public.org_settings enable row level security;

-- Read: any org member can read (needed for branding tokens + invoice rendering)
drop policy if exists org_settings_select_org on public.org_settings;
create policy org_settings_select_org
on public.org_settings
for select
to authenticated
using (org_id = public.current_org_id());

-- Insert/Update: admin only
drop policy if exists org_settings_upsert_admin on public.org_settings;
create policy org_settings_upsert_admin
on public.org_settings
for insert
to authenticated
with check (public."current_role"() = 'admin' and org_id = public.current_org_id());

drop policy if exists org_settings_update_admin on public.org_settings;
create policy org_settings_update_admin
on public.org_settings
for update
to authenticated
using (public."current_role"() = 'admin' and org_id = public.current_org_id())
with check (public."current_role"() = 'admin' and org_id = public.current_org_id());

-- Optional: keep updated_at fresh
create or replace function public.touch_org_settings()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  if new.updated_by is null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_org_settings on public.org_settings;
create trigger trg_touch_org_settings
before insert or update on public.org_settings
for each row execute function public.touch_org_settings();
