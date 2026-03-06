"use client";

import RequireOnboarding from "../../components/auth/RequireOnboarding";
import AppShell from "../../components/layout/AppShell";
import PeopleDirectory from "../../components/people/PeopleDirectory";
import { useProfile } from "../../lib/useProfile";
import { useRouter } from "next/navigation";
import Button from "../../components/ui/Button";

export default function ProfilesPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";
  const isManager = profile?.role === "manager";

  return (
    <RequireOnboarding>
      <AppShell
        title="People"
        subtitle={
          isAdmin ? "Directory (org users)" : isManager ? "My team directory" : "My profile"
        }
      >
        <PeopleDirectory mode="people" />
      </AppShell>
    </RequireOnboarding>
  );
}
