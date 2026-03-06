// src/app/dashboard/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import RequireOnboarding from "../../components/auth/RequireOnboarding";
import AppShell from "../../components/layout/AppShell";
import { useProfile } from "../../lib/useProfile";
import { isProfileComplete } from "../../lib/profileCompletion";

import AdminDashboard from "../../components/dashboard/admin/AdminDashboard";
import ManagerDashboard from "../../components/dashboard/manager/ManagerDashboard";
import ContractorDashboard from "../../components/dashboard/contractor/ContractorDashboard";

export default function DashboardPage() {
  const router = useRouter();
  const { loading, userId, profile, error } = useProfile();

  useEffect(() => {
    if (loading) return;

    if (!userId) {
      router.replace("/login");
      return;
    }

    if (!isProfileComplete(profile)) {
      router.replace("/onboarding");
      return;
    }
  }, [loading, userId, profile, router]);

  if (loading) {
    return (
      <AppShell title="Dashboard" subtitle="Loading…">
        <div className="card cardPad">
          <div className="muted">Loading…</div>
        </div>
      </AppShell>
    );
  }

  if (!userId) return null;

  if (!profile) {
    return (
      <AppShell title="Dashboard" subtitle="Profile required">
        <div className="alert alertWarn">
          <div style={{ fontWeight: 950 }}>Profile missing</div>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{error || "No profile found."}</pre>
        </div>
      </AppShell>
    );
  }

  const role = profile.role;
  const subtitle = `Welcome back${profile.full_name ? `, ${profile.full_name}` : ""}`;

  const headerRight = (
    <div className="dbHeaderRight">
      <button className="pill" onClick={() => router.push("/timesheet")}>Enter time</button>
      {role !== "contractor" ? <button className="pill" onClick={() => router.push("/approvals")}>Approvals</button> : null}
      <button className="btnPrimary" onClick={() => router.push("/reports/payroll")}>Payroll</button>
    </div>
  );

  return (
    <RequireOnboarding>
      <AppShell title="Dashboard" subtitle={subtitle} right={headerRight}>
        {role === "admin" ? (
          <AdminDashboard orgId={profile.org_id} userId={userId} />
        ) : role === "manager" ? (
          <ManagerDashboard orgId={profile.org_id} userId={userId} />
        ) : (
          <ContractorDashboard userId={userId} hourlyRate={Number(profile.hourly_rate ?? 0)} />
        )}
      </AppShell>
    </RequireOnboarding>
  );
}
