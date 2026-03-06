"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";
import { Copy, Search } from "lucide-react";
import DataTable, { Tag } from "../ui/DataTable";
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

  // Selection + menu
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const baselineRef = useRef<Record<string, string>>({});

  // Filters
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [scope, setScope] = useState<ScopeFilter>("visible");

  // (Row actions handled by shared DataTable actions menu)

  // Load org profiles
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

      // baseline for dirty detection
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

  const visibleRows = useMemo(() => {
    if (!profile || !userId) return [];

    // ADMIN Users view = real org directory (admin-only)
    if (mode === "admin") {
      if (!isAdmin) return [];
      return rows;
    }

    // PEOPLE view = role-based visibility
    if (scope === "all" && isAdmin) return rows;

    if (isAdmin) return rows;

    if (isManager) {
      return rows.filter((r) => r.id === userId || r.manager_id === userId);
    }

    return rows.filter((r) => r.id === userId);
  }, [rows, profile, userId, scope, isAdmin, isManager, mode]);

  const managers = useMemo(() => {
    return rows
      .filter((r) => r.role === "manager" && r.is_active)
      .sort((a, b) => normalize(a.full_name).localeCompare(normalize(b.full_name)));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = normalize(q);
    const qIsUuid = isUuidLike(needle);

    return visibleRows.filter((r) => {
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (activeFilter === "active" && !r.is_active) return false;
      if (activeFilter === "inactive" && r.is_active) return false;

      if (!needle) return true;

      const name = normalize(r.full_name);
      const role = normalize(r.role);
      const id = normalize(r.id);

      if (qIsUuid) return id.includes(needle);
      return name.includes(needle) || role.includes(needle) || id.includes(needle);
    });
  }, [visibleRows, q, roleFilter, activeFilter]);

  // Remove selection for non-visible rows
  useEffect(() => {
    const allowed = new Set(filtered.map((r) => r.id));
    setSelected((prev) => {
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(prev)) {
        if (allowed.has(k) && prev[k]) next[k] = true;
      }
      return next;
    });
  }, [filtered]);

  // Derived (NO HOOKS HERE)
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const anySelected = selectedIds.length > 0;
  const allSelected = filtered.length > 0 && filtered.every((r) => selected[r.id]);

  const counts = useMemo(() => {
    const total = visibleRows.length;
    const active = visibleRows.filter((r) => r.is_active).length;
    const inactive = total - active;
    const showing = filtered.length;
    return { total, active, inactive, showing };
  }, [visibleRows, filtered]);

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

    // update baseline
    const row = rows.find((r) => r.id === id);
    const merged = { ...(row ?? ({} as any)), ...patch } as ProfileRow;
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
    if (!anySelected) return;
    const text = selectedIds.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setMsg(`Copied ${selectedIds.length} ID(s) to clipboard.`);
    } catch {
      setMsg("Could not copy to clipboard (browser blocked).");
    }
  }

  function toggleAll() {
    setSelected(() => {
      if (allSelected) return {};
      const next: Record<string, boolean> = {};
      for (const r of filtered) next[r.id] = true;
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
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

  // Admin mode is admin-only: show a clean message (no crash)
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

  return (
    <div className="peopleWrap">
      {/* Toolbar (shared layout) */}
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
              <select
                className="select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                aria-label="Role filter"
                style={{ width: 160 }}
              >
                <option value="all">All roles</option>
                <option value="admin">Admins</option>
                <option value="manager">Managers</option>
                <option value="contractor">Contractors</option>
              </select>

              <select
                className="select"
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as any)}
                aria-label="Status filter"
                style={{ width: 160 }}
              >
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              {mode === "people" ? (
                <select
                  className="select"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as any)}
                  aria-label="Scope filter"
                  disabled={!isAdmin}
                  title={!isAdmin ? "Admin only" : ""}
                  style={{ width: 160 }}
                >
                  <option value="visible">Visible</option>
                  <option value="all">All org (admin)</option>
                </select>
              ) : null}

              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </>
        }
        right={
          <>
            <Tag tone="default">Users: {counts.total}</Tag>
            <Tag tone="success">Active: {counts.active}</Tag>
            <Tag tone="warn">Inactive: {counts.inactive}</Tag>
            <Tag tone="default">Showing: {counts.showing}</Tag>
            <Button onClick={reload}>Refresh</Button>
          </>
        }
        message={msg ? <span>{msg}</span> : null}
      />

      {/* Bulk bar */}
      {anySelected && (
        <div className="peopleBulk card">
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <Tag tone="default">{selectedIds.length} selected</Tag>

            <Button onClick={copySelectedIds}>
              <Copy size={16} style={{ marginRight: 8 }} />
              Copy IDs
            </Button>

            {isAdmin && (
              <>
                <Button disabled={busyId === "bulk"} onClick={() => bulkSetActive(true)}>
                  Activate
                </Button>
                <Button disabled={busyId === "bulk"} onClick={() => bulkSetActive(false)}>
                  Deactivate
                </Button>
              </>
            )}

            <Button variant="ghost" onClick={() => setSelected({})}>
              Clear selection
            </Button>
          </div>

          {busyId === "bulk" && (
            <div className="muted" style={{ marginTop: 8 }}>
              Applying bulk update…
            </div>
          )}
        </div>
      )}

      {/* Messages now shown in toolbar */}

      {/* Table */}
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
            action={
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <DataTable
        rows={filtered}
        rowKey={(r) => r.id}
        loading={false}
        columns={[
          {
            key: "sel",
            header: (
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
            ),
            width: 36,
            align: "center",
            cell: (r) => (
              <input
                type="checkbox"
                checked={!!selected[r.id]}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleOne(r.id);
                }}
                aria-label={`Select ${r.full_name ?? r.id}`}
              />
            ),
          },
          {
            key: "name",
            header: "Name",
            cell: (r) => {
              const dirty = isDirty(r);
              const canEditSelfName = r.id === userId;
              const canAdminEdit = isAdmin;
              const canManagerEditReport = isManager && r.manager_id === userId;
              const canEditName = canAdminEdit || canEditSelfName || canManagerEditReport;

              return (
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
                        saveRow(r.id, { full_name: r.full_name ?? "" });
                      }}
                    />
                  ) : (
                    <div style={{ fontWeight: 850 }}>{r.full_name ?? "—"}</div>
                  )}
                  <div className="muted mono" style={{ fontSize: 12 }}>
                    {r.id}
                  </div>
                </div>
              );
            },
          },
          {
            key: "role",
            header: "Role",
            width: 140,
            cell: (r) => {
              const dirty = isDirty(r);
              const canEditRole = isAdmin;

              return (
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
                    if (!dirty) return;
                    if (canEditRole) saveRow(r.id, { role: r.role });
                  }}
                >
                  <option value="admin">admin</option>
                  <option value="manager">manager</option>
                  <option value="contractor">contractor</option>
                </select>
              );
            },
          },
          {
            key: "manager",
            header: "Manager",
            width: 200,
            cell: (r) => {
              const dirty = isDirty(r);
              const canEditManager = isAdmin;

              return (
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
                    if (!dirty) return;
                    if (canEditManager) saveRow(r.id, { manager_id: r.manager_id });
                  }}
                >
                  <option value="">—</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name ?? m.id}
                    </option>
                  ))}
                </select>
              );
            },
          },
          {
            key: "rate",
            header: "Rate",
            width: 120,
            align: "right",
            cell: (r) => {
              const dirty = isDirty(r);
              const canManagerEditReport = isManager && r.manager_id === userId;
              const canEditRate = isAdmin || canManagerEditReport;

              return (
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
                    if (!dirty) return;
                    if (canEditRate) saveRow(r.id, { hourly_rate: r.hourly_rate ?? 0 });
                  }}
                />
              );
            },
          },
          {
            key: "status",
            header: "Status",
            width: 130,
            cell: (r) => {
              const dirty = isDirty(r);
              const canEditStatus = isAdmin;
              if (canEditStatus) {
                return (
                  <select
                    className="input"
                    value={r.is_active ? "active" : "inactive"}
                    onChange={(e) => {
                      const is_active = e.target.value === "active";
                      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_active } : x)));
                    }}
                    onBlur={() => {
                      if (!dirty) return;
                      saveRow(r.id, { is_active: r.is_active });
                    }}
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                );
              }
              return <Tag tone={r.is_active ? "success" : "warn"}>{r.is_active ? "Active" : "Inactive"}</Tag>;
            },
          },
          {
            key: "joined",
            header: "Joined",
            width: 130,
            cell: (r) => fmtDate(r.created_at),
          },
        ]}
        actions={(r) => {
          const dirty = isDirty(r);
          const items: any[] = [];
          if (dirty) {
            items.push({
              label: busyId === r.id ? "Saving…" : "Save",
              disabled: busyId === r.id,
              onSelect: async () =>
                saveRow(r.id, {
                  full_name: r.full_name ?? "",
                  role: r.role,
                  hourly_rate: r.hourly_rate ?? 0,
                  is_active: r.is_active,
                  manager_id: r.manager_id,
                }),
            });
          }
          items.push({
            label: "Copy user ID",
            onSelect: async () => {
              try {
                await navigator.clipboard.writeText(r.id);
                setMsg("Copied user ID.");
              } catch {
                setMsg("Could not copy user ID.");
              }
            },
          });
          return items;
        }}
        />
      )}
    </div>
  );
}
