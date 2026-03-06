-- Functions
-- Apply after constraints if functions depend on tables

CREATE OR REPLACE FUNCTION public.current_org_id()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select org_id from public.profiles where id = auth.uid();
$function$

CREATE OR REPLACE FUNCTION public."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select role from public.profiles where id = auth.uid()
$function$

CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.profiles where id = auth.uid();
$function$

CREATE OR REPLACE FUNCTION public.enforce_time_entry_workflow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- lock approved entries from user edits (only admin/manager allowed by RLS + logic below)
  if old.status = 'approved' and new.status = 'approved' then
    -- allow only non-edit changes? safest is block edits entirely unless admin/manager
    if public.current_role() not in ('admin','manager') then
      raise exception 'Approved entries are locked.';
    end if;
  end if;

  -- user can't approve/reject (only manager/admin)
  if public.current_role() not in ('admin','manager') then
    if new.status in ('approved','rejected') then
      raise exception 'Only manager/admin can approve or reject.';
    end if;
    if new.approved_by is not null or new.approved_at is not null then
      raise exception 'Only manager/admin can set approval fields.';
    end if;
  end if;

  -- manager/admin: if approving, stamp fields
  if public.current_role() in ('admin','manager') then
    if new.status = 'approved' and old.status = 'submitted' then
      new.approved_by := auth.uid();
      new.approved_at := now();
    end if;

    -- if rejecting, clear approval stamp
    if new.status = 'rejected' then
      new.approved_by := null;
      new.approved_at := null;
    end if;
  end if;

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.ensure_snapshot_on_approve()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if (new.status = 'approved' and (old.status is distinct from new.status)) then
    if new.hourly_rate_snapshot is null then
      select p.hourly_rate
        into new.hourly_rate_snapshot
      from public.profiles p
      where p.id = new.user_id;
    end if;
  end if;

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.guard_profiles_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  actor_role text;
begin
  -- ✅ Allow server-side admin operations (service role) to bypass checks
  if auth.role() = 'service_role' then
    return new;
  end if;

  select p.role into actor_role
  from public.profiles p
  where p.id = auth.uid();

  -- Admin: allow everything
  if actor_role = 'admin' then
    return new;
  end if;

  -- Manager: can update self + profiles assigned to them (Model B)
  if actor_role = 'manager' then
    if new.id = auth.uid() then
      return new;
    end if;

    if old.manager_id = auth.uid() then
      return new;
    end if;

    raise exception 'Managers can only update profiles assigned to them.';
  end if;

  -- Contractor: only self, and only phone/address/avatar_url
  if actor_role = 'contractor' then
    if new.id <> auth.uid() then
      raise exception 'Contractors can only update their own profile.';
    end if;

    if new.org_id is distinct from old.org_id
      or new.role is distinct from old.role
      or new.hourly_rate is distinct from old.hourly_rate
      or new.is_active is distinct from old.is_active
      or new.manager_id is distinct from old.manager_id
      or new.full_name is distinct from old.full_name
    then
      raise exception 'You can only update phone, address, and picture.';
    end if;

    return new;
  end if;

  raise exception 'Unauthorized profile update.';
end;
$function$

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_org_id uuid;
begin
  select id into v_org_id from public.orgs where name='Timesheet Webapp' order by created_at asc limit 1;

  insert into public.profiles (id, org_id, full_name, role, hourly_rate)
  values (
    new.id,
    v_org_id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'contractor',
    0
  )
  on conflict (id) do nothing;

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$function$

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_role() in ('admin','manager');
$function$

CREATE OR REPLACE FUNCTION public.prevent_snapshot_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  -- Block snapshot edits unless admin/manager
  if (new.hourly_rate_snapshot is distinct from old.hourly_rate_snapshot)
     and (public.current_role() not in ('admin','manager')) then
    raise exception 'Not allowed to modify hourly_rate_snapshot';
  end if;

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
