-- 0005_project_pay_frequency.sql
-- Adds pay_frequency to projects to support Weekly / Bi-weekly / Monthly pay cycles per project.
-- Default is monthly.

alter table if exists public.projects
  add column if not exists pay_frequency text not null default 'monthly';

-- Optional: constrain to allowed values (uncomment if you want strict enforcement)
-- alter table public.projects
--   add constraint projects_pay_frequency_check
--   check (pay_frequency in ('weekly','biweekly','monthly'));
