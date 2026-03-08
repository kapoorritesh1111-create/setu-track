"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "../../components/layout/AppShell";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";
import { CommandBar } from "../../components/ui/CommandBar";
import DataTable, { Tag } from "../../components/ui/DataTable";
import Drawer from "../../components/ui/Drawer";
import FormField from "../../components/ui/FormField";
import { EmptyState } from "../../components/ui/EmptyState";
import Button from "../../components/ui/Button";
import ActionMenu from "../../components/ui/ActionMenu";
import SavedViews from "../../components/ui/SavedViews";
import { Search } from "lucide-react";

type WeekStart = "sunday" | "monday";
type ActiveFilter = "all" | "active" | "inactive";

type Project = {
  id: string;
  name: string;
  is_active: boolean;
  org_id: string;
  week_start?: WeekStart | null;
};

type MemberRow = {
  id: string;
  project_id: string;
  is_active: boolean;
};

type SimpleProfile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type DrawerMember = {
  profile_id: string;
  full_name: string | null;
  role: string | null;
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function weekStartLabel(ws?: WeekStart | null) {
  const v = ws || "sunday";
  return v === "monday" ? "Week starts Monday" : "Week starts Sunday";
}

function copyToClipboard(text: string) {
  try {
    navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

export default function ProjectsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, userId, profile, error: profErr } = useProfile();

  const selectedProjectId = useMemo(() => searchParams.get("project") || "", [searchParams]);
  const newParam = useMemo(() => searchParams.get("new") || "", [searchParams]);
  const manageUserId = useMemo(() => searchParams.get("user") || "", [searchParams]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [fetchErr, setFetchErr] = useState<string>("");

  // Assignment mode (Admin only): /projects?user=<profile_id>
  const [manageUser, setManageUser] = useState<SimpleProfile | null>(null);
  const [memberMap, setMemberMap] = useState<Record<string, MemberRow>>({});

  // Busy states
  const [busyProjectId, setBusyProjectId] = useState<string>("");
  const [savingWeekStartId, setSavingWeekStartId] = useState<string>("");

  // Admin create project
  const [newName, setNewName] = useState("");
  const [newWeekStart, setNewWeekStart] = useState<WeekStart>("sunday");
  const [createBusy, setCreateBusy] = useState(false);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);


  const isAdmin = profile?.role === "admin";
  const isManager = profile?.role === "manager";
  const canCreate = isAdmin || isManager;
  const isManagerOrAdmin = isAdmin || isManager;

// Open create drawer when URL has ?new=1 (Phase 1.7 primary action behavior)
useEffect(() => {
  if (!canCreate) return;
  if (newParam === "1") setCreateDrawerOpen(true);
}, [newParam, canCreate]);

function openCreate() {
  if (!canCreate) return;
  setCreateDrawerOpen(true);
  const qs = new URLSearchParams(searchParams.toString());
  qs.set("new", "1");
  router.replace(`/projects?${qs.toString()}`);
}

function closeCreate() {
  setCreateDrawerOpen(false);
  if (newParam === "1") {
    const qs = new URLSearchParams(searchParams.toString());
    qs.delete("new");
    const q = qs.toString();
    router.replace(q ? `/projects?${q}` : "/projects");
  }
}

  // Filters
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  // Phase 1.9: local saved-views scaffolding
  const getViewState = () => ({ q, activeFilter });
  const applyViewState = (s: any) => {
    if (!s || typeof s !== "object") return;
    if (typeof s.q === "string") setQ(s.q);
    if (typeof s.activeFilter === "string") setActiveFilter(s.activeFilter);
  };

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProjectId, setDrawerProjectId] = useState<string>("");
  const [drawerTab, setDrawerTab] = useState<"details" | "members">("details");
  const [drawerMembers, setDrawerMembers] = useState<DrawerMember[]>([]);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [drawerMsg, setDrawerMsg] = useState<string>("");

  // Admin member management inside drawer
  const [orgPeople, setOrgPeople] = useState<Array<{ id: string; full_name: string | null; role: string | null }>>(
    []
  );
  const [memberPickId, setMemberPickId] = useState<string>("");
  const [memberActionBusy, setMemberActionBusy] = useState(false);


  function pill(text: string, tone?: "success" | "warn" | "default") {
    return <Tag tone={tone ?? "default"}>{text}</Tag>;
  }

  function setProjectInUrl(projectId: string) {
    const params = new URLSearchParams();
    if (manageUserId) params.set("user", manageUserId);
    if (projectId) params.set("project", projectId);
    const qs = params.toString();
    router.replace(qs ? `/projects?${qs}` : "/projects");
  }

  async function reloadProjects() {
    if (!profile) return;
    setFetchErr("");

    if (isManagerOrAdmin) {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, is_active, org_id, week_start")
        .eq("org_id", profile.org_id)
        .order("name", { ascending: true });

      if (error) {
        setFetchErr(error.message);
        return;
      }
      setProjects((data || []) as Project[]);
    } else {
      // contractor: only assigned projects
      const { data, error } = await supabase
        .from("project_members")
        .select("project_id, projects:project_id (id, name, is_active, org_id, week_start)")
        .eq("profile_id", profile.id)
        .eq("is_active", true);

      if (error) {
        setFetchErr(error.message);
        return;
      }

      const flattened = (data || []).map((row: any) => row.projects).filter(Boolean) as Project[];
      const uniq = Array.from(new Map(flattened.map((p) => [p.id, p])).values());
      uniq.sort((a, b) => a.name.localeCompare(b.name));
      setProjects(uniq);
    }
  }

  // Initial load
  useEffect(() => {
    if (loading) return;

    if (!userId) {
      router.replace("/login");
      return;
    }

    if (!profile) {
      setFetchErr(profErr || "Profile could not be loaded.");
      return;
    }

    reloadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, userId, profile?.id]);

  // Load org people for drawer (Admin only)
  useEffect(() => {
    if (!profile) return;
    if (!isAdmin) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, is_active")
        .eq("org_id", profile.org_id)
        .order("full_name", { ascending: true });

      if (cancelled) return;
      if (error) return;

      const list = (data || [])
        .filter((p: any) => p.is_active !== false)
        .map((p: any) => ({ id: p.id, full_name: p.full_name ?? null, role: p.role ?? null }));

      setOrgPeople(list);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.org_id, isAdmin]);

  // Load user being managed + membership map (Admin only)
  useEffect(() => {
    if (loading) return;
    if (!profile) return;

    if (!manageUserId) {
      setManageUser(null);
      setMemberMap({});
      return;
    }

    if (!isAdmin) {
      setFetchErr("Only Admin can manage project access.");
      return;
    }

    let cancelled = false;
    (async () => {
      setFetchErr("");

      const { data: u, error: uErr } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", manageUserId)
        .maybeSingle();

      if (cancelled) return;

      if (uErr) {
        setFetchErr(uErr.message);
        return;
      }
      if (!u) {
        setFetchErr("User not found.");
        return;
      }

      setManageUser(u as SimpleProfile);

      const { data: mem, error: memErr } = await supabase
        .from("project_members")
        .select("id, project_id, is_active")
        .eq("org_id", profile.org_id)
        .eq("profile_id", manageUserId);

      if (cancelled) return;

      if (memErr) {
        setFetchErr(memErr.message);
        return;
      }

      const map: Record<string, MemberRow> = {};
      for (const r of (mem as any) ?? []) map[r.project_id] = r;
      setMemberMap(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, profile?.org_id, manageUserId, isAdmin]);

  const assignedProjectIds = useMemo(() => {
    return new Set(
      Object.entries(memberMap)
        .filter(([, v]) => v.is_active)
        .map(([k]) => k)
    );
  }, [memberMap]);

  const filteredProjects = useMemo(() => {
    const query = normalize(q);
    return projects.filter((p) => {
      if (activeFilter === "active" && !p.is_active) return false;
      if (activeFilter === "inactive" && p.is_active) return false;
      if (!query) return true;
      return `${p.name} ${p.id}`.toLowerCase().includes(query);
    });
  }, [projects, q, activeFilter]);

  const counts = useMemo(() => {
    let total = projects.length;
    let active = 0;
    let inactive = 0;
    for (const p of projects) {
      if (p.is_active) active++;
      else inactive++;
    }
    return { total, active, inactive };
  }, [projects]);

  function exportCsv() {
    const header = ["name", "project_id", "is_active"].join(",");
    const lines = filteredProjects.map((p) => {
      const vals = [p.name, p.id, p.is_active ? "true" : "false"].map((v) => `"${String(v).replaceAll('"', '""')}"`);
      return vals.join(",");
    });
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projects_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function toggleAssignment(projectId: string, nextAssigned: boolean) {
    if (!profile) return;
    if (!isAdmin) return;
    if (!manageUserId) return;

    setBusyProjectId(projectId);
    setFetchErr("");

    try {
      const existing = memberMap[projectId];

      if (existing) {
        const { error } = await supabase.from("project_members").update({ is_active: nextAssigned }).eq("id", existing.id);
        if (error) {
          setFetchErr(error.message);
          return;
        }

        setMemberMap((prev) => ({
          ...prev,
          [projectId]: { ...existing, is_active: nextAssigned },
        }));
      } else {
        const payload: any = {
          org_id: profile.org_id,
          project_id: projectId,
          profile_id: manageUserId,
          user_id: manageUserId,
          is_active: true,
        };

        const { data, error } = await supabase
          .from("project_members")
          .insert(payload)
          .select("id, project_id, is_active")
          .single();

        if (error) {
          setFetchErr(error.message);
          return;
        }

        setMemberMap((prev) => ({
          ...prev,
          [projectId]: data as MemberRow,
        }));
      }
    } finally {
      setBusyProjectId("");
    }
  }

  async function createProject(): Promise<boolean> {
    if (!profile) return false;
    if (!isAdmin) return false;

    const name = newName.trim();
    if (name.length < 2) {
      setFetchErr("Project name must be at least 2 characters.");
      return false;
    }

    setCreateBusy(true);
    setFetchErr("");

    try {
      const { error } = await supabase.from("projects").insert({
        org_id: profile.org_id,
        name,
        is_active: true,
        week_start: newWeekStart,
      });

      if (error) {
        setFetchErr(error.message);
        return false;
      }

      setNewName("");
      setNewWeekStart("sunday");
      await reloadProjects();
      return true;
    } finally {
      setCreateBusy(false);
    }
  }

  async function toggleProjectActive(projectId: string, nextActive: boolean) {
    if (!profile) return;
    if (!isAdmin) return;

    setBusyProjectId(projectId);
    setFetchErr("");

    try {
      const { error } = await supabase
        .from("projects")
        .update({ is_active: nextActive })
        .eq("id", projectId)
        .eq("org_id", profile.org_id);

      if (error) {
        setFetchErr(error.message);
        return;
      }

      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, is_active: nextActive } : p)));
    } finally {
      setBusyProjectId("");
    }
  }

  async function updateProjectWeekStart(projectId: string, weekStart: WeekStart) {
    if (!profile) return;
    if (!isAdmin) return;

    try {
      setSavingWeekStartId(projectId);

      const { error } = await supabase
        .from("projects")
        .update({ week_start: weekStart })
        .eq("id", projectId)
        .eq("org_id", profile.org_id);

      if (error) {
        setFetchErr(error.message);
        return;
      }

      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, week_start: weekStart } : p)));
    } finally {
      setSavingWeekStartId("");
    }
  }

  const drawerProject = useMemo(() => {
    if (!drawerProjectId) return null;
    return projects.find((p) => p.id === drawerProjectId) || null;
  }, [drawerProjectId, projects]);

  async function openDrawer(projectId: string) {
    if (!profile) return;

    setDrawerOpen(true);
    setDrawerProjectId(projectId);
    setDrawerTab("details");
    setDrawerMembers([]);
    setDrawerMsg("");
    setMemberPickId("");
    setDrawerBusy(true);

    try {
      const { data, error } = await supabase
        .from("project_members")
        .select("profile_id, is_active, profiles:profile_id(full_name, role)")
        .eq("org_id", profile.org_id)
        .eq("project_id", projectId)
        .eq("is_active", true);

      if (error) {
        setDrawerMsg(error.message);
        return;
      }

      const list: DrawerMember[] = (data || []).map((r: any) => ({
        profile_id: r.profile_id,
        full_name: r.profiles?.full_name ?? null,
        role: r.profiles?.role ?? null,
      }));

      list.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
      setDrawerMembers(list);
    } finally {
      setDrawerBusy(false);
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerProjectId("");
    setDrawerTab("details");
    setDrawerMembers([]);
    setDrawerMsg("");
    setMemberPickId("");
  }

  const drawerMemberIds = useMemo(() => new Set(drawerMembers.map((m) => m.profile_id)), [drawerMembers]);

  const availablePeopleToAdd = useMemo(() => {
    if (!isAdmin) return [];
    return orgPeople.filter((p) => !drawerMemberIds.has(p.id));
  }, [orgPeople, drawerMemberIds, isAdmin]);

  async function addDrawerMember() {
    if (!profile) return;
    if (!isAdmin) return;
    if (!drawerProjectId) return;
    if (!memberPickId) return;

    setMemberActionBusy(true);
    setDrawerMsg("");

    try {
      const { data: existing, error: exErr } = await supabase
        .from("project_members")
        .select("id")
        .eq("org_id", profile.org_id)
        .eq("project_id", drawerProjectId)
        .eq("profile_id", memberPickId)
        .maybeSingle();

      if (exErr) {
        setDrawerMsg(exErr.message);
        return;
      }

      if (existing?.id) {
        const { error } = await supabase.from("project_members").update({ is_active: true }).eq("id", existing.id);
        if (error) {
          setDrawerMsg(error.message);
          return;
        }
      } else {
        const payload: any = {
          org_id: profile.org_id,
          project_id: drawerProjectId,
          profile_id: memberPickId,
          user_id: memberPickId,
          is_active: true,
        };

        const { error } = await supabase.from("project_members").insert(payload);
        if (error) {
          setDrawerMsg(error.message);
          return;
        }
      }

      setMemberPickId("");
      await openDrawer(drawerProjectId);
    } finally {
      setMemberActionBusy(false);
    }
  }

  async function removeDrawerMember(profileId: string) {
    if (!profile) return;
    if (!isAdmin) return;
    if (!drawerProjectId) return;

    setMemberActionBusy(true);
    setDrawerMsg("");

    try {
      const { error } = await supabase
        .from("project_members")
        .update({ is_active: false })
        .eq("org_id", profile.org_id)
        .eq("project_id", drawerProjectId)
        .eq("profile_id", profileId);

      if (error) {
        setDrawerMsg(error.message);
        return;
      }

      await openDrawer(drawerProjectId);
    } finally {
      setMemberActionBusy(false);
    }
  }

  function onProjectRowClick(projectId: string) {
    // ✅ “Select” is now clicking the row
    setProjectInUrl(projectId);

    // ✅ Admin: open drawer on click
    if (isAdmin) openDrawer(projectId);
  }

  // ---- AppShell early returns (must include children!) ----
  if (loading) {
    return (
      <AppShell title="Projects" subtitle="Loading…">
        <div className="card cardPad prShell">
          <div className="muted">Loading…</div>
        </div>
      </AppShell>
    );
  }

  if (!userId) {
    return (
      <AppShell title="Projects" subtitle="Please log in.">
        <div className="card cardPad prShell">
          <div className="muted" style={{ marginBottom: 10 }}>
            You need to log in to view projects.
          </div>
          <button className="btnPrimary" onClick={() => router.push("/login")}>
            Go to Login
          </button>
        </div>
      </AppShell>
    );
  }

  const subtitle = manageUser
    ? `Managing project access for ${manageUser.full_name || manageUser.id}`
    : isAdmin
      ? "Admin view (org projects)"
      : isManagerOrAdmin
        ? "Manager view (org projects)"
        : "Your assigned projects";

  const headerRight = (
    <div className="prHeaderRight">
      <span className="badge">{counts.active} active</span>
      <span className="badge">{counts.inactive} inactive</span>
      <span className="badge">{counts.total} total</span>
    </div>
  );

  return (
    <AppShell title="Projects" subtitle={subtitle} right={headerRight}>
      {fetchErr ? (
        <div className="alert alertWarn">
          <b>Notice</b>
          <div style={{ marginTop: 6 }}>{fetchErr}</div>
        </div>
      ) : null}

      {/* Admin: create project moved into Drawer for Monday-style UX */}

      <div style={{ maxWidth: 1100, marginTop: 12 }}>
        {projects.length === 0 && !fetchErr ? (
          <div className="card cardPad" style={{ marginBottom: 12 }}>
            <EmptyState
              title={isAdmin ? "No projects yet" : "No assigned projects"}
              description={
                isAdmin
                  ? "Create your first project to start assigning work."
                  : "Ask your manager or admin to assign you to a project."
              }
              action={
                isAdmin ? (
                  <Button variant="primary" onClick={() => setCreateDrawerOpen(true)}>
                    Create project
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={reloadProjects}>
                    Refresh
                  </Button>
                )
              }
            />
          </div>
        ) : null}

        <CommandBar
          views={
            <SavedViews
              storageKey="projects"
              getState={getViewState}
              applyState={applyViewState}
              defaultViews={[
                { id: "all", label: "All projects", state: { q: "", activeFilter: "all" } },
                { id: "active", label: "Active", state: { q: "", activeFilter: "active" } },
                { id: "inactive", label: "Inactive", state: { q: "", activeFilter: "inactive" } },
              ]}
            />
          }
          left={
            <>
              <div className="peopleSearch">
                <Search size={16} />
                <input name="project_search" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or ID…" />
              </div>

              <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  className="select"
                  name="project_filter_status"
                  aria-label="Project status filter"
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
                  style={{ width: 170 }}
                >
                  <option value="all">All</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQ("");
                    setActiveFilter("all");
                  }}
                >
                  Clear
                </Button>
              </div>
            </>
          }
          right={
            <>
              {manageUser ? pill("Assignment mode", "success") : null}
              {/* Selection is shown in the table via row highlight (not a pill/tag). */}
              {/* Primary action moved to page header (Phase 1.7) */}
              <Button type="button" onClick={reloadProjects}>
                Refresh
              </Button>

              <ActionMenu
                items={[
                  { label: "Export CSV", onSelect: exportCsv },
                  {
                    label: "Copy visible JSON",
                    onSelect: async () => {
                      try {
                        await navigator.clipboard.writeText(JSON.stringify(filteredProjects, null, 2));
                        setFetchErr("Copied visible rows to clipboard.");
                        setTimeout(() => setFetchErr(""), 2000);
                      } catch {
                        setFetchErr("Clipboard blocked.");
                        setTimeout(() => setFetchErr(""), 2000);
                      }
                    },
                  },
                ]}
              />
            </>
          }
          message={fetchErr ? <span>{fetchErr}</span> : null}
          sticky
        />

        <DataTable
          rows={filteredProjects}
          rowKey={(p) => p.id}
          selectedRowId={selectedProjectId || undefined}
          onRowClick={(p) => onProjectRowClick(p.id)}
          emptyTitle="No projects"
          emptySubtitle="Create a project or adjust filters."
          actions={(p) => {
            const items: any[] = [
              {
                label: isAdmin ? "Open" : "Select",
                onSelect: () => onProjectRowClick(p.id),
              },
              {
                label: "Copy project ID",
                onSelect: async () => {
                  try {
                    await navigator.clipboard.writeText(p.id);
                  } catch {}
                },
              },
            ];
            if (isAdmin) {
              items.push({
                label: p.is_active ? "Deactivate" : "Activate",
                onSelect: () => toggleProjectActive(p.id, !p.is_active),
              });
            }
            return items;
          }}
          columns={[
            {
              key: "name",
              header: "Project",
              cell: (p) => (
                <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 950 }}>{p.name || "Untitled"}</span>
                    <Tag tone={p.is_active ? "success" : "warn"}>{p.is_active ? "active" : "inactive"}</Tag>
                    {/* Selected state is shown via row highlight */}
                  </div>
                  <div className="muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {weekStartLabel(p.week_start)} • <span className="mono">{p.id}</span>
                  </div>
                </div>
              ),
            },
            {
              key: "week",
              header: "Week start",
              width: 160,
              cell: (p) =>
                isAdmin ? (
                  <select
                    className="select"
                    name={`project_week_start_${p.id}`}
                    aria-label="Week start"
                    value={(p.week_start || "sunday") as WeekStart}
                    disabled={savingWeekStartId === p.id}
                    onChange={(e) => updateProjectWeekStart(p.id, e.target.value as WeekStart)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="sunday">Sunday</option>
                    <option value="monday">Monday</option>
                  </select>
                ) : (
                  <span>{(p.week_start || "sunday") === "monday" ? "Monday" : "Sunday"}</span>
                ),
            },
            {
              key: "assign",
              header: "Assigned",
              width: 140,
              cell: (p) => {
                if (!manageUser || !isAdmin) return <span className="muted">—</span>;
                const assigned = assignedProjectIds.has(p.id);
                return (
                  <label style={{ display: "flex", gap: 10, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      name={`project_assigned_${p.id}`}
                      aria-label="Assigned"
                      checked={assigned}
                      disabled={busyProjectId === p.id}
                      onChange={(e) => toggleAssignment(p.id, e.target.checked)}
                    />
                    <span className="muted" style={{ fontSize: 12 }}>
                      {busyProjectId === p.id ? "Saving…" : assigned ? "Yes" : "No"}
                    </span>
                  </label>
                );
              },
            },
            {
              key: "toggle",
              header: "",
              width: 140,
              cell: (p) =>
                isAdmin ? (
                  <button
                    type="button"
                    className={p.is_active ? "pill" : "btnPrimary"}
                    disabled={busyProjectId === p.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProjectActive(p.id, !p.is_active);
                    }}
                  >
                    {busyProjectId === p.id ? "Saving…" : p.is_active ? "Deactivate" : "Activate"}
                  </button>
                ) : (
                  <span />
                ),
            },
          ]}
        />
      </div>
      {/* Drawer */}
      <Drawer
        open={drawerOpen && !!drawerProject}
        onClose={closeDrawer}
        title={drawerProject?.name || "Project"}
        subtitle={
          drawerProject
            ? `${drawerProject.is_active ? "Active" : "Inactive"} • ${weekStartLabel(drawerProject.week_start)}`
            : undefined
        }
        footer={
          <>
            <button className="pill" onClick={closeDrawer}>
              Close
            </button>
          </>
        }
        tabs={
          drawerProject
            ? [
                { key: "details", label: "Details" },
                { key: "members", label: "Members", count: drawerMembers.length },
              ]
            : []
        }
        activeTab={drawerTab}
        onTabChange={(k) => setDrawerTab(k === "members" ? "members" : "details")}
      >
        {!drawerProject ? null : drawerTab === "details" ? (
          <div style={{ display: "grid", gap: 12 }}>
            {drawerMsg ? (
              <div className="alert alertWarn">
                <b>Notice</b>
                <div style={{ marginTop: 6 }}>{drawerMsg}</div>
              </div>
            ) : null}

            <div className="card cardPad" style={{ boxShadow: "none" }}>
              <FormField
                label="Project ID"
                helpText="Use this ID for linking and audit history."
                helpMode="tooltip"
                hintRight={
                  <button className="pill" onClick={() => copyToClipboard(drawerProject.id)}>
                    Copy
                  </button>
                }
              >
                {({ id, describedBy }) => (
                  <div id={id} aria-describedby={describedBy} className="mono" style={{ padding: "10px 12px" }}>
                    {drawerProject.id}
                  </div>
                )}
              </FormField>

              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Week start" helpText="Controls weekly rollups and approvals." helpMode="tooltip">
                  {({ id, describedBy }) =>
                    isAdmin ? (
                      <select
                        id={id}
                        aria-describedby={describedBy}
                        className="select"
                        value={(drawerProject.week_start || "sunday") as WeekStart}
                        onChange={(e) => updateProjectWeekStart(drawerProject.id, e.target.value as WeekStart)}
                      >
                        <option value="sunday">Sunday</option>
                        <option value="monday">Monday</option>
                      </select>
                    ) : (
                      <div id={id} aria-describedby={describedBy} style={{ padding: "10px 12px" }}>
                        {weekStartLabel(drawerProject.week_start)}
                      </div>
                    )
                  }
                </FormField>

                <FormField label="Status" helpText="Inactive projects are hidden from new entries." helpMode="tooltip">
                  {({ id, describedBy }) => (
                    <div id={id} aria-describedby={describedBy} className="row" style={{ gap: 10, alignItems: "center" }}>
                      <Tag tone={drawerProject.is_active ? "success" : "warn"}>
                        {drawerProject.is_active ? "active" : "inactive"}
                      </Tag>
                      {isAdmin ? (
                        <button
                          className={drawerProject.is_active ? "pill" : "btnPrimary"}
                          onClick={() => toggleProjectActive(drawerProject.id, !drawerProject.is_active)}
                        >
                          {drawerProject.is_active ? "Deactivate" : "Activate"}
                        </button>
                      ) : null}
                    </div>
                  )}
                </FormField>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {drawerBusy ? <div className="muted">Loading members…</div> : null}

            {!drawerBusy && drawerMembers.length === 0 ? <div className="muted">No members assigned yet.</div> : null}

            <div className="card" style={{ overflow: "hidden", boxShadow: "none" }}>
              <div style={{ padding: 12, display: "grid", gap: 10 }}>
                {drawerMembers.map((m) => (
                  <div key={m.profile_id} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {m.full_name || "(no name)"}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {m.role || "user"} • <span className="mono">{m.profile_id}</span>
                      </div>
                    </div>

                    {isAdmin ? (
                      <button
                        className="pill"
                        disabled={memberActionBusy}
                        onClick={() => removeDrawerMember(m.profile_id)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {isAdmin ? (
              <div className="card cardPad" style={{ boxShadow: "none" }}>
                <FormField label="Add member" helpText="Add a person to this project." helpMode="tooltip">
                  {({ id, describedBy }) => (
                    <div
                      aria-describedby={describedBy}
                      style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}
                    >
                      <select
                        id={id}
                        className="select"
                        value={memberPickId}
                        onChange={(e) => setMemberPickId(e.target.value)}
                      >
                        <option value="">Select a person…</option>
                        {availablePeopleToAdd.map((p) => (
                          <option key={p.id} value={p.id}>
                            {(p.full_name || "(no name)") + (p.role ? ` • ${p.role}` : "")}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btnPrimary"
                        disabled={!memberPickId || memberActionBusy}
                        onClick={addDrawerMember}
                      >
                        {memberActionBusy ? "Saving…" : "Add"}
                      </button>
                    </div>
                  )}
                </FormField>

                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  Tip: People → “Manage projects” enables bulk assignment mode.
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Drawer>

      {/* Create Project Drawer (Admin) */}
      <Drawer
        open={createDrawerOpen}
        onClose={closeCreate}
        title="New project"
        subtitle="Create a project for your org"
        footer={
          <>
            <button className="pill" type="button" onClick={() => setCreateDrawerOpen(false)} disabled={createBusy}>
              Cancel
            </button>
            <button
              className="btnPrimary"
              type="button"
              onClick={async () => {
                const ok = await createProject();
                if (ok) setCreateDrawerOpen(false);
              }}
              disabled={createBusy || !newName.trim()}
            >
              {createBusy ? "Creating…" : "Create"}
            </button>
          </>
        }
      >
        {!isAdmin ? (
          <div className="muted">Only admins can create projects.</div>
        ) : (
          <div className="card cardPad" style={{ boxShadow: "none" }}>
            <div style={{ display: "grid", gap: 12 }}>
              <FormField label="Project name" helpText="Shown in timesheets and reports." helpMode="tooltip">
                {({ id, describedBy }) => (
                  <input
                    id={id}
                    name="project_name"
                    aria-describedby={describedBy}
                    className="input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Store remodel"
                    autoComplete="off"
                  />
                )}
              </FormField>

              <FormField label="Week start" helpText="Controls weekly rollups and approvals." helpMode="tooltip">
                {({ id, describedBy }) => (
                  <select
                    id={id}
                    name="project_week_start"
                    aria-describedby={describedBy}
                    className="select"
                    value={newWeekStart}
                    onChange={(e) => setNewWeekStart(e.target.value as WeekStart)}
                  >
                    <option value="sunday">Sunday</option>
                    <option value="monday">Monday</option>
                  </select>
                )}
              </FormField>

              <div className="muted" style={{ fontSize: 12 }}>
                Tip: Create the project first, then add members in the Project drawer.
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </AppShell>
  );
}