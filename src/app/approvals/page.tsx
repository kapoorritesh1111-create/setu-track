// src/app/approvals/page.tsx
"use client";

import RequireOnboarding from "../../components/auth/RequireOnboarding";
import AppShell from "../../components/layout/AppShell";
import { apiJson } from "../../lib/api/client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";
import { addDays, parseISODate, startOfWeekSunday, toISODate, weekRangeLabel } from "../../lib/date";
import Drawer from "../../components/ui/Drawer";
import { StatusChip } from "../../components/ui/StatusChip";
import ActionMenu from "../../components/ui/ActionMenu";
import WorkspaceKpiStrip from "../../components/setu/WorkspaceKpiStrip";

type EntryStatus = "draft" | "submitted" | "approved" | "rejected";

type EntryRow = {
  id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  project_id: string;
  notes: string | null;
  status: EntryStatus;

  hours_worked: number | null; // from v_time_entries
  full_name?: string | null; // optional from v_time_entries
  project_name?: string | null; // optional from v_time_entries
};

type ProfileRow = { id: string; full_name: string | null; role: string | null; manager_id?: string | null };
type ProjectRow = { id: string; name: string };

type GroupKey = string;
type Group = {
  key: GroupKey;
  user_id: string;
  contractor_name: string;
  week_start: string; // YYYY-MM-DD
  week_end: string;   // YYYY-MM-DD
  entries: EntryRow[];
  project_count?: number;
  day_count?: number;
  total_hours?: number;
  anomalies?: string[];
  notes_history?: Array<{ at: string; actor_name: string | null; note: string | null; action: string }>;
};

type QueuePayload = {
  ok: true;
  groups: Group[];
  totals: { groups: number; entries: number; hours: number; flagged_groups: number };
};

// Use unified StatusChip instead of page-local pills.

