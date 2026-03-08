"use client";

import RequireOnboarding from "../../components/auth/RequireOnboarding";
import AppShell from "../../components/layout/AppShell";
import PeopleDirectory from "../../components/people/PeopleDirectory";

export default function ProfilesPage() {
  return (
    <RequireOnboarding>
      <AppShell
        title="People"
        subtitle="Directory, rates, managers, and access visibility"
      >
        <PeopleDirectory mode="people" />
      </AppShell>
    </RequireOnboarding>
  );
}
