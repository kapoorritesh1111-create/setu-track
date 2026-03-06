// src/app/admin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireOnboarding from "../../components/auth/RequireOnboarding";
import AppShell from "../../components/layout/AppShell";
import AdminTabs from "../../components/admin/AdminTabs";
import OrgSnapshot from "../../components/admin/OrgSnapshot";
import InviteDrawer from "../../components/admin/InviteDrawer";
import Button from "../../components/ui/Button";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";
import { UserPlus } from "lucide-react";

type Role = "admin" | "manager" | "contractor";
type ManagerRow = { id: string; full_name: string | null; role: Role };
type ProjectRow = { id: string; name: string; is_active: boolean };

function isValidEmail(s: string) {
  const v = s.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function AdminPage() {
  return (
    <RequireOnboarding>
      <AdminInner />
    </RequireOnboarding>
  );
}

function AdminInner() {
  const { loading: profLoading, userId, profile, error: profErr } = useProfile();
  const isAdmin = profile?.role === "admin";

  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteParam = searchParams.get("invite");

  const [drawerOpen, setDrawerOpen] = useState(false);


// Open invite drawer when URL has ?invite=1 (enables consistent primary action from other pages)
useEffect(() => {
  if (!isAdmin) return;
  if (inviteParam === "1") setDrawerOpen(true);
}, [inviteParam, isAdmin]);

function openInvite() {
  if (!isAdmin) return;
  setDrawerOpen(true);
  const qs = new URLSearchParams(searchParams.toString());
  qs.set("invite", "1");
  router.replace(`/admin?${qs.toString()}`);
}

function closeInvite() {
  setDrawerOpen(false);
  if (inviteParam === "1") {
    const qs = new URLSearchParams(searchParams.toString());
    qs.delete("invite");
    const q = qs.toString();
    router.replace(q ? `/admin?${q}` : "/admin");
  }
}

const pageRight = isAdmin ? (
  <Button variant="primary" onClick={openInvite}>
    <UserPlus size={16} style={{ marginRight: 8 }} />
    Invite user
  </Button>
) : null;

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [inviteRole, setInviteRole] = useState<Exclude<Role, "admin">>("contractor");

  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [managerId, setManagerId] = useState<string>("");

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const canSend = useMemo(() => {
    if (!isValidEmail(email)) return false;
    if (!fullName.trim()) return false;

    if (inviteRole === "contractor") {
      if (!managerId) return false;
      if (Number.isNaN(hourlyRate) || hourlyRate < 0) return false;
    }

    return true;
  }, [email, fullName, inviteRole, managerId, hourlyRate]);

  useEffect(() => {
    if (!profile?.org_id || !isAdmin) return;

    // managers
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("org_id", profile.org_id)
      .in("role", ["admin", "manager"])
      .eq("is_active", true)
      .order("role", { ascending: true })
      .order("full_name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setMsg((m) => m || error.message);
          return;
        }
        const list = (((data as any) ?? []) as ManagerRow[]) || [];
        setManagers(list);
        const prefer = list.find((m) => m.role === "manager")?.id || list[0]?.id || "";
        setManagerId((prev) => prev || prefer);
      });

    // projects
    supabase
      .from("projects")
      .select("id, name, is_active")
      .eq("org_id", profile.org_id)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setMsg((m) => m || error.message);
          return;
        }
        setProjects(((data as any) ?? []) as ProjectRow[]);
      });
  }, [profile?.org_id, isAdmin]);

  function toggleProject(id: string) {
    setProjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function clearProjects() {
    setProjectIds([]);
    setProjectQuery("");
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setMsg("Not logged in.");
        return;
      }

      const body = {
        email: email.trim(),
        full_name: fullName.trim(),
        hourly_rate: inviteRole === "contractor" ? Number(hourlyRate ?? 0) : 0,
        role: inviteRole,
        manager_id: inviteRole === "contractor" ? (managerId || null) : null,
        project_ids: projectIds,
      };

      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setMsg(json?.error || `Invite failed (${res.status})`);
        return;
      }

      setMsg("Invite sent ✅");
      setEmail("");
      setFullName("");
      setHourlyRate(0);
      setInviteRole("contractor");
      setProjectIds([]);
      setProjectQuery("");
      setDrawerOpen(false);
    } catch (err: any) {
      setMsg(err?.message || "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  if (profLoading) {
    return (
      <AppShell title="Admin" right={pageRight} subtitle="Loading…">
        <div className="card cardPad" style={{ maxWidth: 980 }}>
          <div className="skeleton" style={{ height: 16, width: 220 }} />
          <div className="skeleton" style={{ height: 42, width: "100%", marginTop: 10 }} />
          <div className="skeleton" style={{ height: 260, width: "100%", marginTop: 10 }} />
        </div>
      </AppShell>
    );
  }

  if (!userId) {
    return (
      <AppShell title="Admin" right={pageRight} subtitle="Admin-only tools">
        <div className="card cardPad" style={{ maxWidth: 980 }}>
          <div style={{ fontWeight: 950 }}>Please log in.</div>
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell title="Admin" right={pageRight} subtitle="Admin-only tools">
        <div className="card cardPad" style={{ maxWidth: 980 }}>
          <div style={{ fontWeight: 950 }}>Profile missing</div>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{profErr || "No profile found."}</pre>
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin" right={pageRight} subtitle="Admin-only tools">
        <div
          className="card cardPad"
          style={{
            maxWidth: 980,
            borderColor: "rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.06)",
          }}
        >
          <div style={{ fontWeight: 950 }}>Admin only</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Your role is <b>{profile.role}</b>. Ask an admin for access if needed.
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin" right={pageRight} subtitle="Invite and manage access">
      <AdminTabs active="invite" />

      {/* ✅ Org snapshot */}
      <OrgSnapshot />

      {/* Header row */}
      <div className="card cardPad" style={{ maxWidth: 980, marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Directory actions</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Invite teammates and assign access in one step.
            </div>
          </div>

          
        </div>

        {msg ? (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              border: `1px solid ${msg.includes("✅") ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
              background: msg.includes("✅") ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            {msg}
          </div>
        ) : null}
      </div>

      {/* ✅ Slide-in drawer */}
      <InviteDrawer
        open={drawerOpen}
        onClose={closeInvite}
        email={email}
        setEmail={setEmail}
        fullName={fullName}
        setFullName={setFullName}
        inviteRole={inviteRole}
        setInviteRole={setInviteRole}
        hourlyRate={hourlyRate}
        setHourlyRate={setHourlyRate}
        managers={managers}
        managerId={managerId}
        setManagerId={setManagerId}
        projects={projects}
        projectQuery={projectQuery}
        setProjectQuery={setProjectQuery}
        projectIds={projectIds}
        toggleProject={toggleProject}
        clearProjects={clearProjects}
        canSend={canSend}
        busy={busy}
        onSend={sendInvite}
      />
    </AppShell>
  );
}
