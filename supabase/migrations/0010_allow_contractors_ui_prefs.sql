create or replace function public.guard_profiles_update()
 returns trigger
 language plpgsql
as $function$
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

  -- Contractor: only self, and only limited fields INCLUDING ui_prefs
  if actor_role = 'contractor' then
    if new.id <> auth.uid() then
      raise exception 'Contractors can only update their own profile.';
    end if;

    -- Block changes to protected fields
    if new.org_id is distinct from old.org_id
      or new.role is distinct from old.role
      or new.hourly_rate is distinct from old.hourly_rate
      or new.is_active is distinct from old.is_active
      or new.manager_id is distinct from old.manager_id
      or new.full_name is distinct from old.full_name
    then
      raise exception 'You can only update phone, address, picture, and appearance.';
    end if;

    -- ✅ Allowed: phone, address, avatar_url, ui_prefs
    return new;
  end if;

  raise exception 'Unauthorized profile update.';
end;
$function$;
