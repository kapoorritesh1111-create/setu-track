// src/app/timesheet/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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


function isoToday() {
  return toISODate(new Date());
}

function cloneRowForDate(r: DraftRow, entry_date: string): DraftRow {
  return {
    tempId: `tmp_${crypto.randomUUID()}`,
    entry_date,
    project_id: r.project_id,
    time_in: r.time_in,
    time_out: r.time_out,
    lunch_hours: Number(r.lunch_hours ?? 0),
    mileage: Number(r.mileage ?? 0),
    notes: r.notes ?? "",
    status: "draft",
    rejection_reason: null,
  };
}

function rowMinutes(r: DraftRow) {
  if (!r.time_in || !r.time_out) return 0;
  const [h1,m1]=normalizeHHMM(r.time_in).split(':').map(Number);
  const [h2,m2]=normalizeHHMM(r.time_out).split(':').map(Number);
  if ([h1,m1,h2,m2].some((n)=>Number.isNaN(n))) return 0;
  return h2*60+m2 - (h1*60+m1);
}

function validateRow(r: DraftRow) {
  if (!r.project_id) return 'Project required';
  if (!!r.time_in !== !!r.time_out) return 'Start and end time required';
  if (r.time_in && r.time_out && rowMinutes(r) <= 0) return 'End time must be after start time';
  return '';
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
  const todayRef = useRef<HTMLElement | null>(null);
  const [templateName, setTemplateName] = useState("Standard week");

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
      const tin = r.time_in ? normalizeHHMM(r.time_in) : "";
      const tout = r.time_out ? normalizeHHMM(r.time_out) : "";
      if (!tin || !tout) continue;

      const [h1, m1] = tin.split(":").map(Number);
      const [h2, m2] = tout.split(":").map(Number);
      if ([h1, m1, h2, m2].some((x) => Number.isNaN(x))) continue;

      const start = h1 * 60 + m1;
      const end = h2 * 60 + m2;
      const minutes = Math.max(end - start, 0);
      const hours = Math.max(minutes / 60 - (r.lunch_hours ?? 0), 0);

      map[dayKey] = (map[dayKey] ?? 0) + hours;
    }
    return map;
  }, [rows, weekDays]);

  const weekTotal = useMemo(() => Object.values(hoursByDay).reduce((a, b) => a + b, 0), [hoursByDay]);
  const todayISO = isoToday();
  const isCurrentWeek = todayISO >= weekStartISO && todayISO <= weekEndISO;
  const submittedWeek = useMemo(() => rows.length > 0 && rows.every((r) => r.status === "submitted" || r.status === "approved"), [rows]);
  const validationMap = useMemo(() => Object.fromEntries(rows.map((r)=>[r.tempId, validateRow(r)])), [rows]);

  useEffect(() => {
    if (!isCurrentWeek || loadingWeek) return;
    const node = todayRef.current;
    if (node) node.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [isCurrentWeek, loadingWeek, weekStartISO, weekEndISO]);

  function hasEntriesFor(dateISO: string) {
    return rows.some((r) => r.entry_date === dateISO);
  }

  function copyYesterdayToToday() {
    const y = toISODate(addDays(new Date(todayISO + 'T00:00:00'), -1));
    const yesterdayRows = rows.filter((r) => r.entry_date === y);
    if (!isCurrentWeek) return setMsg('Open the current week to copy into today.');
    if (hasEntriesFor(todayISO)) return setMsg('Today already has entries. Edit existing lines instead.');
    if (!yesterdayRows.length) return setMsg('No entries found for yesterday.');
    setRows((prev) => [...prev, ...yesterdayRows.map((r) => cloneRowForDate(r, todayISO))]);
    setMsg('Copied yesterday → today.');
  }

  async function copyLastWeekToCurrent() {
    if (!isCurrentWeek) {
      setMsg('Open the current week to copy last week into it.');
      return;
    }
    if (rows.length) {
      setMsg('Current week must be empty before copying last week.');
      return;
    }
    const lastWeekStart = addDays(weekStart, -7);
    const lastStartISO = toISODate(lastWeekStart);
    const lastEndISO = toISODate(addDays(lastWeekStart, 6));
    setBusy(true);

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('entry_date, project_id, time_in, time_out, lunch_hours, mileage, notes')
        .eq('user_id', userId!)
        .gte('entry_date', lastStartISO)
        .lte('entry_date', lastEndISO)
        .order('entry_date', { ascending: true });

      if (error) {
        setMsg(error.message);
        return;
      }

      const copied = ((data || []) as any[]).map((r) => {
        const offset = Math.max(
          0,
          Math.round(
            (new Date(r.entry_date + 'T00:00:00').getTime() -
              new Date(lastStartISO + 'T00:00:00').getTime()) /
              86400000,
          ),
        );
        return cloneRowForDate(
          {
            tempId: '',
            entry_date: r.entry_date,
            project_id: r.project_id,
            time_in: timeToHHMM(r.time_in),
            time_out: timeToHHMM(r.time_out),
            lunch_hours: Number(r.lunch_hours || 0),
            mileage: Number(r.mileage || 0),
            notes: r.notes || '',
            status: 'draft',
          },
          toISODate(addDays(weekStart, offset)),
        );
      });

      if (!copied.length) setMsg('No entries found in last week.');
      else {
        setRows(copied);
        setMsg('Copied last week → current week.');
      }
    } finally {
      setBusy(false);
    }
  }

  function applyLineToRemainingWeekdays(source: DraftRow) {
    const sourceDate = new Date(source.entry_date + 'T00:00:00');
    const sourceDay = sourceDate.getDay();
    const dates = weekDays.map((d)=>toISODate(d)).filter((d)=> new Date(d+'T00:00:00').getDay() >= sourceDay && new Date(d+'T00:00:00').getDay() <= 5);
    const additions = dates.filter((d)=> !rows.some((r)=>r.entry_date===d && r.project_id===source.project_id && r.time_in===source.time_in && r.time_out===source.time_out && r.notes===source.notes)).map((d)=> cloneRowForDate(source,d));
    setRows((prev)=> [...prev, ...additions]);
    setMsg(additions.length ? 'Applied line to remaining weekdays.' : 'Matching lines already exist for remaining weekdays.');
  }

  function duplicateLineToTomorrow(source: DraftRow) {
    const next = toISODate(addDays(new Date(source.entry_date+'T00:00:00'),1));
    setRows((prev)=> [...prev, cloneRowForDate(source,next)]);
    setMsg('Duplicated line to tomorrow.');
  }

  function repeatPreviousEntry(entryDateISO: string) {
    const prevDate = toISODate(addDays(new Date(entryDateISO+'T00:00:00'), -1));
    const prevRows = rows.filter((r)=>r.entry_date===prevDate);
    if (!prevRows.length) return setMsg('No previous-day entries to repeat.');
    setRows((prev)=> [...prev, ...prevRows.map((r)=>cloneRowForDate(r, entryDateISO))]);
    setMsg('Repeated previous entry for this day.');
  }

  function saveTemplate() {
    const templateRows = rows.filter((r) => r.entry_date >= weekStartISO && r.entry_date <= weekEndISO).map((r)=>({ ...r, id: undefined, tempId: undefined }));
    if (!templateRows.length) return setMsg('Add at least one line before saving a weekly template.');
    localStorage.setItem('setu:timesheet-template:'+templateName, JSON.stringify(templateRows));
    setMsg(`Saved weekly template: ${templateName}`);
  }

  function applyTemplate() {
    const raw = localStorage.getItem('setu:timesheet-template:'+templateName);
    if (!raw) return setMsg('No saved template found for that name.');
    const templateRows = JSON.parse(raw);
    const next = templateRows.map((r:any) => {
      const idx = Math.max(0, weekDays.findIndex((d)=> new Date(r.entry_date+'T00:00:00').getDay()===d.getDay()));
      return cloneRowForDate({ ...r, tempId: '' }, toISODate(weekDays[idx] || weekDays[0]));
    });
    setRows(next);
    setMsg(`Applied weekly template: ${templateName}`);
  }

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

    const invalid = rows.filter((r) => r.entry_date >= weekStartISO && r.entry_date <= weekEndISO).map((r)=> validationMap[r.tempId]).filter(Boolean);
    if (invalid.length) return setMsg(invalid[0] as string);
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
      setMsg("Week submitted successfully.");
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
        <Button variant={submittedWeek ? "secondary" : "primary"} className={submittedWeek ? "tsSubmitDone" : ""} disabled={busy || loadingWeek || submittedWeek} onClick={submitWeek}>
          {submittedWeek ? "Week submitted" : busy ? "Working…" : "Submit week"}
        </Button>
      </div>
    </div>
  );

  if (profLoading) {
    return (
      <AppShell title="Weekly SETU TRACK" subtitle="Loading profile…">
        <div className="card cardPad">
          <div className="muted">Loading…</div>
        </div>
      </AppShell>
    );
  }

  if (!profile || !userId) return null;

  return (
    <AppShell title="Weekly SETU TRACK" subtitle={headerSubtitle} right={headerRight}>
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

      <div className="card cardPad tsSummary">
        {submittedWeek ? <div className="tsSuccessBanner">Week submitted <span aria-hidden="true">✓</span></div> : null}
        <div className="tsSummaryRow">
          <div>
            <div className="tsSummaryTitle">Week total</div>
            <div className="tsSummaryValue">{weekTotal.toFixed(2)} hrs</div>
          </div>
          <div className="muted tsSummaryHint">Tip: Add multiple lines per day. Submitted/approved lines lock.</div>
        </div>
        <div className="tsQuickFill">
          <div className="label">Quick fill</div>
          <div className="tsQuickFillActions">
            <Button variant="secondary" size="sm" onClick={copyYesterdayToToday} disabled={!isCurrentWeek || busy || loadingWeek}>Copy yesterday → today</Button>
            <Button variant="secondary" size="sm" onClick={copyLastWeekToCurrent} disabled={!isCurrentWeek || !!rows.length || busy || loadingWeek}>Copy last week → current</Button>
            <input className="input tsTemplateInput" value={templateName} onChange={(e)=>setTemplateName(e.target.value)} placeholder="Template name" />
            <Button variant="secondary" size="sm" onClick={saveTemplate} disabled={busy || loadingWeek}>Save template</Button>
            <Button variant="secondary" size="sm" onClick={applyTemplate} disabled={busy || loadingWeek}>Apply template</Button>
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
              <section key={dayISO} ref={dayISO === todayISO ? todayRef : undefined} className="card cardPad tsDayCard">
                <div className="tsDayHeader">
                  <div className="tsDayTitle">
                    {formatShort(day)} <span className="muted">({dayISO})</span>
                  </div>
                  <div className="tsDayTotal">Day total: {(hoursByDay[dayISO] ?? 0).toFixed(2)} hrs</div>
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

                {dayRows.length === 0 ? <div className="muted" style={{ marginTop: 10 }}>No lines for this day.</div> : null}

                {dayRows.map((r) => {
                  const locked = r.status === "submitted" || r.status === "approved";

                  return (
                    <div key={r.tempId} className="tsRowWrap">
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
                      {validationMap[r.tempId] ? <div className="tsInlineError">{validationMap[r.tempId]}</div> : null}
                      {!locked ? (
                        <div className="tsRowActions">
                          <button type="button" className="pill" onClick={() => repeatPreviousEntry(r.entry_date)}>Repeat previous entry</button>
                          <button type="button" className="pill" onClick={() => duplicateLineToTomorrow(r)}>Duplicate to tomorrow</button>
                          <button type="button" className="pill" onClick={() => applyLineToRemainingWeekdays(r)}>Apply to remaining weekdays</button>
                        </div>
                      ) : null}

                      {r.status === "rejected" && r.rejection_reason ? (
                        <div className="tsRejectReason">
                          <span style={{ fontWeight: 900 }}>Rejected:</span> {r.rejection_reason}
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                <div style={{ marginTop: 10 }}>
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