function ApprovalsLoading() {
  return (
    <AppShell title="Approvals" subtitle="Submitted timesheets">
      <div className="card cardPad" style={{ maxWidth: 1100 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div className="skeleton" style={{ height: 16, width: 220 }} />
          <div className="skeleton" style={{ height: 44, width: "100%" }} />
          <div className="skeleton" style={{ height: 280, width: "100%" }} />
        </div>
      </div>
    </AppShell>
  );
}

function normalize(s: string) {
  return (s || "").trim().toLowerCase();
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

async function fetchPayPeriodStatus(period_start: string, period_end: string) {
  const token = await getAccessToken();
  const qs = new URLSearchParams({ period_start, period_end });
  const res = await fetch(`/api/pay-period/status?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `Request failed (${res.status})`);
  return data as { ok: boolean; locked: boolean; locked_at: string | null; locked_by: string | null };
}

function ApprovalsInner() {
  const { loading: profLoading, profile, userId, error: profErr } = useProfile();

  const isAdmin = profile?.role === "admin";
  const isManager = profile?.role === "manager";
  const isManagerOrAdmin = isAdmin || isManager;

  // Focus week (used when not in "all pending" mode)
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekSunday(new Date()));
  const weekStartISO = useMemo(() => toISODate(weekStart), [weekStart]);
  const weekEndISO = useMemo(() => toISODate(addDays(weekStart, 6)), [weekStart]);

  // View controls
  const [showAllPending, setShowAllPending] = useState(false); // last N weeks of submitted entries
  const [selectedGroups, setSelectedGroups] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [queueFilter, setQueueFilter] = useState<"all" | "flagged" | "locked">("all");

  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [queueTotals, setQueueTotals] = useState<{ groups: number; entries: number; hours: number; flagged_groups: number }>({ groups: 0, entries: 0, hours: 0, flagged_groups: 0 });
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [projects, setProjects] = useState<Record<string, ProjectRow>>({});
  const [msg, setMsg] = useState("");
  const [busyKey, setBusyKey] = useState<string>("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [lockByRange, setLockByRange] = useState<Record<string, { locked: boolean; locked_at: string | null; locked_by: string | null }>>({});

  // Reject drawer
  const [rejecting, setRejecting] = useState<Group | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");

  useEffect(() => {
    if (!userId || !profile || !isManagerOrAdmin) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setMsg("");

      try {
        const params = new URLSearchParams();
        params.set("all_pending", showAllPending ? "1" : "0");
        params.set("week_start", weekStartISO);
        params.set("week_end", weekEndISO);
        if (search.trim()) params.set("q", search.trim());

        const payload = await apiJson<QueuePayload>(`/api/approvals/queue?${params.toString()}`);
        if (cancelled) return;
        setGroups(payload.groups || []);
        setQueueTotals(payload.totals || { groups: 0, entries: 0, hours: 0, flagged_groups: 0 });
      } catch (e: any) {
        if (!cancelled) {
          setMsg(e?.message || "Failed to load approvals.");
          setGroups([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, profile, isManagerOrAdmin, weekStartISO, weekEndISO, showAllPending, search]);

  function displayName(uid: string, sample?: EntryRow) {
    return sample?.full_name || (sample as any)?.contractor_name || profiles[uid]?.full_name || uid.slice(0, 8);
  }

  function projectLabel(project_id: string, sample?: EntryRow) {
    return sample?.project_name || projects[project_id]?.name || project_id.slice(0, 8);
  }

  function groupTotalHours(g: Group) {
    return g.entries.reduce((acc, e) => acc + Number(e.hours_worked ?? 0), 0);
  }

  function groupDaysSummary(g: Group) {
    const byDate = new Map<string, number>();
    for (const e of g.entries) {
      byDate.set(e.entry_date, (byDate.get(e.entry_date) ?? 0) + Number(e.hours_worked ?? 0));
    }
    return Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }

  async function approveGroup(g: Group) {
    const rangeKey = `${g.week_start}__${g.week_end}`;
    if (lockByRange[rangeKey]?.locked) {
      setMsg("This pay period is locked. You can’t approve entries in this range.");
      return;
    }
    if (!confirm(`Approve ${displayName(g.user_id, g.entries[0])} for week ${g.week_start} → ${g.week_end}?`)) return;
    const note = window.prompt("Approval note (optional)", "") ?? "";

    setBusyKey(g.key);
    setMsg("");

    try {
      await apiJson("/api/approvals/batch-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ user_id: g.user_id, week_start: g.week_start, week_end: g.week_end }], note }),
      });

      setGroups((prev) => prev.filter((x) => x.key !== g.key));
      setMsg("Approved ✅");
    } finally {
      setBusyKey("");
    }
  }

  async function rejectGroup(g: Group) {
    setRejecting(g);
    setRejectReason("");
  }

  async function confirmReject() {
    if (!rejecting) return;

    const g = rejecting;
    const rangeKey = `${g.week_start}__${g.week_end}`;
    if (lockByRange[rangeKey]?.locked) {
      setMsg("This pay period is locked. You can’t reject entries in this range.");
      return;
    }

    const name = displayName(g.user_id, g.entries[0]);
    const reason = rejectReason.trim();

    if (!reason) {
      setMsg("Reject reason is required.");
      return;
    }
    if (reason.length < 4) {
      setMsg("Reject reason is too short.");
      return;
    }

    setBusyKey(g.key);
    setMsg("");

    try {
      const { error } = await supabase
        .from("time_entries")
        .update({ status: "rejected", rejection_reason: reason })
        .eq("user_id", g.user_id)
        .gte("entry_date", g.week_start)
        .lte("entry_date", g.week_end)
        .eq("status", "submitted");

      if (error) {
        setMsg(error.message);
        return;
      }

      setGroups((prev) => prev.filter((x) => x.key !== g.key));
      setMsg(`Rejected: ${name} ✅`);
      setRejecting(null);
      setRejectReason("");
    } finally {
      setBusyKey("");
    }
  }

  const visibleGroups = useMemo(() => {
    return groups.filter((group) => {
      if (queueFilter === "flagged") return (group.anomalies?.length || 0) > 0;
      if (queueFilter === "locked") {
        const key = `${group.week_start}__${group.week_end}`;
        return !!lockByRange[key]?.locked;
      }
      return true;
    });
  }, [groups, queueFilter, lockByRange]);

const selectedEntryIds = useMemo(() => {
  const ids: string[] = [];
  for (const g of visibleGroups) {
    if (selectedGroups[g.key]) {
      for (const e of g.entries) ids.push(e.id);
    }
  }
  return ids;
}, [visibleGroups, selectedGroups]);

async function approveSelected() {
  if (!selectedEntryIds.length) return;
  try {
    setBusyKey("batch");
    setMsg("");
    const note = window.prompt("Approval note (optional)", "") ?? "";
    await apiJson("/api/approvals/batch-approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry_ids: selectedEntryIds, note }),
    });
    setSelectedGroups({});
    setGroups((prev) => prev.filter((group) => !selectedGroups[group.key]));
  } catch (e: any) {
    setMsg(e?.message || "Failed to approve selected");
  } finally {
    setBusyKey("");
  }
}

// Fetch lock status for the week ranges currently visible in the queue.
useEffect(() => {
  if (!profile || !userId) return;
  const uniqueRanges = Array.from(
    new Set(visibleGroups.map((g) => `${g.week_start}__${g.week_end}`))
  );

  if (uniqueRanges.length === 0) return;

  let cancelled = false;

  (async () => {
    try {
      const updates: Record<string, { locked: boolean; locked_at: string | null; locked_by: string | null }> = {};
      await Promise.all(
        uniqueRanges.slice(0, 30).map(async (k) => {
          const [period_start, period_end] = k.split("__");
          const r = await fetchPayPeriodStatus(period_start, period_end);
          updates[k] = { locked: !!r.locked, locked_at: r.locked_at ?? null, locked_by: r.locked_by ?? null };
        })
      );
      if (cancelled) return;
      setLockByRange((prev) => ({ ...prev, ...updates }));
    } catch (e) {
      // Ignore lock status failures; DB trigger will still enforce.
    }
  })();

  return () => {
    cancelled = true;
  };
}, [visibleGroups, profile, userId]);



  const headerRight = (
    <div className="apHeaderRight">
      <div className="apToolbar">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className={`pill ${queueFilter === "all" ? "ok" : ""}`} onClick={() => setQueueFilter("all")} type="button">All</button>
          <button className={`pill ${queueFilter === "flagged" ? "ok" : ""}`} onClick={() => setQueueFilter("flagged")} type="button">Flagged</button>
          <button className={`pill ${queueFilter === "locked" ? "ok" : ""}`} onClick={() => setQueueFilter("locked")} type="button">Locked</button>
        </div>
        <label className="apToggle">
          <input
            type="checkbox"
            checked={showAllPending}
            onChange={(e) => setShowAllPending(e.target.checked)}
            disabled={!!busyKey || loading}
          />
          <span>All pending (last 8 weeks)</span>
        </label>

        <div className="apWeekNav" aria-hidden={showAllPending}>
          <button
            className="pill"
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            disabled={showAllPending || !!busyKey || loading}
            title="Previous week"
          >
            ← Prev
          </button>
          <button
            className="pill"
            onClick={() => setWeekStart(startOfWeekSunday(new Date()))}
            disabled={showAllPending || !!busyKey || loading}
            title="This week"
          >
            This week
          </button>
          <button
            className="pill"
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            disabled={showAllPending || !!busyKey || loading}
            title="Next week"
          >
            Next →
          </button>
        </div>

        <input
          className="apSearch"
          placeholder="Search person…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={!!busyKey || loading}
        />

{selectedEntryIds.length ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              className="pill"
              type="button"
              onClick={() => setSelectedGroups({})}
              disabled={!!busyKey || loading}
              title="Clear selection"
            >
              Clear selection
            </button>
            <button
              className="btn btnPrimary"
              type="button"
              onClick={approveSelected}
              disabled={busyKey === "batch" || loading}
              title="Approve selected entries"
            >
              {busyKey === "batch" ? "Approving…" : `Approve selected (${selectedEntryIds.length})`}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (profLoading) return <ApprovalsLoading />;

  if (!userId) {
    return (
      <AppShell title="Approvals" subtitle="Please log in">
        <div className="alert alertWarn">
          <div style={{ fontWeight: 950 }}>Session required</div>
          <div className="muted" style={{ marginTop: 6 }}>Please log in again.</div>
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell title="Approvals" subtitle="Profile missing">
        <div className="alert alertWarn">
          <div style={{ fontWeight: 950 }}>Logged in, but profile could not be loaded</div>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{profErr || "No details."}</pre>
        </div>
      </AppShell>
    );
  }

  if (!isManagerOrAdmin) {
    return (
      <AppShell title="Approvals" subtitle="Manager/Admin only">
        <div className="alert alertWarn">
          <div style={{ fontWeight: 950 }}>Access restricted</div>
          <div className="muted" style={{ marginTop: 6 }}>This page is only for managers and admins.</div>
        </div>
      </AppShell>
    );
  }

  const subtitle = showAllPending ? "All pending submissions (last 8 weeks)" : `${weekRangeLabel(weekStart)} • Submitted timesheets`;

  return (
    <AppShell title="Approvals" subtitle={subtitle} right={headerRight}>
      <Drawer
        open={!!rejecting}
        onClose={() => {
          if (busyKey) return;
          setRejecting(null);
          setRejectReason("");
        }}
        title="Reject timesheet"
        subtitle={rejecting ? `${displayName(rejecting.user_id, rejecting.entries[0])} • ${rejecting.week_start} → ${rejecting.week_end}` : undefined}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              className="btn btnSecondary"
              onClick={() => {
                setRejecting(null);
                setRejectReason("");
              }}
              disabled={!!busyKey}
              type="button"
            >
              Cancel
            </button>
            <button className="btn btnDanger" onClick={confirmReject} disabled={!!busyKey} type="button">
              {busyKey ? "Working…" : "Reject"}
            </button>
          </div>
        }
      >
        <div className="field">
          <div className="label">Reason (required)</div>
          <textarea
            className="input"
            rows={5}
            placeholder="Explain what needs to be corrected (e.g., missing project, time-in/time-out mismatch, add notes, etc.)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            disabled={!!busyKey}
          />
          <div className="hint">This reason will be shown to the contractor.</div>
        </div>
      </Drawer>

      {msg ? (
        <div className="alert alertInfo">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg}</pre>
        </div>
      ) : null}

      
      <WorkspaceKpiStrip
        items={[
          { label: "Approval groups", value: String(queueTotals.groups), hint: showAllPending ? "Last 8 weeks" : `${weekStartISO} → ${weekEndISO}` },
          { label: "Submitted entries", value: String(queueTotals.entries), hint: "Awaiting manager review" },
          { label: "Hours pending", value: queueTotals.hours.toFixed(2), hint: "Submitted hours in queue" },
          { label: "Flagged groups", value: String(queueTotals.flagged_groups), hint: "Anomaly watchlist" },
          { label: "Locked ranges", value: String(Object.values(lockByRange).filter((item) => item?.locked).length), hint: "Periods already locked" },
        ]}
      />

      <div className="card cardPad" style={{ marginTop: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Queue focus</div>
            <div className="muted" style={{ marginTop: 4 }}>Use filters to isolate flagged or locked groups before taking action.</div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="pill">View: {queueFilter}</span>
            <span className="pill">Visible groups: {visibleGroups.length}</span>
          </div>
        </div>
      </div>

<div className="apQueueSummary">
        <div className="apQueueMetric"><span>Groups</span><strong>{queueTotals.groups}</strong></div>
        <div className="apQueueMetric"><span>Entries</span><strong>{queueTotals.entries}</strong></div>
        <div className="apQueueMetric"><span>Hours</span><strong>{queueTotals.hours.toFixed(2)}</strong></div>
        <div className="apQueueMetric"><span>Flagged</span><strong>{queueTotals.flagged_groups}</strong></div>
      </div>

      {loading ? (
        <div className="card cardPad" style={{ marginTop: 14 }}>
          <div className="muted">Loading approvals…</div>
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="card cardPad" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 950 }}>Nothing to approve</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {isAdmin ? "No submitted time entries in the selected scope." : "No submitted time entries from your direct reports in the selected scope."}
          </div>
        </div>
      ) : (
        <div className="apGroups">
          {visibleGroups.map((g) => {
            const sample = g.entries[0];
            const rangeKey = `${g.week_start}__${g.week_end}`;
            const isLocked = !!lockByRange[rangeKey]?.locked;
            const total = groupTotalHours(g);
            const isOpen = !!expanded[g.key];
            const days = groupDaysSummary(g);

            return (
              <section key={g.key} className="card cardPad apGroupCard">
                <div className="apGroupHeader">
                  <div>
                    <div className="apGroupTitle">{displayName(g.user_id, sample)}</div>
                    <div className="muted apGroupMeta">
                      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                        <span>Week: {g.week_start} → {g.week_end} • {g.entries.length} entries</span>
                        {isLocked ? <StatusChip state="locked" /> : <StatusChip state="open" />}
                      </span>
                    </div>

                    <div className="apMini">
                      {days.map(([d, h]) => (
                        <div key={d} className="apMiniItem">
                          <div className="apMiniDate">{d}</div>
                          <div className="apMiniHours">{h.toFixed(2)}h</div>
                        </div>
                      ))}
                    </div>

                    <div className="apMetaRow">
                      <span className="badge">{g.project_count || new Set(g.entries.map((entry) => entry.project_id)).size} projects</span>
                      <span className="badge">{g.day_count || days.length} days</span>
                      {(g.anomalies || []).map((flag) => (
                        <span key={flag} className="badge badgeWarn">{flag.replace(/_/g, " ")}</span>
                      ))}
                    </div>
                    {g.notes_history?.length ? (
                      <div className="apHistory">
                        {g.notes_history.slice(0, 2).map((item) => (
                          <div key={`${item.at}-${item.action}`} className="apHistoryItem">
                            <strong>{item.action}</strong> · {item.actor_name || "System"} · {new Date(item.at).toLocaleString()}
                            {item.note ? <span> — {item.note}</span> : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="apGroupRight">
<label className="apSelectToggle">
                      <input
                        type="checkbox"
                        checked={!!selectedGroups[g.key]}
                        onChange={(e) => setSelectedGroups((p) => ({ ...p, [g.key]: e.target.checked }))}
                        disabled={!!busyKey || loading}
                      />
                      <span className="muted" style={{ fontWeight: 800 }}>Select</span>
                    </label>
                    <div className="apGroupTotal">
                      <div className="muted" style={{ fontWeight: 900 }}>Total</div>
                      <div style={{ fontWeight: 950, fontSize: 18 }}>{total.toFixed(2)} hrs</div>
                    </div>

                    <div className="apGroupActions">
                      <button className="btn btnSecondary btnSm" onClick={() => setExpanded((p) => ({ ...p, [g.key]: !p[g.key] }))} disabled={busyKey === g.key} type="button">
                        {isOpen ? "Hide details" : "View details"}
                      </button>
                      <button
                        className="btn btnPrimary"
                        onClick={() => approveGroup(g)}
                        disabled={busyKey === g.key || isLocked}
                        title={isLocked ? "Locked pay period" : "Approve"}
                      >
                        {busyKey === g.key ? "Working…" : "Approve"}
                      </button>
                      <ActionMenu
                        ariaLabel="Group actions"
                        items={[
                          {
                            label: "Reject (send back)",
                            onSelect: () => rejectGroup(g),
                            danger: true,
                            disabled: busyKey === g.key,
                          },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {isOpen ? (
                  <div className="apTable">
                    <div className="apHead">
                      <div>Date</div>
                      <div>Project</div>
                      <div>Hours</div>
                      <div>Notes</div>
                      <div>Status</div>
                    </div>

                    {g.entries.map((e) => (
                      <div key={e.id} className="apRow">
                        <div className="apCellMono">{e.entry_date}</div>
                        <div>{projectLabel(e.project_id, e)}</div>
                        <div className="apCellMono">{Number(e.hours_worked ?? 0).toFixed(2)}</div>
                        <div className="apNotes">{e.notes || <span className="muted">—</span>}</div>
                        <div>
                          <StatusChip status={e.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

export default function ApprovalsPage() {
  return (
    <RequireOnboarding>
      <ApprovalsInner />
    </RequireOnboarding>
  );
}