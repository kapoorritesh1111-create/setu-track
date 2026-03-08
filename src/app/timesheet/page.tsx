// src/app/timesheet/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import RequireOnboarding from "../../components/auth/RequireOnboarding";
import AppShell from "../../components/layout/AppShell";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";
import { addDays, formatShort, startOfWeekSunday, toISODate, weekRangeLabel } from "../../lib/date";
import { StatusChip } from "../../components/ui/StatusChip";
import Button from "../../components/ui/Button";

type Project = {
  id: string;
  name: string;
  parent_id?: string | null;
  is_active?: boolean | null;
};

type EntryStatus = "draft" | "submitted" | "approved" | "rejected";

type TimeEntryRow = {
  id: string;
  entry_date: string; // YYYY-MM-DD
  project_id: string;
  time_in: string | null; // "HH:MM:SS"
  time_out: string | null;
  lunch_hours: number | null;
  mileage: number | null;
  notes: string | null;
  status: EntryStatus;
  rejection_reason?: string | null;
  hours_worked?: number | null; // exists in v_time_entries after DB fix
};

type DraftRow = {
  id?: string;
  tempId: string;
  entry_date: string;
  project_id: string;
  time_in: string; // "HH:MM"
  time_out: string; // "HH:MM"
  lunch_hours: number;
  mileage: number;
  notes: string;
  status?: EntryStatus;
  rejection_reason?: string | null;
};

function timeToHHMM(t: string | null): string {
  if (!t) return "";
  return t.slice(0, 5);
}

function normalizeHHMM(s: string): string {
  if (!s) return "";
  const [hRaw, mRaw] = s.split(":");
  const h = String(Number(hRaw ?? 0)).padStart(2, "0");
  const m = String(Number(mRaw ?? 0)).padStart(2, "0");
  return `${h}:${m}`;
}

function getRowHours(row: Pick<DraftRow, "time_in" | "time_out" | "lunch_hours">): number {
  const tin = row.time_in ? normalizeHHMM(row.time_in) : "";
  const tout = row.time_out ? normalizeHHMM(row.time_out) : "";
  if (!tin || !tout) return 0;

  const [h1, m1] = tin.split(":").map(Number);
  const [h2, m2] = tout.split(":").map(Number);
  if ([h1, m1, h2, m2].some((x) => Number.isNaN(x))) return 0;

  const start = h1 * 60 + m1;
  const end = h2 * 60 + m2;
  const minutes = Math.max(end - start, 0);
  return Math.max(minutes / 60 - (row.lunch_hours ?? 0), 0);
}

function StatusPill({ status }: { status: EntryStatus | undefined }) {
  const s = (status ?? "draft") as EntryStatus;
  return <StatusChip status={s} />;
}

