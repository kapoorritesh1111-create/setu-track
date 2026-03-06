"use client";

import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import AdminTabs from "../../../components/admin/AdminTabs";
import UserDrawer, { UserRow } from "../../../components/admin/UserDrawer";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseBrowser";
import { useProfile } from "../../../lib/useProfile";
import { Search } from "lucide-react";
import { CommandBar } from "../../../components/ui/CommandBar";
import DataTable, { Tag } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/ui/EmptyState";
import Button from "../../../components/ui/Button";
import ActionMenu from "../../../components/ui/ActionMenu";
import SavedViews from "../../../components/ui/SavedViews";

type Role = "admin" | "manager" | "contractor";
type ManagerLite = { id: string; full_name: string | null };

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  const pageRight = isAdmin ? (
    <Button variant="primary" onClick={() => router.push("/admin?invite=1")}>
      Invite user
    </Button>
  ) : null;


  return (
    <RequireOnboarding>
      <AppShell title="User management" subtitle="Admin directory (Users)" right={pageRight}>
        <AdminTabs active="users" />
        {isAdmin ? <UsersDirectory /> : <AdminOnly />}
      </AppShell>
    </RequireOnboarding>
  );
}

function AdminOnly() {
  return (
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
        You don’t have access to Users.
      </div>
    </div>
  );
}

function UsersDirectory() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | Role>("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  const [selected, setSelected] = useState<UserRow | null>(null);

  const [managers, setManagers] = useState<ManagerLite[]>([]);

  // Phase 1.9: local saved-views scaffolding
  const getViewState = () => ({ q, role, status });
  const applyViewState = (s: any) => {
    if (!s || typeof s !== "object") return;
    if (typeof s.q === "string") setQ(s.q);
    if (typeof s.role === "string") setRole(s.role);
    if (typeof s.status === "string") setStatus(s.status);
  };

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

      const res = await fetch("/api/admin/users", {
        headers: { authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setMsg(json?.error || `Failed to load (${res.status})`);
        setRows([]);
        return;
      }

      setRows((json.users ?? []) as UserRow[]);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadManagers() {
    // for dropdown in drawer
    const { data, error } = await supabase.from("profiles").select("id, full_name, role").eq("role", "manager");
    if (!error) {
      setManagers(((data as any) ?? []).map((m: any) => ({ id: m.id, full_name: m.full_name })));
    }
  }

  useEffect(() => {
    load();
    loadManagers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (role !== "all" && r.role !== role) return false;
      if (status !== "all") {
        if (status === "active" && !r.is_active) return false;
        if (status === "inactive" && r.is_active) return false;
      }
      if (!needle) return true;
      const hay = `${r.full_name ?? ""} ${r.email ?? ""} ${r.id}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, role, status]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.is_active).length;
    const inactive = total - active;
    return { total, active, inactive, showing: filtered.length };
  }, [rows, filtered]);

  function exportCsv() {
    const header = ["full_name", "email", "role", "is_active", "hourly_rate", "manager_id", "user_id"].join(",");
    const lines = filtered.map((r) => {
      const vals = [
        r.full_name ?? "",
        r.email ?? "",
        r.role ?? "",
        r.is_active ? "true" : "false",
        String(r.hourly_rate ?? ""),
        r.manager_id ?? "",
        r.id,
      ].map((v) => `"${String(v).replaceAll('"', '""')}"`);
      return vals.join(",");
    });

    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <CommandBar
        views={
          <SavedViews
            storageKey="admin_users"
            getState={getViewState}
            applyState={applyViewState}
            defaultViews={[
              { id: "all", label: "All users", state: { q: "", role: "all", status: "all" } },
              { id: "active", label: "Active", state: { q: "", role: "all", status: "active" } },
              { id: "contractors", label: "Contractors", state: { q: "", role: "contractor", status: "active" } },
              { id: "managers", label: "Managers", state: { q: "", role: "manager", status: "active" } },
            ]}
          />
        }
        left={
          <>
            <div className="peopleSearch">
              <Search size={16} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, or ID…"
              />
            </div>

            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select
                className="select"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                style={{ width: 160 }}
              >
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="contractor">Contractor</option>
              </select>

              <select
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                style={{ width: 160 }}
              >
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  setRole("all");
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
            <Tag tone="default">Users: {stats.total}</Tag>
            <Tag tone="success">Active: {stats.active}</Tag>
            <Tag tone="warn">Inactive: {stats.inactive}</Tag>
            <Tag tone="default">Showing: {stats.showing}</Tag>
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
            title="No users yet"
            description="Invite your first user to start tracking time and running payroll."
            action={
              <Button variant="primary" onClick={() => (window.location.href = "/admin/invitations")}>
                Invite users
              </Button>
            }
          />
        </div>
      ) : filtered.length === 0 && !loading ? (
        <div className="card cardPad">
          <EmptyState
            title="No users found"
            description="Try adjusting search or clearing filters."
            action={
              <Button variant="ghost" onClick={() => {
                setQ("");
                setRole("all");
                setStatus("all");
              }}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <DataTable
          rows={filtered}
          rowKey={(r) => r.id}
          loading={loading}
          onRowClick={(r) => setSelected(r)}
        actions={(r) => [
          { label: "Edit", onSelect: () => setSelected(r) },
          {
            label: "Copy email",
            onSelect: async () => {
              if (!r.email) return;
              try { await navigator.clipboard.writeText(r.email); } catch {}
            },
            disabled: !r.email,
          },
          {
            label: "Copy user ID",
            onSelect: async () => {
              try { await navigator.clipboard.writeText(r.id); } catch {}
            },
          },
        ]}
          columns={[
          {
            key: "user",
            header: "User",
            cell: (r) => (
              <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.full_name || r.email || "—"}
                </div>
                <div className="muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.email || r.id}
                </div>
              </div>
            ),
          },
          { key: "role", header: "Role", width: 140, cell: (r) => <span style={{ textTransform: "capitalize", fontWeight: 900 }}>{r.role}</span> },
          {
            key: "manager",
            header: "Manager",
            width: 180,
            cell: (r) => (
              <span className="muted">
                {r.role === "contractor" ? managers.find((m) => m.id === r.manager_id)?.full_name || "—" : "—"}
              </span>
            ),
          },
          { key: "rate", header: "Rate", width: 110, align: "right", cell: (r) => <span style={{ fontWeight: 900 }}>{Number(r.hourly_rate || 0)}</span> },
          {
            key: "status",
            header: "Status",
            width: 120,
            cell: (r) => <Tag tone={r.is_active ? "success" : "warn"}>{r.is_active ? "active" : "inactive"}</Tag>,
          },
          { key: "last", header: "Last sign-in", width: 150, cell: (r) => <span className="muted">{fmtDate(r.last_sign_in_at)}</span> },
          ]}
        />
      )}

      <UserDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        user={selected}
        managers={managers}
        onSaved={async () => {
          await load();
          await loadManagers();
        }}
      />
    </div>
  );
}
