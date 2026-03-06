-- 0021_payroll_runs_paid.sql
-- Phase 2.6: add "Paid" lifecycle to payroll runs (admin-marked), to support stage timeline.
-- Safe additive change.

alter table public.payroll_runs
  add column if not exists paid_at timestamptz null,
  add column if not exists paid_by uuid null,
  add column if not exists paid_note text null;

create index if not exists payroll_runs_paid_at_idx on public.payroll_runs (paid_at);

-- Ensure paid_by references a profile id (best-effort; profiles table uses auth uid as PK).
-- We avoid a FK here because some installations may not want cross-schema FK constraints.

-- RPC: mark/unmark paid (security definer)
create or replace function public.mark_payroll_run_paid(p_run_id uuid, p_paid boolean, p_note text default null)
returns public.payroll_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_org uuid;
  v_run public.payroll_runs;
begin
  select role, org_id into v_role, v_org
  from public.profiles
  where id = auth.uid();

  if v_role is null then
    raise exception 'No profile';
  end if;

  if v_role <> 'admin' then
    raise exception 'Admin only';
  end if;

  select * into v_run
  from public.payroll_runs
  where id = p_run_id and org_id = v_org;

  if v_run.id is null then
    raise exception 'Payroll run not found';
  end if;

  if p_paid then
    update public.payroll_runs
      set paid_at = now(),
          paid_by = auth.uid(),
          paid_note = p_note
      where id = p_run_id and org_id = v_org
      returning * into v_run;
  else
    update public.payroll_runs
      set paid_at = null,
          paid_by = null,
          paid_note = null
      where id = p_run_id and org_id = v_org
      returning * into v_run;
  end if;

  return v_run;
end;
$$;

revoke all on function public.mark_payroll_run_paid(uuid, boolean, text) from public;
grant execute on function public.mark_payroll_run_paid(uuid, boolean, text) to authenticated;
