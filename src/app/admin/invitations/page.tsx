"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import AdminTabs from "../../../components/admin/AdminTabs";
import DataTable, { Tag, ActionItem } from "../../../components/ui/DataTable";
import { CommandBar } from "../../../components/ui/CommandBar";
import { EmptyState } from "../../../components/ui/EmptyState";
import Button from "../../../components/ui/Button";
import ActionMenu from "../../../components/ui/ActionMenu";
import SavedViews from "../../../components/ui/SavedViews";
import { supabase } from "../../../lib/supabaseBrowser";
import { useProfile } from "../../../lib/useProfile";

type InviteStatus = "all" | "pending" | "active";

type InviteUser = {
  id: string;
  email: string | null;
  status: "pending" | "active";
  invited_at: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function AdminInvitationsPage() {
  return (
    <RequireOnboarding>
      <InvitationsInner />
    </RequireOnboarding>
  );
}

function InvitationsInner() {
  const router = useRouter();
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  const pageRight = isAdmin ? (
    <Button variant="primary" onClick={() => router.push("/admin?invite=1")}>
      Invite user
    </Button>
  ) : null;


  const [rows, setRows] = useState<InviteUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<InviteStatus>("all");

  const [busyId, setBusyId] = useState<string>("");

  // Phase 1.9: local saved-views scaffolding
  const getViewState = () => ({ q, status });
  const applyViewState = (s: any) => {
    if (!s || typeof s !== "object") return;
    if (typeof s.q === "string") setQ(s.q);
    if (typeof s.status === "string") setStatus(s.status);
  };

  const didLoad = useRef(false);

  useEffect(() => {
    if (!isAdmin) return;
    if (didLoad.current) return;
    didLoad.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function load() {
    setLoading(true);
    setMsg("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setMsg("Not logged in.");
        setRows([]);
        return;
      }

      const res = await fetch("/api/admin/invitations", {
        headers: { authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json.ok) {
        setMsg(json?.error || `Failed to load (${res.status})`);
        setRows([]);
        return;
      }

      setRows((json.users ?? []) as InviteUser[]);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!needle) return true;
      const hay = `${r.email ?? ""} ${r.id}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, status]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((r) => r.status === "pending").length;
    const active = rows.filter((r) => r.status === "active").length;
    return { total, pending, active, showing: filtered.length };
  }, [rows, filtered]);

  function exportCsv() {
    const header = ["email", "status", "invited_at", "last_sign_in_at", "email_confirmed_at", "id"].join(",");
    const lines = filtered.map((r) => {
      const vals = [
        r.email ?? "",
        r.status,
        r.invited_at ?? "",
        r.last_sign_in_at ?? "",
        r.email_confirmed_at ?? "",
        r.id,
      ].map((v) => `"${String(v).replaceAll('"', '""')}"`);
      return vals.join(",");
    });
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invitations_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyInviteLink(email: string) {
    setBusyId(email);
    setMsg("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setMsg("Not logged in.");
        return;
      }

      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ email }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json.ok) {
        setMsg(json?.error || `Failed to generate link (${res.status})`);
        return;
      }

      const link = String(json.action_link || "");
      await navigator.clipboard.writeText(link);
      setMsg("Invite link copied ✅");
    } catch (e: any) {
      setMsg(e?.message || "Could not copy invite link");
    } finally {
      setBusyId("");
    }
  }

  async function cancelInvite(user_id: string) {
    if (!confirm("Cancel this invitation? This will delete the invited user.")) return;

    setBusyId(user_id);
    setMsg("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setMsg("Not logged in.");
        return;
      }

      const res = await fetch("/api/admin/invitations", {
        method: "DELETE",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json.ok) {
        setMsg(json?.error || `Cancel failed (${res.status})`);
        return;
      }

      setMsg("Invitation cancelled ✅");
      setRows((prev) => prev.filter((r) => r.id !== user_id));
    } catch (e: any) {
      setMsg(e?.message || "Cancel failed");
    } finally {
      setBusyId("");
    }
  }

  if (!isAdmin) {
    return (
      <AppShell title="Invitations" subtitle="Admin only" right={pageRight}>
        <div style={{ maxWidth: 980 }}>
          <AdminTabs active="invitations" />
          <div
            className="card cardPad"
            style={{ borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.06)", marginTop: 12 }}
          >
            <div style={{ fontWeight: 950 }}>Admin only</div>
            <div className="muted" style={{ marginTop: 6 }}>You don’t have access to Invitations.</div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Invitations" subtitle="Pending invites and activation status" right={pageRight}>
      <div style={{ maxWidth: 1100 }}>
        <AdminTabs active="invitations" />

      <CommandBar
        views={
          <SavedViews
            storageKey="admin_invitations"
            getState={getViewState}
            applyState={applyViewState}
            defaultViews={[
              { id: "all", label: "All", state: { q: "", status: "all" } },
              { id: "pending", label: "Pending", state: { q: "", status: "pending" } },
              { id: "active", label: "Active", state: { q: "", status: "active" } },
            ]}
          />
        }
        left={
          <>
            <div className="peopleSearch">
              <input
                className="input"
                placeholder="Search email or user ID…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ width: 280 }}
              />
            </div>

            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value as InviteStatus)}
                style={{ width: 170 }}
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
              </select>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  setStatus("all");
                }}
              >
                Clear
              </Button>
            </div>
          </>
        }
        right={
          <>
            <span className="badge">Total: {stats.total}</span>
            <span className="badge badgeWarn">Pending: {stats.pending}</span>
            <span className="badge badgeOk">Active: {stats.active}</span>
            <span className="badge">Showing: {stats.showing}</span>
            <Button onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>

            <ActionMenu
              items={[
                { label: "Export CSV", onSelect: exportCsv },
                {
                  label: "Copy visible JSON",
                  onSelect: async () => {
                    try {
                      await navigator.clipboard.writeText(JSON.stringify(filtered, null, 2));
                      setMsg("Copied visible rows to clipboard.");
                      setTimeout(() => setMsg(""), 2000);
                    } catch {
                      setMsg("Clipboard blocked.");
                      setTimeout(() => setMsg(""), 2000);
                    }
                  },
                },
              ]}
            />
          </>
        }
        message={msg ? <span>{msg}</span> : null}
        sticky
      />

      {rows.length === 0 && !loading && !msg ? (
        <div className="card cardPad">
          <EmptyState
            title="No invitations yet"
            description="Generate invite links to onboard admins, managers, and contractors."
            action={<Button onClick={load}>Refresh</Button>}
          />
        </div>
      ) : null}

        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <DataTable
            loading={loading}
            rows={filtered}
            rowKey={(r) => r.id}
            columns={[
              {
                key: "email",
                header: "Email",
                width: 360,
                cell: (r) => (
                  <div>
                    <div style={{ fontWeight: 800 }}>{r.email || "—"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {r.id}
                    </div>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                width: 120,
                cell: (r) => (
                  <Tag tone={r.status === "pending" ? "warn" : "success"}>{r.status}</Tag>
                ),
              },
              { key: "invited", header: "Invited", width: 140, cell: (r) => fmtDate(r.invited_at) },
              { key: "created", header: "Created", width: 140, cell: (r) => fmtDate(r.created_at) },
              { key: "last", header: "Last sign-in", width: 140, cell: (r) => fmtDate(r.last_sign_in_at) },
            ]}
            emptyTitle="No invitations"
            emptySubtitle="Try adjusting your search or status filter."
            actions={(r): ActionItem<InviteUser>[] => [
              {
                label: "Copy email",
                disabled: !r.email,
                onSelect: async () => {
                  await navigator.clipboard.writeText(r.email || "");
                  setMsg("Email copied ✅");
                },
              },
              {
                label: "Copy user ID",
                onSelect: async () => {
                  await navigator.clipboard.writeText(r.id);
                  setMsg("User ID copied ✅");
                },
              },
              {
                label: busyId === (r.email || "") ? "Working…" : "Copy invite link",
                disabled: !r.email || busyId === (r.email || ""),
                onSelect: async () => {
                  if (!r.email) return;
                  await copyInviteLink(r.email);
                },
              },
              ...(r.status === "pending"
                ? [
                    {
                      label: busyId === r.id ? "Cancelling…" : "Cancel invitation",
                      danger: true,
                      disabled: busyId === r.id,
                      onSelect: async () => {
                        await cancelInvite(r.id);
                      },
                    } as ActionItem<InviteUser>,
                  ]
                : []),
            ]}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
