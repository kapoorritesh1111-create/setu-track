"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";
import { Copy, RefreshCcw, Search, Users } from "lucide-react";
import { Tag } from "../ui/DataTable";
import ToolbarBlock from "../ui/ToolbarBlock";
import { EmptyState } from "../ui/EmptyState";
import Button from "../ui/Button";

type Role = "admin" | "manager" | "contractor";

type ProfileRow = {
  id: string;
  org_id: string;
  full_name: string | null;
  role: Role;
  hourly_rate: number | null;
  is_active: boolean;
  manager_id: string | null;
  created_at: string | null;
};

type ActiveFilter = "all" | "active" | "inactive";
type ScopeFilter = "visible" | "all";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function normalize(s: string | null | undefined) {
  return (s ?? "").toLowerCase().trim();
}

function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim()
  );
}

function money(rate: number | null) {
  const value = Number(rate ?? 0);
  if (!value) return "—";
  return `$${value.toFixed(0)}/hr`;
}

export default function PeopleDirectory({
  mode,
}: {
  mode: "people" | "admin";
}) {
  const { profile, userId, loading, refresh } = useProfile();

  const isAdmin = profile?.role === "admin";
  const isManager = profile?.role === "manager";

  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const baselineRef = useRef<Record<string, string>>({});

  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [scope, setScope] = useState<ScopeFilter>("visible");

  useEffect(() => {
    if (!profile?.org_id) return;

    (async function loadProfiles() {
      setMsg("");
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, org_id, full_name, role, hourly_rate, is_active, manager_id, created_at"
        )
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: true });

      if (error) {
        setMsg(error.message);
        setRows([]);
        return;
      }

      const list = (data ?? []) as ProfileRow[];
      setRows(list);

      const base: Record<string, string> = {};
      for (const r of list) {
        base[r.id] = JSON.stringify({
          full_name: r.full_name ?? "",
          role: r.role,
          hourly_rate: r.hourly_rate ?? 0,
          is_active: r.is_active,
          manager_id: r.manager_id ?? "",
        });
      }
      baselineRef.current = base;
    })();
  }, [profile?.org_id]);

  async function reload() {
    if (!profile?.org_id) return;
    setMsg("");
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, org_id, full_name, role, hourly_rate, is_active, manager_id, created_at"
      )
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: true });

    if (error) {
      setMsg(error.message);
      setRows([]);
      return;
    }

    const list = (data ?? []) as ProfileRow[];
    setRows(list);

    const base: Record<string, string> = {};
    for (const r of list) {
      base[r.id] = JSON.stringify({
        full_name: r.full_name ?? "",
        role: r.role,
        hourly_rate: r.hourly_rate ?? 0,
        is_active: r.is_active,
        manager_id: r.manager_id ?? "",
      });
    }
    baselineRef.current = base;
  }

  function isDirty(r: ProfileRow) {
    const base = baselineRef.current[r.id] ?? "";
    const cur = JSON.stringify({
      full_name: r.full_name ?? "",
      role: r.role,
      hourly_rate: r.hourly_rate ?? 0,
      is_active: r.is_active,
      manager_id: r.manager_id ?? "",
    });
    return base !== cur;
  }

  async function saveRow(id: string, patch: Partial<ProfileRow>) {
    if (!profile?.org_id) return;

    setBusyId(id);
    setMsg("");

    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", id)
      .eq("org_id", profile.org_id);

    setBusyId("");
    if (error) {
      setMsg(error.message);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    const row = rows.find((r) => r.id === id);
    const merged = { ...(row ?? ({} as ProfileRow)), ...patch } as ProfileRow;
    baselineRef.current[id] = JSON.stringify({
      full_name: merged.full_name ?? "",
      role: merged.role,
      hourly_rate: merged.hourly_rate ?? 0,
      is_active: merged.is_active,
      manager_id: merged.manager_id ?? "",
    });

    if (id === userId) refresh?.();
  }

  async function bulkSetActive(isActive: boolean) {
    if (!profile?.org_id) return;
    if (!isAdmin) {
      setMsg("Only Admin can bulk update status.");
      return;
    }
    const selectedIds = Object.keys(selected).filter((k) => selected[k]);
    if (selectedIds.length === 0) return;

    setMsg("");
    setBusyId("bulk");

    const { error } = await supabase
      .from("profiles")
      .update({ is_active: isActive })
      .in("id", selectedIds)
      .eq("org_id", profile.org_id);

    setBusyId("");
    if (error) {
      setMsg(error.message);
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        selectedIds.includes(r.id) ? { ...r, is_active: isActive } : r
      )
    );

    for (const id of selectedIds) {
      const r = rows.find((x) => x.id === id);
      if (!r) continue;
      baselineRef.current[id] = JSON.stringify({
        full_name: r.full_name ?? "",
        role: r.role,
        hourly_rate: r.hourly_rate ?? 0,
        is_active: isActive,
        manager_id: r.manager_id ?? "",
      });
    }

    setSelected({});
  }

  async function copySelectedIds() {
    const selectedIds = Object.keys(selected).filter((k) => selected[k]);
    if (!selectedIds.length) return;
    try {
      await navigator.clipboard.writeText(selectedIds.join("\n"));
      setMsg(`Copied ${selectedIds.length} ID(s) to clipboard.`);
    } catch {
      setMsg("Could not copy to clipboard (browser blocked).");
    }
  }

  function clearFilters() {
    setQ("");
    setRoleFilter("all");
    setActiveFilter("all");
    setScope("visible");
  }

  if (loading) {
    return <div className="card" style={{ padding: 16 }}>Loading…</div>;
  }

  if (!profile || !userId) {
    return <div className="card" style={{ padding: 16 }}>Please sign in.</div>;
  }

  if (mode === "admin" && !isAdmin) {
    return (
      <div
        className="card"
        style={{
          padding: 16,
          borderColor: "rgba(239,68,68,0.35)",
          background: "rgba(239,68,68,0.06)",
        }}
      >
        <div style={{ fontWeight: 950 }}>Admin only</div>
        <div className="muted" style={{ marginTop: 6 }}>
          You don’t have access to User management.
        </div>
      </div>
    );
  }

  let visibleRows = rows;
  if (mode === "admin") {
    visibleRows = isAdmin ? rows : [];
  } else if (!(scope === "all" && isAdmin)) {
    if (isAdmin) {
      visibleRows = rows;
    } else if (isManager) {
      visibleRows = rows.filter((r) => r.id === userId || r.manager_id === userId);
    } else {
      visibleRows = rows.filter((r) => r.id === userId);
    }
  }

  const managers = rows
    .filter((r) => r.role === "manager" && r.is_active)
    .sort((a, b) => normalize(a.full_name).localeCompare(normalize(b.full_name)));

  const managerNameById = new Map<string, string>();
  for (const m of managers) {
    managerNameById.set(m.id, m.full_name || m.id);
  }

  const needle = normalize(q);
  const qIsUuid = isUuidLike(needle);
  const filtered = visibleRows.filter((r) => {
    if (roleFilter !== "all" && r.role !== roleFilter) return false;
    if (activeFilter === "active" && !r.is_active) return false;
    if (activeFilter === "inactive" && r.is_active) return false;
    if (!needle) return true;

    const name = normalize(r.full_name);
    const role = normalize(r.role);
    const id = normalize(r.id);
    return qIsUuid ? id.includes(needle) : name.includes(needle) || role.includes(needle) || id.includes(needle);
  });

  const filteredIds = new Set(filtered.map((r) => r.id));
  const selectedIds = Object.keys(selected).filter((k) => selected[k] && filteredIds.has(k));
  const anySelected = selectedIds.length > 0;
  const allSelected = filtered.length > 0 && filtered.every((r) => selected[r.id]);

  const counts = {
    total: visibleRows.length,
    active: visibleRows.filter((r) => r.is_active).length,
    inactive: visibleRows.filter((r) => !r.is_active).length,
    showing: filtered.length,
  };

  const contractorRows = visibleRows.filter((r) => r.role === "contractor");
  const managerCount = visibleRows.filter((r) => r.role === "manager").length;
  const avgRate = contractorRows.length
    ? contractorRows.reduce((sum, r) => sum + Number(r.hourly_rate ?? 0), 0) / contractorRows.length
    : 0;
  const needsAction = contractorRows.filter((r) => r.is_active && !Number(r.hourly_rate ?? 0)).length;

  const stripItems = [
    {
      label: "Visible people",
      value: String(counts.total),
      hint: mode === "admin" ? "Admin directory scope" : scope === "all" && isAdmin ? "Full org view" : "Role-based visibility",
    },
    { label: "Active", value: String(counts.active), hint: `${counts.inactive} inactive` },
    { label: "Needs action", value: String(needsAction), hint: "Active contractors missing rate data" },
    { label: "Managers", value: String(managerCount), hint: avgRate > 0 ? `Avg contractor rate $${avgRate.toFixed(0)}/hr` : "Rate data appears as profiles are completed" },
  ];

  function toggleAll() {
    if (allSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const r of filtered) next[r.id] = true;
    setSelected(next);
  }

  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="peopleWrap">
      <ToolbarBlock
        left={
          <>
            <div className="peopleSearch">
              <Search size={16} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, role, or ID…"
              />
            </div>

            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | "all")} aria-label="Role filter" style={{ width: 160 }}>
                <option value="all">All roles</option>
                <option value="admin">Admins</option>
                <option value="manager">Managers</option>
                <option value="contractor">Contractors</option>
              </select>

              <select className="select" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)} aria-label="Status filter" style={{ width: 160 }}>
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              {mode === "people" ? (
                <select
                  className="select"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as ScopeFilter)}
                  aria-label="Scope filter"
                  disabled={!isAdmin}
                  title={!isAdmin ? "Admin only" : ""}
                  style={{ width: 170 }}
                >
                  <option value="visible">Visible</option>
                  <option value="all">All org (admin)</option>
                </select>
              ) : null}

              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
            </div>
          </>
        }
        right={
          <>
            <Tag tone="default">Users: {counts.total}</Tag>
            <Tag tone="success">Active: {counts.active}</Tag>
            <Tag tone="warn">Inactive: {counts.inactive}</Tag>
            <Tag tone="default">Showing: {counts.showing}</Tag>
            <Button onClick={reload} icon={<RefreshCcw size={16} />}>Refresh</Button>
          </>
        }
        message={msg ? <span>{msg}</span> : null}
      />

      <div className="metricsRow" style={{ marginBottom: 14 }}>
        {stripItems.map((item) => (
          <div key={item.label} className="statCard">
            <div className="statLabel">{item.label}</div>
            <div className="statValue">{item.value}</div>
            <div className="statHint">{item.hint}</div>
          </div>
        ))}
      </div>

      {anySelected ? (
        <div className="peopleBulk card cardPad" style={{ marginBottom: 12 }}>
          <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Tag tone="default">{selectedIds.length} selected</Tag>
            <Button onClick={copySelectedIds} icon={<Copy size={16} />}>Copy IDs</Button>
            {isAdmin ? (
              <>
                <Button disabled={busyId === "bulk"} onClick={() => bulkSetActive(true)}>Activate</Button>
                <Button disabled={busyId === "bulk"} onClick={() => bulkSetActive(false)}>Deactivate</Button>
              </>
            ) : null}
            <Button variant="ghost" onClick={() => setSelected({})}>Clear selection</Button>
          </div>
        </div>
      ) : null}

      {visibleRows.length === 0 ? (
        <div className="card cardPad">
          <EmptyState
            title="No people yet"
            description={
              isAdmin
                ? "Invite users to your org to start tracking time and payroll."
                : "Your directory is empty or you don’t have access to view it."
            }
            action={
              isAdmin ? (
                <Button variant="primary" onClick={() => (window.location.href = "/admin/invitations")}>
                  Invite users
                </Button>
              ) : (
                <Button onClick={reload}>Refresh</Button>
              )
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card cardPad">
          <EmptyState
            title="No users found"
            description="Try adjusting search or clearing filters."
            action={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>}
          />
        </div>
      ) : (
        <div className="card">
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 42, textAlign: "center" }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                  </th>
                  <th>Name</th>
                  <th style={{ width: 140 }}>Role</th>
                  <th style={{ width: 210 }}>Manager</th>
                  <th style={{ width: 120, textAlign: "right" }}>Rate</th>
                  <th style={{ width: 130 }}>Status</th>
                  <th style={{ width: 130 }}>Joined</th>
                  <th style={{ width: 120, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const dirty = isDirty(r);
                  const canEditSelfName = r.id === userId;
                  const canAdminEdit = isAdmin;
                  const canManagerEditReport = isManager && r.manager_id === userId;
                  const canEditName = canAdminEdit || canEditSelfName || canManagerEditReport;
                  const canEditRole = isAdmin;
                  const canEditManager = isAdmin;
                  const canEditRate = isAdmin || canManagerEditReport;
                  const canEditStatus = isAdmin;

                  return (
                    <tr key={r.id}>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={!!selected[r.id]}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleOne(r.id);
                          }}
                          aria-label={`Select ${r.full_name ?? r.id}`}
                        />
                      </td>
                      <td>
                        <div style={{ display: "grid", gap: 6 }}>
                          {canEditName ? (
                            <input
                              className="input"
                              value={r.full_name ?? ""}
                              placeholder="Full name"
                              onChange={(e) =>
                                setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, full_name: e.target.value } : x)))
                              }
                              onBlur={() => {
                                if (!dirty) return;
                                void saveRow(r.id, { full_name: r.full_name ?? "" });
                              }}
                            />
                          ) : (
                            <div style={{ fontWeight: 850 }}>{r.full_name ?? "—"}</div>
                          )}
                          <div className="muted mono" style={{ fontSize: 12 }}>{r.id}</div>
                        </div>
                      </td>
                      <td>
                        <select
                          className="input"
                          value={r.role}
                          disabled={!canEditRole}
                          title={!canEditRole ? "Admin only" : ""}
                          onChange={(e) => {
                            const role = e.target.value as Role;
                            setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, role } : x)));
                          }}
                          onBlur={() => {
                            if (!dirty || !canEditRole) return;
                            void saveRow(r.id, { role: r.role });
                          }}
                        >
                          <option value="admin">admin</option>
                          <option value="manager">manager</option>
                          <option value="contractor">contractor</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="input"
                          value={r.manager_id ?? ""}
                          disabled={!canEditManager}
                          title={!canEditManager ? "Admin only" : ""}
                          onChange={(e) => {
                            const manager_id = e.target.value || null;
                            setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, manager_id } : x)));
                          }}
                          onBlur={() => {
                            if (!dirty || !canEditManager) return;
                            void saveRow(r.id, { manager_id: r.manager_id });
                          }}
                        >
                          <option value="">—</option>
                          {managers.map((m) => (
                            <option key={m.id} value={m.id}>{m.full_name ?? m.id}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          className="input"
                          type="number"
                          value={r.hourly_rate ?? 0}
                          disabled={!canEditRate}
                          title={!canEditRate ? "Admin only / your direct report" : ""}
                          onChange={(e) => {
                            const hourly_rate = Number(e.target.value);
                            setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, hourly_rate } : x)));
                          }}
                          onBlur={() => {
                            if (!dirty || !canEditRate) return;
                            void saveRow(r.id, { hourly_rate: r.hourly_rate ?? 0 });
                          }}
                        />
                      </td>
                      <td>
                        {canEditStatus ? (
                          <select
                            className="input"
                            value={r.is_active ? "active" : "inactive"}
                            onChange={(e) => {
                              const is_active = e.target.value === "active";
                              setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_active } : x)));
                            }}
                            onBlur={() => {
                              if (!dirty) return;
                              void saveRow(r.id, { is_active: r.is_active });
                            }}
                          >
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                          </select>
                        ) : (
                          <Tag tone={r.is_active ? "success" : "warn"}>{r.is_active ? "Active" : "Inactive"}</Tag>
                        )}
                      </td>
                      <td>{fmtDate(r.created_at)}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!dirty || busyId === r.id}
                            onClick={() =>
                              void saveRow(r.id, {
                                full_name: r.full_name ?? "",
                                role: r.role,
                                hourly_rate: r.hourly_rate ?? 0,
                                is_active: r.is_active,
                                manager_id: r.manager_id,
                              })
                            }
                          >
                            {busyId === r.id ? "Saving…" : dirty ? "Save" : "Saved"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(r.id);
                                setMsg("Copied user ID.");
                              } catch {
                                setMsg("Could not copy user ID.");
                              }
                            }}
                          >
                            Copy ID
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="cardPad" style={{ borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div className="muted">
              {counts.showing} showing • {contractorRows.length} contractors • {managerCount} managers
            </div>
            <div className="muted">
              Avg contractor rate: {money(avgRate)} {needsAction ? `• ${needsAction} need rate setup` : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
