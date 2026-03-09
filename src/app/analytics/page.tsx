"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import RequireOnboarding from "../../components/auth/RequireOnboarding";
import AppShell from "../../components/layout/AppShell";
import Button from "../../components/ui/Button";
import DateRangeToolbar from "../../components/ui/DateRangeToolbar";
import { EmptyState } from "../../components/ui/EmptyState";
import { supabase } from "../../lib/supabaseBrowser";
import { presetToRange, previousRangeFor, presetLabel, type DatePreset } from "../../lib/dateRanges";
import { useProfile } from "../../lib/useProfile";

type EntryRow = {
  id: string;
  org_id: string;
  user_id: string;
  entry_date: string;
  status: string | null;
  project_id: string | null;
  project_name: string | null;
  full_name: string | null;
  hours_worked: number | null;
  hourly_rate_snapshot: number | null;
};

type PayrollRun = {
  id: string;
  period_start: string;
  period_end: string;
  total_amount: number | null;
  total_hours: number | null;
  created_at: string | null;
  status: string | null;
};

type ProjectBudget = {
  id: string;
  budget_hours: number | null;
  budget_amount: number | null;
  budget_currency: string | null;
};

function money(value: number, currency = "USD") { return `${currency} ${value.toFixed(2)}`; }
function pct(delta: number) { return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`; }

function AnalyticsPageContent() {
  const searchParams = useSearchParams();
  const { profile, userId, loading } = useProfile() as any;
  const [preset, setPreset] = useState<DatePreset>((searchParams.get("preset") as DatePreset) || "current_month");
  const initial = preset === "custom" ? { start: searchParams.get("start") || "", end: searchParams.get("end") || "" } : presetToRange((preset as Exclude<DatePreset, "custom">) || "current_month");
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [previousRows, setPreviousRows] = useState<EntryRow[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [projectBudgets, setProjectBudgets] = useState<Record<string, ProjectBudget>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (preset !== "custom") {
      const range = presetToRange(preset);
      setStart(range.start);
      setEnd(range.end);
    }
  }, [preset]);

  async function load(rangeStart = start, rangeEnd = end) {
    if (!profile?.org_id || !userId || !rangeStart || !rangeEnd) return;
    setBusy(true);
    setError("");
    try {
      const previousRange = previousRangeFor(rangeStart, rangeEnd);
      const currentQuery = supabase
        .from("v_time_entries")
        .select("id, org_id, user_id, entry_date, status, project_id, project_name, full_name, hours_worked, hourly_rate_snapshot")
        .eq("org_id", profile.org_id)
        .gte("entry_date", rangeStart)
        .lte("entry_date", rangeEnd);

      const previousQuery = supabase
        .from("v_time_entries")
        .select("id, org_id, user_id, entry_date, status, project_id, project_name, full_name, hours_worked, hourly_rate_snapshot")
        .eq("org_id", profile.org_id)
        .gte("entry_date", previousRange.start)
        .lte("entry_date", previousRange.end);

      const runQuery = supabase
        .from("payroll_runs")
        .select("id, period_start, period_end, total_amount, total_hours, created_at, status")
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: false })
        .limit(6);

      const budgetQuery = supabase
        .from("projects")
        .select("id, budget_hours, budget_amount, budget_currency")
        .eq("org_id", profile.org_id);

      const [{ data: current, error: currentError }, { data: previous, error: previousError }, { data: payrollRuns, error: runError }, { data: budgetRows, error: budgetError }] = await Promise.all([currentQuery, previousQuery, runQuery, budgetQuery]);
      if (currentError || previousError || runError || budgetError) throw new Error(currentError?.message || previousError?.message || runError?.message || budgetError?.message || "Failed to load analytics");

      const restrict = profile.role === "contractor"
        ? (list: EntryRow[]) => list.filter((row) => row.user_id === userId)
        : profile.role === "manager"
          ? (list: EntryRow[]) => list.filter((row) => row.user_id === userId || row.status === "approved" || row.status === "submitted")
          : (list: EntryRow[]) => list;

      setRows(restrict((current || []) as EntryRow[]));
      setPreviousRows(restrict((previous || []) as EntryRow[]));
      setRuns((payrollRuns || []) as PayrollRun[]);
      setProjectBudgets(Object.fromEntries(((budgetRows || []) as any[]).map((row) => [row.id, row])));
    } catch (e: any) {
      setError(e?.message || "Failed to load analytics.");
      setRows([]);
      setPreviousRows([]);
      setRuns([]);
      setProjectBudgets({});
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (loading || !profile?.org_id || !userId || !start || !end) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile?.org_id, userId, start, end]);

  const summary = useMemo(() => {
    const totalHours = rows.reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
    const approvedHours = rows.filter((row) => row.status === "approved").reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
    const submittedHours = rows.filter((row) => row.status === "submitted").reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
    const totalCost = rows.reduce((sum, row) => sum + Number(row.hours_worked || 0) * Number(row.hourly_rate_snapshot || 0), 0);
    const prevHours = previousRows.reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
    const prevCost = previousRows.reduce((sum, row) => sum + Number(row.hours_worked || 0) * Number(row.hourly_rate_snapshot || 0), 0);
    const people = new Set(rows.map((row) => row.user_id)).size;
    const projects = new Set(rows.map((row) => row.project_id).filter(Boolean)).size;
    const hoursDelta = prevHours ? ((totalHours - prevHours) / prevHours) * 100 : totalHours > 0 ? 100 : 0;
    const costDelta = prevCost ? ((totalCost - prevCost) / prevCost) * 100 : totalCost > 0 ? 100 : 0;

    const byProjectMap = new Map<string, { id: string; name: string; hours: number; cost: number; pending: number; budgetAmount: number; budgetHours: number; currency: string }>();
    for (const row of rows) {
      const key = row.project_id || row.project_name || "unassigned";
      const current = byProjectMap.get(key) || { id: key, name: row.project_name || "Unassigned", hours: 0, cost: 0, pending: 0, budgetAmount: 0, budgetHours: 0, currency: "USD" };
      current.hours += Number(row.hours_worked || 0);
      current.cost += Number(row.hours_worked || 0) * Number(row.hourly_rate_snapshot || 0);
      if (row.status === "submitted") current.pending += 1;
      const budget = row.project_id ? projectBudgets[row.project_id] : null;
      current.budgetAmount = Number(budget?.budget_amount || 0);
      current.budgetHours = Number(budget?.budget_hours || 0);
      current.currency = budget?.budget_currency || "USD";
      byProjectMap.set(key, current);
    }
    const byProject = Array.from(byProjectMap.values()).sort((a,b) => b.cost - a.cost).slice(0, 5);
    const budgetedProjects = byProject.filter((item) => item.budgetAmount > 0);
    const overBudgetProjects = budgetedProjects.filter((item) => item.cost > item.budgetAmount);

    const byPersonMap = new Map<string, { id: string; name: string; hours: number; cost: number }>();
    for (const row of rows) {
      const key = row.user_id;
      const current = byPersonMap.get(key) || { id: key, name: row.full_name || "Unknown", hours: 0, cost: 0 };
      current.hours += Number(row.hours_worked || 0);
      current.cost += Number(row.hours_worked || 0) * Number(row.hourly_rate_snapshot || 0);
      byPersonMap.set(key, current);
    }
    const byPerson = Array.from(byPersonMap.values()).sort((a,b) => b.hours - a.hours).slice(0, 5);

    return { totalHours, approvedHours, submittedHours, totalCost, people, projects, hoursDelta, costDelta, byProject, byPerson, budgetedProjects: budgetedProjects.length, overBudgetProjects: overBudgetProjects.length };
  }, [rows, previousRows, projectBudgets]);

  const barMax = Math.max(1, ...summary.byProject.map((item) => item.cost), ...summary.byPerson.map((item) => item.hours));

  return (
    <RequireOnboarding>
      <AppShell title="Analytics" subtitle="Connect grow track — labor, payroll, and project performance insights">
        <div className="analyticsPage">
          <div className="analyticsHero">
            <div className="analyticsHeroTagline">Connect · Grow · Track</div>
            <div className="analyticsHeroTitle" style={{ marginTop: 10 }}>Analytics workspace</div>
            <div className="analyticsHeroText">
              Use the same command-center date range to understand labor movement, approvals coverage, project concentration, and payroll trends.
            </div>
            <div style={{ marginTop: 16 }}>
              <DateRangeToolbar
                preset={preset}
                start={start}
                end={end}
                onPresetChange={setPreset}
                onStartChange={(value) => { setPreset("custom"); setStart(value); }}
                onEndChange={(value) => { setPreset("custom"); setEnd(value); }}
                onRefresh={() => load()}
                busy={busy}
              />
            </div>
          </div>

          {error ? <div className="alert alertError">{error}</div> : null}

          {busy ? (
            <div className="card cardPad"><div className="muted">Loading analytics…</div></div>
          ) : rows.length === 0 ? (
            <div className="card cardPad">
              <EmptyState title="No analytics in this range" description="There are no time entries in the selected window yet." action={<Button variant="ghost" onClick={() => setPreset("current_month")}>Use current month</Button>} />
            </div>
          ) : (
            <>
              <div className="analyticsKpis">
                <div className="setuMetricCard"><div className="setuMetricLabel">Total labor cost</div><div className="setuMetricValue">{money(summary.totalCost)}</div><div className={`setuMetricHint ${summary.costDelta >= 0 ? "analyticsDeltaPositive" : "analyticsDeltaNegative"}`}>{pct(summary.costDelta)} vs prior range</div></div>
                <div className="setuMetricCard"><div className="setuMetricLabel">Tracked hours</div><div className="setuMetricValue">{summary.totalHours.toFixed(2)}</div><div className={`setuMetricHint ${summary.hoursDelta >= 0 ? "analyticsDeltaPositive" : "analyticsDeltaNegative"}`}>{pct(summary.hoursDelta)} vs prior range</div></div>
                <div className="setuMetricCard"><div className="setuMetricLabel">Approved hours</div><div className="setuMetricValue">{summary.approvedHours.toFixed(2)}</div><div className="setuMetricHint">{summary.submittedHours.toFixed(2)} hrs still awaiting review</div></div>
                <div className="setuMetricCard"><div className="setuMetricLabel">Coverage</div><div className="setuMetricValue">{summary.people} people</div><div className="setuMetricHint">Across {summary.projects} active projects in {presetLabel(preset, start, end).toLowerCase()} • {summary.overBudgetProjects} over budget</div></div>
              </div>

              <div className="analyticsSplit">
                <div className="analyticsPanel">
                  <div className="setuCardHeaderRow"><div><div className="setuSectionTitle" style={{ fontSize: 20 }}>Project labor mix</div><div className="setuSectionHint">Budget-aware labor mix for the same project health layer used by the command center.</div></div><Button variant="secondary" onClick={() => (window.location.href = "/projects")}>Projects</Button></div>
                  <div className="analyticsBars">
                    {summary.byProject.map((item) => (
                      <div className="analyticsBarItem" key={item.id}>
                        <div className="analyticsBarHead"><span>{item.name}</span><span>{money(item.cost)} · {item.hours.toFixed(2)} hrs</span></div>
                        <div className="analyticsBarTrack"><div className="analyticsBarFill" style={{ width: `${Math.max(8, (item.cost / barMax) * 100)}%` }} /></div>
                        <div className="muted" style={{ fontSize: 12 }}>{item.pending} pending approvals • {item.budgetAmount > 0 ? `${item.cost > item.budgetAmount ? "over" : "within"} ${money(item.budgetAmount, item.currency)} budget` : "no budget"}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="analyticsPanel">
                  <div className="setuCardHeaderRow"><div><div className="setuSectionTitle" style={{ fontSize: 20 }}>People contribution</div><div className="setuSectionHint">A utilization-style view to spot concentration and workload imbalance.</div></div><Button variant="secondary" onClick={() => (window.location.href = "/profiles")}>People</Button></div>
                  <div className="analyticsList">
                    {summary.byPerson.map((item) => (
                      <div className="analyticsBarItem" key={item.id}>
                        <div className="analyticsBarHead"><span>{item.name}</span><span>{item.hours.toFixed(2)} hrs</span></div>
                        <div className="analyticsBarTrack"><div className="analyticsBarFill" style={{ width: `${Math.max(8, (item.hours / barMax) * 100)}%` }} /></div>
                        <div className="muted" style={{ fontSize: 12 }}>{money(item.cost)} labor cost</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="analyticsSplit">
                <div className="analyticsPanel">
                  <div className="setuCardHeaderRow"><div><div className="setuSectionTitle" style={{ fontSize: 20 }}>Recent payroll runs</div><div className="setuSectionHint">Closed payroll snapshots explain cost movement and payroll readiness over time.</div></div><Button variant="secondary" onClick={() => (window.location.href = "/reports/payroll-runs")}>Open runs</Button></div>
                  <div className="tableWrap">
                    <table className="table">
                      <thead><tr><th>Period</th><th>Status</th><th>Hours</th><th>Amount</th><th>Closed</th></tr></thead>
                      <tbody>
                        {runs.map((run) => (
                          <tr key={run.id}>
                            <td>{run.period_start} → {run.period_end}</td>
                            <td><span className={`pill ${run.status === "paid" ? "ok" : run.status === "locked" ? "warn" : ""}`}>{run.status || "open"}</span></td>
                            <td>{Number(run.total_hours || 0).toFixed(2)}</td>
                            <td>{money(Number(run.total_amount || 0))}</td>
                            <td>{run.created_at ? new Date(run.created_at).toLocaleString() : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="analyticsPanel">
                  <div className="setuCardHeaderRow"><div><div className="setuSectionTitle" style={{ fontSize: 20 }}>Connected screens</div><div className="setuSectionHint">The dashboard remains the control surface. Use these workspaces for deeper decisions.</div></div></div>
                  <div className="setuFocusList">
                    <button className="setuFocusItem" onClick={() => (window.location.href = "/dashboard")}><span>Command Center</span><strong>Open</strong></button>
                    <button className="setuFocusItem" onClick={() => (window.location.href = "/approvals?scope=all")}><span>Approvals queue</span><strong>{summary.submittedHours.toFixed(2)} hrs</strong></button>
                    <button className="setuFocusItem" onClick={() => (window.location.href = `/reports/payroll?preset=${encodeURIComponent(preset)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)}><span>Payroll report</span><strong>{money(summary.totalCost)}</strong></button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </AppShell>
    </RequireOnboarding>
  );
}


export default function AnalyticsPage() {
  return (
    <Suspense fallback={<RequireOnboarding><AppShell title="Analytics" subtitle="Connect grow track — labor, payroll, and project performance insights"><div className="card cardPad"><div className="muted">Loading analytics…</div></div></AppShell></RequireOnboarding>}>
      <AnalyticsPageContent />
    </Suspense>
  );
}