function SetuTrackInner() {
  const { loading: profLoading, profile, userId } = useProfile();

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekSunday(new Date()));
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekStartISO = useMemo(() => toISODate(weekStart), [weekStart]);
  const weekEndISO = useMemo(() => toISODate(addDays(weekStart, 6)), [weekStart]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [loadingWeek, setLoadingWeek] = useState(false);

  const canView = !!userId && !!profile;
  const isManagerOrAdmin = profile?.role === "admin" || profile?.role === "manager";
  const isContractor = profile?.role === "contractor";

  useEffect(() => {
    if (!canView) return;

    let cancelled = false;

    (async () => {
      setLoadingWeek(true);
      setMsg("");

      // PROJECTS (STRICT)
      // - Admin/Manager: org active projects
      // - Contractor: ONLY membership-based projects
      try {
        if (isManagerOrAdmin) {
          const { data: projRows, error: projErr } = await supabase
            .from("projects")
            .select("id, name, parent_id, is_active")
            .eq("org_id", profile!.org_id)
            .eq("is_active", true)
            .order("name", { ascending: true });

          if (!cancelled) {
            if (projErr) setMsg(projErr.message);
            setProjects((((projRows as any) ?? []) as Project[]) || []);
          }
        } else {
          const { data: pm, error: pmErr } = await supabase
            .from("project_members")
            .select("project_id, projects:project_id (id, name, parent_id, is_active)")
            .eq("profile_id", userId!)
            .eq("is_active", true);

          if (!cancelled) {
            if (pmErr) {
              setMsg(pmErr.message);
              setProjects([]);
            } else {
              const list = (((pm as any) ?? []) as any[]).map((x) => x.projects).filter(Boolean) as Project[];
              const uniq = Array.from(new Map(list.map((p) => [p.id, p])).values())
                .filter((p) => p.is_active !== false)
                .sort((a, b) => a.name.localeCompare(b.name));
              setProjects(uniq);
            }
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setMsg(e?.message || "Failed to load projects");
          setProjects([]);
        }
      }

      // ENTRIES
      // NOTE: We read from time_entries so we can show rejection_reason.
      const { data: entryRows, error: entryErr } = await supabase
        .from("time_entries")
        .select("id, entry_date, project_id, time_in, time_out, lunch_hours, mileage, notes, status, rejection_reason")
        .eq("user_id", userId!)
        .gte("entry_date", weekStartISO)
        .lte("entry_date", weekEndISO)
        .order("entry_date", { ascending: true });

      if (!cancelled) {
        if (entryErr) {
          setMsg((m) => (m ? `${m}\n${entryErr.message}` : entryErr.message));
          setRows([]);
          setLoadingWeek(false);
          return;
        }

        const mapped: DraftRow[] = (((entryRows as any) ?? []) as TimeEntryRow[]).map((r) => ({
          id: r.id,
          tempId: r.id,
          entry_date: r.entry_date,
          project_id: r.project_id,
          time_in: timeToHHMM(r.time_in),
          time_out: timeToHHMM(r.time_out),
          lunch_hours: Number(r.lunch_hours ?? 0),
          mileage: Number(r.mileage ?? 0),
          notes: r.notes ?? "",
          status: r.status,
          rejection_reason: (r as any).rejection_reason ?? null,
        }));

        setRows(mapped);
        setLoadingWeek(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canView, userId, profile, isManagerOrAdmin, weekStartISO, weekEndISO]);

  const hoursByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of weekDays) map[toISODate(d)] = 0;

    for (const r of rows) {
      const dayKey = r.entry_date;
      map[dayKey] = (map[dayKey] ?? 0) + getRowHours(r);
    }
    return map;
  }, [rows, weekDays]);

  const weekTotal = useMemo(() => Object.values(hoursByDay).reduce((a, b) => a + b, 0), [hoursByDay]);
  const weekStats = useMemo(() => {
    const statuses = rows.reduce(
      (acc, row) => {
        const status = row.status ?? "draft";
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      },
      { draft: 0, submitted: 0, approved: 0, rejected: 0 } as Record<EntryStatus, number>
    );

    const daysWithEntries = weekDays.filter((day) => rows.some((row) => row.entry_date === toISODate(day))).length;
    const missingDays = weekDays.length - daysWithEntries;
    const avgDay = daysWithEntries > 0 ? weekTotal / daysWithEntries : 0;

    return {
      daysWithEntries,
      missingDays,
      avgDay,
      submitted: statuses.submitted,
      approved: statuses.approved,
      draft: statuses.draft,
      rejected: statuses.rejected,
    };
  }, [rows, weekDays, weekTotal]);

  function addLine(entryDateISO: string) {
    const tempId = `tmp_${crypto.randomUUID()}`;
    const firstProject = projects[0]?.id ?? "";
    setRows((prev) => [
      ...prev,
      {
        tempId,
        entry_date: entryDateISO,
        project_id: firstProject,
        time_in: "",
        time_out: "",
        lunch_hours: 0,
        mileage: 0,
        notes: "",
        status: "draft",
      },
    ]);
  }

  function removeLine(tempId: string) {
    setRows((prev) => prev.filter((r) => r.tempId !== tempId));
  }

  function updateRow(tempId: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)));
  }

  async function saveDraft() {
    if (!userId || !profile) return;

    if (isContractor && projects.length === 0) {
      setMsg("No projects assigned. Ask your admin to assign projects (Profiles → Project access).");
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const weekRows = rows.filter((r) => r.entry_date >= weekStartISO && r.entry_date <= weekEndISO);

      const results = await Promise.all(
        weekRows.map(async (r) => {
          const hasAnyInput =
            !!r.project_id ||
            !!r.time_in ||
            !!r.time_out ||
            (r.lunch_hours ?? 0) > 0 ||
            (r.mileage ?? 0) > 0 ||
            !!r.notes;

          if (!hasAnyInput) return { ok: true, skipped: true };
          if (!r.project_id) return { ok: false, error: `Project required for ${r.entry_date}` };
          if (r.status === "submitted" || r.status === "approved") return { ok: true, skipped: true };

          const payload = {
            org_id: profile.org_id,
            user_id: userId,
            entry_date: r.entry_date,
            project_id: r.project_id,
            time_in: r.time_in ? normalizeHHMM(r.time_in) + ":00" : null,
            time_out: r.time_out ? normalizeHHMM(r.time_out) + ":00" : null,
            lunch_hours: r.lunch_hours ?? 0,
            mileage: r.mileage ?? 0,
            notes: r.notes ?? null,
            status: (r.status === "rejected" ? "draft" : (r.status ?? "draft")) as EntryStatus,
          };

          if (r.id) {
            const { error } = await supabase.from("time_entries").update(payload).eq("id", r.id);
            if (error) return { ok: false, error: error.message };
            return { ok: true };
          } else {
            const { data, error } = await supabase.from("time_entries").insert(payload).select("id").single();
            if (error) return { ok: false, error: error.message };
            updateRow(r.tempId, { id: data.id, tempId: data.id });
            return { ok: true };
          }
        })
      );

      const errors = results.filter((x: any) => !x.ok).map((x: any) => x.error);
      setMsg(errors.length ? errors.join("\n") : "Saved ✅");
    } finally {
      setBusy(false);
    }
  }

  async function submitWeek() {
    if (!userId) return;

    if (isContractor && projects.length === 0) {
      setMsg("No projects assigned. Ask your admin to assign projects (Profiles → Project access).");
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      const { error } = await supabase
        .from("time_entries")
        .update({ status: "submitted" })
        .eq("user_id", userId)
        .gte("entry_date", weekStartISO)
        .lte("entry_date", weekEndISO)
        .in("status", ["draft", "rejected"]);

      if (error) {
        setMsg(error.message);
        return;
      }

      const { data: entryRows, error: entryErr } = await supabase
        .from("time_entries")
        .select("id, entry_date, project_id, time_in, time_out, lunch_hours, mileage, notes, status, rejection_reason")
        .eq("user_id", userId)
        .gte("entry_date", weekStartISO)
        .lte("entry_date", weekEndISO)
        .order("entry_date", { ascending: true });

      if (entryErr) {
        setMsg(`Submitted, but reload failed: ${entryErr.message}`);
        return;
      }

      const mapped: DraftRow[] = (((entryRows as any) ?? []) as TimeEntryRow[]).map((r) => ({
        id: r.id,
        tempId: r.id,
        entry_date: r.entry_date,
        project_id: r.project_id,
        time_in: timeToHHMM(r.time_in),
        time_out: timeToHHMM(r.time_out),
        lunch_hours: Number(r.lunch_hours ?? 0),
        mileage: Number(r.mileage ?? 0),
        notes: r.notes ?? "",
        status: r.status,
        rejection_reason: (r as any).rejection_reason ?? null,
      }));

      setRows(mapped);
      setMsg("Week submitted ✅");
    } finally {
      setBusy(false);
    }
  }

  const headerSubtitle = profile ? `${weekRangeLabel(weekStart)} • Role: ${profile.role}` : `${weekRangeLabel(weekStart)}`;

  const headerRight = (
    <div className="tsHeaderRight">
      <div className="tsWeekNav">
        <button className="btn btnSecondary btnSm" onClick={() => setWeekStart((d) => addDays(d, -7))} disabled={busy || loadingWeek} title="Previous week" type="button">
          ← Prev
        </button>
        <button
          className="btn btnSecondary btnSm"
          type="button"
          onClick={() => setWeekStart(startOfWeekSunday(new Date()))}
          disabled={busy || loadingWeek}
          title="Jump to current week"
        >
          This week
        </button>
        <button className="btn btnSecondary btnSm" onClick={() => setWeekStart((d) => addDays(d, 7))} disabled={busy || loadingWeek} title="Next week" type="button">
          Next →
        </button>
      </div>

      <div className="tsActions">
        <Button variant="secondary" disabled={busy || loadingWeek} onClick={saveDraft}>
          {busy ? "Saving…" : "Save draft"}
        </Button>
        <Button variant="primary" disabled={busy || loadingWeek} onClick={submitWeek}>
          {busy ? "Working…" : "Submit week"}
        </Button>
      </div>
    </div>
  );

  if (profLoading) {
    return (
      <AppShell title="My work" subtitle="Loading weekly workspace…">
        <div className="card cardPad">
          <div className="muted">Loading…</div>
        </div>
      </AppShell>
    );
  }

  if (!profile || !userId) return null;

  return (
    <AppShell title="My work" subtitle={headerSubtitle} right={headerRight}>
      {msg ? (
        <div className="alert alertInfo">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg}</pre>
        </div>
      ) : null}

      {isContractor && projects.length === 0 ? (
        <div className="alert alertWarn">
          <div style={{ fontWeight: 950 }}>No projects assigned</div>
          <div className="muted" style={{ marginTop: 6 }}>
            You can’t submit time until an admin assigns at least one project.
          </div>
        </div>
      ) : null}

      <section className="tsCommand">
        <div>
          <div className="tsCommandEyebrow">Connect · Grow · Track</div>
          <h2 className="tsCommandTitle">Weekly time entry workspace</h2>
          <p className="tsCommandText">
            Log time quickly, keep each day clean, and submit only when the full week is ready for review.
          </p>
        </div>
        <div className="tsCommandMeta">
          <div className="tsCommandMetaCard">
            <span>Week range</span>
            <strong>{weekRangeLabel(weekStart)}</strong>
          </div>
          <div className="tsCommandMetaCard">
            <span>Project access</span>
            <strong>{projects.length} active project{projects.length === 1 ? "" : "s"}</strong>
          </div>
        </div>
      </section>

      <section className="tsMetricsGrid">
        <div className="tsMetricCard">
          <div className="tsMetricLabel">Days logged</div>
          <div className="tsMetricValueSmall">{weekStats.daysWithEntries}/7</div>
          <div className="tsMetricHint">{weekStats.missingDays} day{weekStats.missingDays === 1 ? "" : "s"} still empty this week</div>
        </div>
        <div className="tsMetricCard">
          <div className="tsMetricLabel">Submitted lines</div>
          <div className="tsMetricValueSmall">{weekStats.submitted}</div>
          <div className="tsMetricHint">{weekStats.approved} approved • {weekStats.draft} still in draft</div>
        </div>
        <div className="tsMetricCard">
          <div className="tsMetricLabel">Average logged day</div>
          <div className="tsMetricValueSmall">{weekStats.avgDay.toFixed(2)} hrs</div>
          <div className="tsMetricHint">Average across the {weekStats.daysWithEntries || 0} day(s) with entries</div>
        </div>
        <div className="tsMetricCard">
          <div className="tsMetricLabel">Week total</div>
          <div className="tsMetricValueSmall">{weekTotal.toFixed(2)} hrs</div>
          <div className="tsMetricHint">Save drafts anytime. Submit once the week is complete.</div>
        </div>
      </section>

      <div className="card cardPad tsSummary">
        <div className="tsSummaryRow">
          <div>
            <div className="tsSummaryTitle">Submission readiness</div>
            <div className="tsSummaryValue">{weekStats.draft + weekStats.rejected}</div>
            <div className="muted tsSummaryHint">draft or rejected line{weekStats.draft + weekStats.rejected === 1 ? "" : "s"} still need attention before final submission.</div>
          </div>
          <div className="tsSummaryAside">
            <div className="tsSummaryAsideItem">
              <span>Approved</span>
              <strong>{weekStats.approved}</strong>
            </div>
            <div className="tsSummaryAsideItem">
              <span>Submitted</span>
              <strong>{weekStats.submitted}</strong>
            </div>
            <div className="tsSummaryAsideItem">
              <span>Rejected</span>
              <strong>{weekStats.rejected}</strong>
            </div>
          </div>
        </div>
      </div>

      {loadingWeek ? (
        <div className="card cardPad" style={{ marginTop: 14 }}>
          <div className="muted">Loading week…</div>
        </div>
      ) : (
        <div className="tsDays">
          {weekDays.map((day) => {
            const dayISO = toISODate(day);
            const dayRows = rows.filter((r) => r.entry_date === dayISO);

            return (
              <section key={dayISO} className="card cardPad tsDayCard">
                <div className="tsDayHeader">
                  <div>
                    <div className="tsDayTitle">
                      {formatShort(day)} <span className="muted">({dayISO})</span>
                    </div>
                    <div className="tsDayMeta">{dayRows.length} line{dayRows.length === 1 ? "" : "s"} • {(hoursByDay[dayISO] ?? 0).toFixed(2)} hrs tracked</div>
                  </div>
                  <div className="tsDayTools">
                    <div className="tsDayTotal">Day total: {(hoursByDay[dayISO] ?? 0).toFixed(2)} hrs</div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => addLine(dayISO)}
                      disabled={isContractor && projects.length === 0}
                      title={isContractor && projects.length === 0 ? "Admin must assign a project first" : "Add a new line"}
                    >
                      + Add line
                    </Button>
                  </div>
                </div>

                <div className="tsGridHead">
                  <div>Project</div>
                  <div>In</div>
                  <div>Out</div>
                  <div>Lunch</div>
                  <div>Notes</div>
                  <div>Miles</div>
                  <div>Status</div>
                </div>

                {dayRows.length === 0 ? <div className="tsEmptyDay">No lines for this day yet. Add time when work starts.</div> : null}

                {dayRows.map((r) => {
                  const locked = r.status === "submitted" || r.status === "approved";
                  const rowHours = getRowHours(r);

                  return (
                    <div key={r.tempId} className="tsRowWrap">
                      <div className="tsLineMeta">
                        <span>{locked ? "Locked line" : "Editable line"}</span>
                        <strong>{rowHours.toFixed(2)} hrs</strong>
                      </div>
                      <div className="tsGridRow">
                        <select
                          className="input tsControl"
                          value={r.project_id}
                          disabled={locked || (isContractor && projects.length === 0)}
                          onChange={(e) => updateRow(r.tempId, { project_id: e.target.value })}
                        >
                          <option value="">Select…</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>

                        <input className="input tsControl" type="time" step={60} value={r.time_in} disabled={locked} onChange={(e) => updateRow(r.tempId, { time_in: e.target.value })} />

                        <input className="input tsControl" type="time" step={60} value={r.time_out} disabled={locked} onChange={(e) => updateRow(r.tempId, { time_out: e.target.value })} />

                        <input
                          className="input tsControl"
                          value={r.lunch_hours}
                          disabled={locked}
                          onChange={(e) => updateRow(r.tempId, { lunch_hours: Number(e.target.value) })}
                          type="number"
                          min="0"
                          step="0.25"
                        />

                        <input
                          className="input tsControl tsNotesInput"
                          value={r.notes}
                          disabled={locked}
                          onChange={(e) => updateRow(r.tempId, { notes: e.target.value })}
                          placeholder="What did you work on?"
                        />

                        <input
                          className="input tsControl"
                          value={r.mileage}
                          disabled={locked}
                          onChange={(e) => updateRow(r.tempId, { mileage: Number(e.target.value) })}
                          type="number"
                          min="0"
                          step="0.1"
                        />

                        <div className="tsStatusCell">
                          <StatusPill status={(r.status ?? "draft") as EntryStatus} />
                          {!locked ? (
                            <Button variant="danger" size="sm" className="tsRemoveBtn" onClick={() => removeLine(r.tempId)} title="Remove line" type="button">
                              ✕
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      {r.status === "rejected" && r.rejection_reason ? (
                        <div className="tsRejectReason">
                          <span style={{ fontWeight: 900 }}>Rejected:</span> {r.rejection_reason}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

export default function SetuTrackPage() {
  return (
    <RequireOnboarding>
      <SetuTrackInner />
    </RequireOnboarding>
  );
}
