"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseBrowser";
import { Search } from "lucide-react";
import Drawer from "../ui/Drawer";
import Button from "../ui/Button";
import FormField from "../ui/FormField";

type Role = "admin" | "manager" | "contractor";

export type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  manager_id: string | null;
  hourly_rate: number;
  is_active: boolean;
  last_sign_in_at: string | null;
};

type Project = { id: string; name: string | null; is_active: boolean };

export default function UserDrawer({
  open,
  onClose,
  user,
  managers,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  user: UserRow | null;
  managers: { id: string; full_name: string | null }[];
  onSaved: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"profile" | "projects">("profile");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Profile form state
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("contractor");
  const [managerId, setManagerId] = useState<string>("");
  const [rate, setRate] = useState<number>(0);
  const [active, setActive] = useState<boolean>(true);

  // Access state
  const [projects, setProjects] = useState<Project[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const [projQuery, setProjQuery] = useState("");

  useEffect(() => {
    if (!open || !user) return;

    setMsg("");
    setSaving(false);

    setFullName(user.full_name || "");
    setRole(user.role);
    setManagerId(user.manager_id || "");
    setRate(Number(user.hourly_rate || 0));
    setActive(!!user.is_active);

    setActiveTab("profile");
  }, [open, user]);

  // Load projects + membership when drawer opens
  useEffect(() => {
    if (!open || !user) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setMsg("");
      try {
        const { data: prof, error: profErr } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
        if (profErr) throw profErr;

        const org_id = (prof as any)?.org_id;
        if (!org_id) throw new Error("Missing org_id");

        const [{ data: projs, error: pErr }, { data: members, error: mErr }] = await Promise.all([
          supabase.from("projects").select("id, name, is_active").eq("org_id", org_id).order("name", { ascending: true }),
          supabase.from("project_members").select("project_id").eq("org_id", org_id).eq("user_id", user.id),
        ]);

        if (pErr) throw pErr;
        if (mErr) throw mErr;

        if (cancelled) return;

        setProjects((projs as any) ?? []);
        setMemberIds(new Set(((members as any) ?? []).map((r: any) => r.project_id)));
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message || "Failed to load user access");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const title = useMemo(() => {
    if (!user) return "";
    return user.full_name || user.email || user.id;
  }, [user]);

  const subtitle = useMemo(() => {
    if (!user) return "";
    return `${user.email || "—"} • ${user.id.slice(0, 8)}…`;
  }, [user]);

  const filteredProjects = useMemo(() => {
    const q = projQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => ((p.name || "").toLowerCase().includes(q) || p.id.toLowerCase().includes(q)));
  }, [projects, projQuery]);

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    setMsg("");
    try {
      const payload: any = {
        full_name: fullName.trim() || null,
        role,
        hourly_rate: Number(rate || 0),
        is_active: !!active,
        manager_id: role === "contractor" ? (managerId || null) : null,
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;

      setMsg("Saved ✅");
      onSaved();
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleProject(project_id: string, checked: boolean) {
    if (!user) return;
    setMsg("");
    // optimistic UI
    setMemberIds((prev) => {
      const n = new Set(prev);
      if (checked) n.add(project_id);
      else n.delete(project_id);
      return n;
    });

    try {
      const { data: prof, error: profErr } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
      if (profErr) throw profErr;

      const org_id = (prof as any)?.org_id;
      if (!org_id) throw new Error("Missing org_id");

      if (checked) {
        const { error } = await supabase
          .from("project_members")
          .upsert([{ org_id, project_id, user_id: user.id, profile_id: user.id, is_active: true }] as any, { onConflict: "project_id,user_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_members").delete().eq("org_id", org_id).eq("project_id", project_id).eq("user_id", user.id);
        if (error) throw error;
      }

      onSaved();
    } catch (e: any) {
      // revert on error
      setMemberIds((prev) => {
        const n = new Set(prev);
        if (checked) n.delete(project_id);
        else n.add(project_id);
        return n;
      });
      setMsg(e?.message || "Update access failed");
    }
  }

  async function clearAllAccess() {
    if (!user) return;
    if (memberIds.size === 0) return;

    setMsg("");
    try {
      const { data: prof, error: profErr } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
      if (profErr) throw profErr;

      const org_id = (prof as any)?.org_id;
      if (!org_id) throw new Error("Missing org_id");

      const { error } = await supabase.from("project_members").delete().eq("org_id", org_id).eq("user_id", user.id);
      if (error) throw error;

      setMemberIds(new Set());
      onSaved();
      setMsg("Access cleared ✅");
    } catch (e: any) {
      setMsg(e?.message || "Failed to clear access");
    }
  }

  const tabs = useMemo(
    () => [
      { key: "profile", label: "Profile" },
      { key: "projects", label: "Projects" },
    ],
    []
  );

  if (!open || !user) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(k) => setActiveTab(k as any)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Close
          </Button>
          <Button variant="primary" onClick={saveProfile} disabled={saving} type="button">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      {msg ? (
        <div className="card cardPad" style={{ marginBottom: 12 }}>
          <div className="muted">{msg}</div>
        </div>
      ) : null}

      {activeTab === "profile" ? (
        <div className="card cardPad" style={{ marginBottom: 12 }}>
          <div className="drawerSectionTitle">User details</div>
          <div className="drawerHelp">Edit role, manager, rate, and status.</div>

          <FormField label="Full name" helpText="Shown across the app and on reports." helpMode="tooltip">
            {({ id, describedBy }) => (
              <input id={id} aria-describedby={describedBy} className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            )}
          </FormField>

          <div className="row" style={{ gap: 12, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <FormField label="Role" helpText="Managers can see their direct reports." helpMode="tooltip">
                {({ id, describedBy }) => (
                  <select id={id} aria-describedby={describedBy} className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    <option value="contractor">Contractor</option>
                    <option value="manager">Manager</option>
                  </select>
                )}
              </FormField>
            </div>

            <div style={{ width: 180 }}>
              <FormField label="Hourly rate" helpText="Used for cost calculations." helpMode="tooltip">
                {({ id, describedBy }) => (
                  <input
                    id={id}
                    aria-describedby={describedBy}
                    className="input"
                    value={String(rate)}
                    onChange={(e) => setRate(Number(e.target.value))}
                    inputMode="decimal"
                  />
                )}
              </FormField>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <FormField
              label="Assign manager"
              helpText={role !== "contractor" ? "Only contractors have an assigned manager." : "Controls who can view this contractor."}
              helpMode="tooltip"
            >
              {({ id, describedBy }) => (
                <select
                  id={id}
                  aria-describedby={describedBy}
                  className="input"
                  disabled={role !== "contractor"}
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                >
                  <option value="">—</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {(m.full_name || "Manager") + " (" + m.id.slice(0, 6) + "…)"}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="drawerSectionTitle">Status</div>
            <div className="statusRow">
              <div className="statusLeft">
                <div className="statusLabel">{active ? "Active" : "Inactive"}</div>
                <div className="statusSub">{active ? "User can sign in and log time." : "User is disabled and cannot access the app."}</div>
              </div>

              <button
                type="button"
                className={`switch ${active ? "switchOn" : ""}`}
                onClick={() => setActive((v) => !v)}
                aria-label="Toggle active"
              >
                <span className="switchKnob" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "projects" ? (
        <div className="card cardPad">
          <div className="drawerSectionTitle">Project access</div>
          <div className="drawerHelp">Select projects to assign immediately.</div>

          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <span className="mwTag mwTag-default">{memberIds.size} project{memberIds.size === 1 ? "" : "s"}</span>
            <div style={{ flex: 1 }} />
            <button className="btnGhost" type="button" onClick={clearAllAccess} disabled={memberIds.size === 0}>
              Clear access
            </button>
          </div>

          <div style={{ marginTop: 10, position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 12, opacity: 0.7 }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Search projects…"
              value={projQuery}
              onChange={(e) => setProjQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="muted" style={{ marginTop: 12 }}>
              Loading…
            </div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {filteredProjects.map((p) => {
                const checked = memberIds.has(p.id);
                return (
                  <label key={p.id} className="pmRow2">
                    <input type="checkbox" checked={checked} onChange={(e) => toggleProject(p.id, e.target.checked)} />
                    <div style={{ minWidth: 0 }}>
                      <div className="pmTitle2">{p.name || "Untitled project"}</div>
                      <div className="pmMeta2">{p.id}</div>
                    </div>
                    <div className="pmBadgeWrap">
                      <span className={`tag ${p.is_active ? "tagOk" : "tagWarn"}`}>{p.is_active ? "Active" : "Inactive"}</span>
                    </div>
                  </label>
                );
              })}

              {filteredProjects.length === 0 ? (
                <div className="muted" style={{ padding: "10px 2px" }}>
                  No projects match your search.
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}
