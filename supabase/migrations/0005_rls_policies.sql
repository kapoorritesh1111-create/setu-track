-- =========================================================
-- RLS POLICIES (RE-CREATE WITH CORRECT SYNTAX)
-- Applies to: orgs, profiles, project_members, projects, time_entries
-- =========================================================

-- -------------------------
-- ORGS
-- -------------------------
DROP POLICY IF EXISTS orgs_select_own ON public.orgs;

CREATE POLICY orgs_select_own
ON public.orgs
FOR SELECT
TO authenticated
USING (id = public.current_org_id());


-- -------------------------
-- PROFILES
-- -------------------------
DROP POLICY IF EXISTS profiles_select_manager_reports ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_select_safe ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin_org ON public.profiles;
DROP POLICY IF EXISTS profiles_update_manager_team ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_select_manager_reports
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.current_role() = 'manager'
  AND org_id = public.current_org_id()
  AND manager_id = auth.uid()
);

CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY profiles_select_safe
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (id = auth.uid())
  OR (public.is_admin() AND (org_id = public.current_org_id()))
);

CREATE POLICY profiles_update_admin_org
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.current_role() = 'admin'
  AND org_id = public.current_org_id()
)
WITH CHECK (
  public.current_role() = 'admin'
  AND org_id = public.current_org_id()
);

CREATE POLICY profiles_update_manager_team
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (org_id = public.current_org_id())
  AND public.is_admin_or_manager()
  AND (
    public.current_role() = 'admin'
    OR manager_id = auth.uid()
  )
)
WITH CHECK (
  (org_id = public.current_org_id())
  AND public.is_admin_or_manager()
  AND (
    public.current_role() = 'admin'
    OR manager_id = auth.uid()
  )
);

CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());


-- -------------------------
-- PROJECT_MEMBERS
-- -------------------------
DROP POLICY IF EXISTS pm_admin_manager_delete ON public.project_members;
DROP POLICY IF EXISTS pm_admin_manager_write ON public.project_members;
DROP POLICY IF EXISTS pm_insert ON public.project_members;
DROP POLICY IF EXISTS pm_select ON public.project_members;
DROP POLICY IF EXISTS pm_update ON public.project_members;

CREATE POLICY pm_admin_manager_delete
ON public.project_members
FOR DELETE
TO authenticated
USING (
  (org_id = public.current_org_id())
  AND public.is_admin_or_manager()
);

CREATE POLICY pm_admin_manager_write
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id = public.current_org_id())
  AND public.is_admin_or_manager()
);

CREATE POLICY pm_insert
ON public.project_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  AND (org_id = public.current_org_id())
);

CREATE POLICY pm_select
ON public.project_members
FOR SELECT
TO authenticated
USING (
  (public.is_admin() AND (org_id = public.current_org_id()))
  OR (profile_id = auth.uid())
);

CREATE POLICY pm_update
ON public.project_members
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  AND (org_id = public.current_org_id())
)
WITH CHECK (
  public.is_admin()
  AND (org_id = public.current_org_id())
);


-- -------------------------
-- PROJECTS
-- -------------------------
DROP POLICY IF EXISTS projects_admin_delete ON public.projects;
DROP POLICY IF EXISTS projects_admin_manager_insert ON public.projects;
DROP POLICY IF EXISTS projects_admin_manager_update ON public.projects;
DROP POLICY IF EXISTS projects_select_org ON public.projects;
DROP POLICY IF EXISTS projects_update_admin_manager ON public.projects;

CREATE POLICY projects_admin_delete
ON public.projects
FOR DELETE
TO authenticated
USING (
  (org_id = public.current_org_id())
  AND (public.current_role() = 'admin')
);

CREATE POLICY projects_admin_manager_insert
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id = public.current_org_id())
  AND public.is_admin_or_manager()
);

CREATE POLICY projects_admin_manager_update
ON public.projects
FOR UPDATE
TO authenticated
USING (
  (org_id = public.current_org_id())
  AND public.is_admin_or_manager()
)
WITH CHECK (
  (org_id = public.current_org_id())
  AND public.is_admin_or_manager()
);

CREATE POLICY projects_select_org
ON public.projects
FOR SELECT
TO authenticated
USING (
  (org_id = public.current_org_id())
  AND (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = projects.id
        AND pm.user_id = auth.uid()
    )
  )
);

-- This policy came from your export; it uses subqueries into profiles.
-- For UPDATE policies, it is safer to include WITH CHECK.
CREATE POLICY projects_update_admin_manager
ON public.projects
FOR UPDATE
TO authenticated
USING (
  org_id = (
    SELECT profiles.org_id
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
  AND (
    SELECT profiles.role
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  ) = ANY (ARRAY['admin'::text, 'manager'::text])
)
WITH CHECK (
  org_id = (
    SELECT profiles.org_id
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  )
  AND (
    SELECT profiles.role
    FROM public.profiles
    WHERE profiles.id = auth.uid()
  ) = ANY (ARRAY['admin'::text, 'manager'::text])
);


-- -------------------------
-- TIME_ENTRIES
-- -------------------------
DROP POLICY IF EXISTS te_insert_own ON public.time_entries;
DROP POLICY IF EXISTS te_manager_approve ON public.time_entries;
DROP POLICY IF EXISTS te_select ON public.time_entries;
DROP POLICY IF EXISTS te_update_own_draft_rejected ON public.time_entries;

CREATE POLICY te_insert_own
ON public.time_entries
FOR INSERT
TO authenticated
WITH CHECK (
  (org_id = public.current_org_id())
  AND (user_id = auth.uid())
  AND (
    public.is_admin_or_manager()
    OR EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = time_entries.project_id
        AND pm.user_id = auth.uid()
    )
  )
);

CREATE POLICY te_manager_approve
ON public.time_entries
FOR UPDATE
TO authenticated
USING (
  (
    (public.current_role() = 'admin')
    AND (org_id = public.current_org_id())
  )
  OR
  (
    (public.current_role() = 'manager')
    AND (
      user_id IN (
        SELECT p.id
        FROM public.profiles p
        WHERE p.manager_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  (
    (public.current_role() = 'admin')
    AND (org_id = public.current_org_id())
  )
  OR
  (
    (public.current_role() = 'manager')
    AND (
      user_id IN (
        SELECT p.id
        FROM public.profiles p
        WHERE p.manager_id = auth.uid()
      )
    )
  )
);

CREATE POLICY te_select
ON public.time_entries
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid())
  OR ((public.current_role() = 'admin') AND (org_id = public.current_org_id()))
  OR (
    (public.current_role() = 'manager')
    AND (
      user_id IN (
        SELECT p.id
        FROM public.profiles p
        WHERE p.manager_id = auth.uid()
      )
    )
  )
);

CREATE POLICY te_update_own_draft_rejected
ON public.time_entries
FOR UPDATE
TO authenticated
USING (
  (org_id = public.current_org_id())
  AND (user_id = auth.uid())
  AND (status = ANY (ARRAY['draft'::text, 'rejected'::text]))
)
WITH CHECK (
  (org_id = public.current_org_id())
  AND (user_id = auth.uid())
  AND (status = ANY (ARRAY['draft'::text, 'rejected'::text, 'submitted'::text]))
  AND EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.org_id = time_entries.org_id
      AND pm.project_id = time_entries.project_id
      AND pm.user_id = auth.uid()
  )
);
