"use client";

import { Suspense } from "react";
import RequireOnboarding from "../../components/auth/RequireOnboarding";
import AppShell from "../../components/layout/AppShell";
import ProjectsClient from "./projects-client";

function ProjectsLoading() {
  return (
    <AppShell title="Projects" subtitle="Create projects and manage access">
      <div className="card cardPad prShell">
        <div className="muted">Loading…</div>
      </div>
    </AppShell>
  );
}

export default function ProjectsPage() {
  return (
    <RequireOnboarding>
      <Suspense fallback={<ProjectsLoading />}>
        <ProjectsClient />
      </Suspense>
    </RequireOnboarding>
  );
}
