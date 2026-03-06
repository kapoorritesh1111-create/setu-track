-- Constraints (PK/UK/FK/CHECK)
-- Apply after 0001_schema.sql
begin;

alter table public."orgs" add constraint "orgs_pkey" PRIMARY KEY (id);
alter table public."profiles" add constraint "profiles_role_check" CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'contractor'::text]));
alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."profiles" add constraint "profiles_manager_id_fkey" FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."profiles" add constraint "profiles_org_id_fkey" FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE SET NULL;
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."project_members" add constraint "project_members_org_id_fkey" FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;
alter table public."project_members" add constraint "project_members_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."project_members" add constraint "project_members_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
alter table public."project_members" add constraint "project_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."project_members" add constraint "project_members_pkey" PRIMARY KEY (project_id, user_id);
alter table public."project_members" add constraint "project_members_org_project_profile_uniq" UNIQUE (org_id, project_id, profile_id);
alter table public."projects" add constraint "projects_week_start_check" CHECK (week_start = ANY (ARRAY['sunday'::text, 'monday'::text]));
alter table public."projects" add constraint "projects_org_id_fkey" FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;
alter table public."projects" add constraint "projects_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES projects(id) ON DELETE SET NULL;
alter table public."projects" add constraint "projects_pkey" PRIMARY KEY (id);
alter table public."time_entries" add constraint "time_entries_lunch_hours_check" CHECK (lunch_hours >= 0::numeric);
alter table public."time_entries" add constraint "time_entries_mileage_check" CHECK (mileage IS NULL OR mileage >= 0::numeric);
alter table public."time_entries" add constraint "time_entries_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'locked'::text]));
alter table public."time_entries" add constraint "fk_time_entries_project" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT;
alter table public."time_entries" add constraint "time_entries_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."time_entries" add constraint "time_entries_org_id_fkey" FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;
alter table public."time_entries" add constraint "time_entries_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
alter table public."time_entries" add constraint "time_entries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public."time_entries" add constraint "time_entries_pkey" PRIMARY KEY (id);
alter table public.audit_log add constraint "audit_log_org_fk" foreign key (org_id) references public.orgs(id) on delete cascade;
alter table public.audit_log add constraint "audit_log_actor_fk" foreign key (actor_id) references public.profiles(id) on delete set null;
commit;
