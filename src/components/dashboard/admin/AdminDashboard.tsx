"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseBrowser";
import { apiJson } from "../../../lib/api/client";
import { presetLabel, presetToRange, previousRangeFor, type DatePreset } from "../../../lib/dateRanges";
import { formatDateRange, formatDateTime, formatMoney } from "../../../lib/format";
import DateRangeToolbar from "../../ui/DateRangeToolbar";
import { EmptyState } from "../../ui/EmptyState";
import { StatusChip } from "../../ui/StatusChip";

type Contractor = { id: string; full_name: string | null; hourly_rate: number | null; is_active?: boolean | null };
type VRow = {
  id?: string;
  user_id: string;
  full_name?: string | null;
  hours_worked: number | null;
  hourly_rate_snapshot?: number | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  entry_date: string;
  project_id?: string | null;
  project_name?: string | null;
};

type AdminSummary = {
  total_hours: number;
  total_amount: number;
  pending_entries: number;
  active_contractors: number;
  payroll_state?: string;
  payroll_run_id?: string | null;
  closed_at?: string | null;
  paid_at?: string | null;
  currency?: string;
};

type ExportEvent = {
  id: string;
  created_at: string;
  export_type: string;
  file_format: string | null;
  actor_name_snapshot: string | null;
  project_id: string | null;
  metadata?: Record<string, unknown> | null;
};

type PayrollRunLite = {
  id: string;
  period_start: string;
  period_end: string;
  total_amount: number | null;
  total_hours: number | null;
  created_at: string | null;
  status: string | null;
};

type ProjectBudgetLite = {
  id: string;
  name: string;
  budget_amount: number | null;
  budget_hours: number | null;
  budget_currency: string | null;
};

function pctChange(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return ((current - previous) / previous) * 100;
}

export default function AdminDashboard({ orgId }: { orgId: string; userId: string }) {
  const router = useRouter();
  const initial = presetToRange("current_month", "sunday");
  const [preset, setPreset] = useState<DatePreset>("current_month");
  const [startDate, setStartDate] = useState(initial.start);
  const [endDate, setEndDate] = useState(initial.end);

  const [rows, setRows] = useState<VRow[]>([]);
  const [previousRows, setPreviousRows] = useState<VRow[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [previousSummary, setPreviousSummary] = useState<AdminSummary | null>(null);
  const [events, setEvents] = useState<ExportEvent[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRunLite[]>([]);
  const [projectBudgets, setProjectBudgets] = useState<ProjectBudgetLite[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [periodLocked, setPeriodLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const [blockers, setBlockers] = useState<any[] | null>(null);
  const [blockerTotals, setBlockerTotals] = useState<{ entries: number; hours: number; amount: number } | null>(null);

  useEffect(() => {
    if (preset === "custom") return;
    const next = presetToRange(preset, "sunday");
    setStartDate(next.start);
    setEndDate(next.end);
  }, [preset]);

  const previousRange = useMemo(() => previousRangeFor(startDate, endDate), [startDate, endDate]);

  async function fetchSummary(period_start: string, period_end: string) {
    const res = await apiJson<{ ok: true; summary: AdminSummary }>("/api/dashboard/admin-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period_start, period_end }),
    });
    return res.summary || null;
  }

  async function load() {
    setBusy(true);
    setMessage("");
    try {
      const currentEntryQuery = supabase
        .from("v_time_entries")
        .select("id,user_id,full_name,hours_worked,hourly_rate_snapshot,status,entry_date,project_id,project_name")
        .eq("org_id", orgId)
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);

      const previousEntryQuery = supabase
        .from("v_time_entries")
        .select("id,user_id,full_name,hours_worked,hourly_rate_snapshot,status,entry_date,project_id,project_name")
        .eq("org_id", orgId)
        .gte("entry_date", previousRange.start)
        .lte("entry_date", previousRange.end);

      const contractorQuery = supabase
        .from("profiles")
        .select("id,full_name,hourly_rate,is_active")
        .eq("org_id", orgId)
        .eq("role", "contractor")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      const runQuery = supabase
        .from("payroll_runs")
        .select("id,period_start,period_end,total_amount,total_hours,created_at,status")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(6);

      const budgetQuery = supabase
        .from("projects")
        .select("id,name,budget_amount,budget_hours,budget_currency")
        .eq("org_id", orgId);

      const lockPromise = apiJson<{ ok: boolean; locked: boolean; locked_at: string | null }>(`/api/pay-period/status?${new URLSearchParams({ period_start: startDate, period_end: endDate }).toString()}`)
        .catch(() => ({ ok: true, locked: false, locked_at: null }));

      const exportPromise = apiJson<{ ok: boolean; events?: ExportEvent[] }>(`/api/exports/recent?${new URLSearchParams({ period_start: startDate, period_end: endDate, limit: "6" }).toString()}`)
        .catch(() => ({ ok: false, events: [] }));

      const [
        { data: currentEntries, error: currentErr },
        { data: previousEntries, error: previousErr },
        { data: contractorRows, error: contractorErr },
        { data: runRows, error: runErr },
        { data: budgetRows, error: budgetErr },
        selectedSummary,
        prevSummary,
        lockStatus,
        exportResponse,
      ] = await Promise.all([
        currentEntryQuery,
        previousEntryQuery,
        contractorQuery,
        runQuery,
        budgetQuery,
        fetchSummary(startDate, endDate),
        fetchSummary(previousRange.start, previousRange.end),
        lockPromise,
        exportPromise,
      ]);

      if (currentErr || previousErr || contractorErr || runErr || budgetErr) {
        throw new Error(currentErr?.message || previousErr?.message || contractorErr?.message || runErr?.message || budgetErr?.message || "Failed to load dashboard");
      }

      setRows((currentEntries || []) as VRow[]);
      setPreviousRows((previousEntries || []) as VRow[]);
      setContractors((contractorRows || []) as Contractor[]);
      setPayrollRuns((runRows || []) as PayrollRunLite[]);
      setProjectBudgets((budgetRows || []) as ProjectBudgetLite[]);
      setSummary(selectedSummary);
      setPreviousSummary(prevSummary);
      setPeriodLocked(!!lockStatus.locked);
      setLockedAt(lockStatus.locked_at || null);
      setEvents(exportResponse.events || []);
    } catch (e: any) {
      setRows([]);
      setPreviousRows([]);
      setContractors([]);
      setPayrollRuns([]);
      setSummary(null);
      setPreviousSummary(null);
      setEvents([]);
      setProjectBudgets([]);
      setMessage(e?.message || "Failed to load dashboard");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!orgId || !startDate || !endDate) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, startDate, endDate]);

  const insights = useMemo(() => {
    const totalHours = rows.reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
    const approvedHours = rows.filter((row) => row.status === "approved").reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
    const submittedHours = rows.filter((row) => row.status === "submitted").reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
    const pendingApprovals = rows.filter((row) => row.status === "submitted").length;
    const missingSubmissions = contractors.filter((contractor) => !rows.some((row) => row.user_id === contractor.id)).length;
    const previousHours = previousRows.reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
    const currentPayroll = Number(summary?.total_amount ?? rows.filter((row) => row.status === "approved").reduce((sum, row) => sum + Number(row.hours_worked || 0) * Number(row.hourly_rate_snapshot || 0), 0));
    const previousPayroll = Number(previousSummary?.total_amount ?? previousRows.filter((row) => row.status === "approved").reduce((sum, row) => sum + Number(row.hours_worked || 0) * Number(row.hourly_rate_snapshot || 0), 0));

    const projectBudgetMap = new Map(projectBudgets.map((project) => [project.id, project]));
    const projectMap = new Map<string, { id: string; name: string; hours: number; cost: number; people: Set<string>; pending: number; budgetAmount: number; budgetHours: number; currency: string; health: "no_budget" | "within" | "near" | "over" }>();
    for (const row of rows) {
      const key = row.project_id || row.project_name || "unassigned";
      const budget = row.project_id ? projectBudgetMap.get(row.project_id) : null;
      const existing = projectMap.get(key) || { id: key, name: row.project_name || "Unassigned", hours: 0, cost: 0, people: new Set<string>(), pending: 0, budgetAmount: Number(budget?.budget_amount || 0), budgetHours: Number(budget?.budget_hours || 0), currency: budget?.budget_currency || "USD", health: "no_budget" as const };
      existing.hours += Number(row.hours_worked || 0);
      existing.cost += Number(row.hours_worked || 0) * Number(row.hourly_rate_snapshot || 0);
      existing.people.add(row.user_id);
      if (row.status === "submitted") existing.pending += 1;
      const amountRatio = existing.budgetAmount > 0 ? existing.cost / existing.budgetAmount : 0;
      const hoursRatio = existing.budgetHours > 0 ? existing.hours / existing.budgetHours : 0;
      const ratio = Math.max(amountRatio, hoursRatio);
      existing.health = existing.budgetAmount <= 0 && existing.budgetHours <= 0 ? "no_budget" : ratio >= 1 ? "over" : ratio >= 0.8 ? "near" : "within";
      projectMap.set(key, existing);
    }

    const topProjects = Array.from(projectMap.values())
      .map((project) => ({ ...project, peopleCount: project.people.size }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    const peopleNeedingRates = contractors.filter((contractor) => !Number(contractor.hourly_rate || 0)).length;
    const approvalsReadyPct = totalHours ? (approvedHours / totalHours) * 100 : 0;
    const totalProjects = projectMap.size;
    const budgetedProjects = Array.from(projectMap.values()).filter((project) => project.budgetAmount > 0 || project.budgetHours > 0).length;
    const overBudgetProjects = topProjects.filter((project) => project.health === "over").length;
    const nearBudgetProjects = topProjects.filter((project) => project.health === "near").length;
    const noBudgetProjects = topProjects.filter((project) => project.health === "no_budget").length;
    const totalBudgetAmount = topProjects.reduce((sum, project) => sum + Number(project.budgetAmount || 0), 0);
    const pendingForecast = rows.filter((row) => row.status === "submitted").reduce((sum, row) => sum + Number(row.hours_worked || 0) * Number(row.hourly_rate_snapshot || 0), 0);
    const projectedPayroll = currentPayroll + pendingForecast;
    const staleApprovals = rows.filter((row) => row.status === "submitted" && ((Date.now() - new Date(`${row.entry_date}T00:00:00`).getTime()) / 86400000) > 2).length;
    const dailyByUser = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.user_id}__${row.entry_date}`;
      dailyByUser.set(key, (dailyByUser.get(key) || 0) + Number(row.hours_worked || 0));
    }
    const overtimeDays = Array.from(dailyByUser.values()).filter((hours) => hours > 10).length;
    const opsAlerts = overBudgetProjects + nearBudgetProjects + missingSubmissions + staleApprovals + peopleNeedingRates + overtimeDays;
    const highestProjectCost = Math.max(1, ...Array.from(projectMap.values()).map((project) => project.cost));
    const budgetCoveragePct = totalBudgetAmount > 0 ? Math.min(999, (currentPayroll / totalBudgetAmount) * 100) : 0;
    const readinessLabel = periodLocked ? "Locked" : pendingApprovals === 0 ? "Ready" : "Attention";

    const contractorCostMap = new Map<string, { id: string; name: string; hours: number; cost: number }>();
    for (const row of rows) {
      const key = row.user_id;
      const current = contractorCostMap.get(key) || { id: key, name: row.full_name || "Contractor", hours: 0, cost: 0 };
      current.hours += Number(row.hours_worked || 0);
      current.cost += Number(row.hours_worked || 0) * Number(row.hourly_rate_snapshot || 0);
      contractorCostMap.set(key, current);
    }
    const topContractors = Array.from(contractorCostMap.values()).sort((a, b) => b.cost - a.cost).slice(0, 5);
    const monthlyTrend = [
      { label: "Prior payroll", value: previousPayroll, hint: formatDateRange(previousRange.start, previousRange.end) },
      { label: "Approved payroll", value: currentPayroll, hint: formatDateRange(startDate, endDate) },
      { label: "Forecast payroll", value: projectedPayroll, hint: `${formatMoney(pendingForecast)} pending` },
    ];
    return {
      totalHours,
      approvedHours,
      submittedHours,
      pendingApprovals,
      missingSubmissions,
      currentPayroll,
      previousPayroll,
      payrollChange: pctChange(currentPayroll, previousPayroll),
      hoursChange: pctChange(totalHours, previousHours),
      topProjects,
      peopleNeedingRates,
      approvalsReadyPct,
      totalProjects,
      budgetedProjects,
      overBudgetProjects,
      nearBudgetProjects,
      noBudgetProjects,
      totalBudgetAmount,
      pendingForecast,
      projectedPayroll,
      staleApprovals,
      overtimeDays,
      opsAlerts,
      highestProjectCost,
      budgetCoveragePct,
      readinessLabel,
      topContractors,
      monthlyTrend,
    };
  }, [rows, previousRows, contractors, summary, previousSummary, projectBudgets, periodLocked, previousRange.start, previousRange.end, startDate, endDate]);

  async function previewClose() {
    try {
      setPreviewBusy(true);
      setMessage("");
      const res = await apiJson<{ ok: true; blocked: boolean; totals: any; rows: any[] }>("/api/pay-period/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_start: startDate, period_end: endDate }),
      });
      setBlockers(res.rows || []);
      setBlockerTotals(res.totals || null);
      setMessage((res.rows || []).length === 0 ? "Ready to close. No blockers found." : `Blocked: ${(res.totals?.entries ?? 0)} entries need approval before closing.`);
    } catch (e: any) {
      setMessage(e?.message || "Failed to preview close");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function closePayroll() {
    setClosing(true);
    setMessage("");
    try {
      const r = await apiJson<{ ok: boolean; error?: string }>("/api/pay-period/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_start: startDate, period_end: endDate }),
      });
      if (!r.ok) throw new Error(r.error || "Unable to close payroll");
      router.push(`/reports/payroll?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&preset=${encodeURIComponent(preset)}&locked=1`);
    } catch (e: any) {
      setMessage(e?.message || "Failed to close payroll");
    } finally {
      setClosing(false);
    }
  }

  const metrics = [
    { label: "Active contractors", value: String(Number(summary?.active_contractors ?? contractors.length)), hint: `${insights.missingSubmissions} missing submissions` },
    { label: "Hours this period", value: insights.totalHours.toFixed(2), hint: `${insights.hoursChange >= 0 ? "+" : ""}${insights.hoursChange.toFixed(1)}% vs prior range` },
    { label: "Payroll this period", value: formatMoney(insights.currentPayroll), hint: `${insights.payrollChange >= 0 ? "+" : ""}${insights.payrollChange.toFixed(1)}% vs prior range` },
    { label: "Forecast payroll", value: formatMoney(insights.projectedPayroll), hint: `${formatMoney(insights.pendingForecast)} still pending approvals` },
    { label: "Pending approvals", value: String(insights.pendingApprovals), hint: `${insights.submittedHours.toFixed(2)} hrs awaiting review` },
    { label: "Budget alerts", value: String(insights.overBudgetProjects), hint: `${insights.nearBudgetProjects} near budget • ${insights.noBudgetProjects} without budget` },
    { label: "Operations signals", value: String(insights.opsAlerts), hint: `${insights.staleApprovals} stale • ${insights.overtimeDays} overtime day alerts` },
  ];

  if (!busy && rows.length === 0 && !message) {
    return (
      <div className="setuDashboardWrap">
        <div className="setuWorkspaceHero">
          <div>
            <div className="setuWorkspaceEyebrow">Connect · Grow · Track</div>
            <h2 className="setuWorkspaceTitle">Command Center</h2>
            <p className="setuWorkspaceCopy">Use one surface to review approvals, payroll readiness, project labor cost, and recent operating events.</p>
          </div>
          <DateRangeToolbar
            preset={preset}
            start={startDate}
            end={endDate}
            onPresetChange={setPreset}
            onStartChange={(value) => { setPreset("custom"); setStartDate(value); }}
            onEndChange={(value) => { setPreset("custom"); setEndDate(value); }}
            onRefresh={() => void load()}
            busy={busy}
          />
        </div>
        <div className="card cardPad">
          <EmptyState title="No activity in this period" description="Try a broader date range or send contractors to My Work to start logging time." action={<button className="btnPrimary" onClick={() => router.push("/timesheet")}>Open My Work</button>} />
        </div>
      </div>
    );
  }

  return (
    <div className="setuDashboardWrap">
      {message ? (
        <div className="alert alertInfo">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message}</pre>
        </div>
      ) : null}

      <div className="setuWorkspaceHero">
        <div>
          <div className="setuWorkspaceEyebrow">Connect · Grow · Track</div>
          <h2 className="setuWorkspaceTitle">Command Center</h2>
          <p className="setuWorkspaceCopy">Operational status, payroll readiness, and project labor intelligence aligned to {presetLabel(preset, startDate, endDate).toLowerCase()}.</p>
        </div>
        <div className="setuWorkspaceActions">
          <DateRangeToolbar
            preset={preset}
            start={startDate}
            end={endDate}
            onPresetChange={setPreset}
            onStartChange={(value) => { setPreset("custom"); setStartDate(value); }}
            onEndChange={(value) => { setPreset("custom"); setEndDate(value); }}
            onRefresh={() => void load()}
            busy={busy}
            compact
          />
          <div className="setuHeaderActions">
            <button className="pill" onClick={() => router.push(`/analytics?preset=${encodeURIComponent(preset)}&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`)}>Analytics</button>
            <button className="pill" onClick={() => router.push(`/approvals?scope=all`)}>Review approvals</button>
            <button className="btnPrimary" onClick={() => router.push(`/reports/payroll?preset=${encodeURIComponent(preset)}&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`)}>Open payroll report</button>
          </div>
        </div>
      </div>

      <div className="setuKpiGrid">
        {metrics.map((metric) => (
          <div className="setuMetricCard" key={metric.label}>
            <div className="setuMetricLabel">{metric.label}</div>
            <div className="setuMetricValue">{metric.value}</div>
            <div className="setuMetricHint">{metric.hint}</div>
          </div>
        ))}
      </div>

      <div className="setuTrendSummary">
        <div className="setuMetricCard"><div className="setuMetricLabel">Approved payroll</div><div className="setuMetricValue">{formatMoney(insights.currentPayroll)}</div><div className="setuMetricHint">Locked to approved work in the selected range.</div></div>
        <div className="setuMetricCard"><div className="setuMetricLabel">Pending payroll</div><div className="setuMetricValue">{formatMoney(insights.pendingForecast)}</div><div className="setuMetricHint">Submitted work that still needs approval.</div></div>
        <div className="setuMetricCard"><div className="setuMetricLabel">Projects at risk</div><div className="setuMetricValue">{insights.overBudgetProjects + insights.nearBudgetProjects}</div><div className="setuMetricHint">{insights.overBudgetProjects} over budget • {insights.nearBudgetProjects} near budget.</div></div>
        <div className="setuMetricCard"><div className="setuMetricLabel">Operational integrity</div><div className="setuMetricValue">{insights.peopleNeedingRates + insights.staleApprovals + insights.overtimeDays}</div><div className="setuMetricHint">Missing rates, stale approvals, and overtime days.</div></div>
      </div>

      <div className="setuSignalGrid">
        <div className="setuSignalCard">
          <div className="setuSignalLabel">Approval backlog</div>
          <strong>{insights.pendingApprovals}</strong>
          <span>{insights.submittedHours.toFixed(2)} hours are still waiting for signoff.</span>
        </div>
        <div className="setuSignalCard">
          <div className="setuSignalLabel">Missing timesheets</div>
          <strong>{insights.missingSubmissions}</strong>
          <span>Active contractors with no entries in {presetLabel(preset, startDate, endDate).toLowerCase()}.</span>
        </div>
        <div className="setuSignalCard">
          <div className="setuSignalLabel">Rate coverage</div>
          <strong>{insights.peopleNeedingRates}</strong>
          <span>Contractors still missing an hourly rate snapshot or default rate.</span>
        </div>
        <div className="setuSignalCard">
          <div className="setuSignalLabel">Budget coverage</div>
          <strong>{insights.totalBudgetAmount > 0 ? `${Math.min(999, insights.budgetCoveragePct).toFixed(0)}%` : '—'}</strong>
          <span>{insights.totalBudgetAmount > 0 ? `${formatMoney(insights.currentPayroll)} against ${formatMoney(insights.totalBudgetAmount)}` : 'Add project budgets to unlock burn tracking.'}</span>
        </div>
      </div>

      <div className="setuCommandGrid">
        <section className="setuSurfaceCard">
          <div className="setuSectionLead">
            <div>
              <div className="setuSectionTitle">Payroll readiness</div>
              <div className="setuSectionHint">Know whether this period is ready to close and what still needs attention.</div>
            </div>
            {periodLocked ? <StatusChip state="locked" /> : <StatusChip state={insights.pendingApprovals === 0 ? "approved" : "submitted"} />}
          </div>
          <div className="setuReadinessList">
            <div className="setuReadinessRow"><span>Approved hours</span><strong>{insights.approvedHours.toFixed(2)}</strong></div>
            <div className="setuReadinessRow"><span>Awaiting approvals</span><strong>{insights.submittedHours.toFixed(2)} hrs</strong></div>
            <div className="setuReadinessRow"><span>Last payroll state</span><strong>{summary?.payroll_state || "open"}</strong></div>
            <div className="setuReadinessRow"><span>Current range</span><strong>{formatDateRange(startDate, endDate)}</strong></div>
            {lockedAt ? <div className="setuReadinessRow"><span>Locked at</span><strong>{formatDateTime(lockedAt)}</strong></div> : null}
          </div>
          <div className="setuActionRow">
            <button className="pill" onClick={previewClose} disabled={previewBusy}>{previewBusy ? "Checking…" : "Preview close"}</button>
            {periodLocked ? (
              <button className="btnPrimary" onClick={() => router.push(`/reports/payroll?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&locked=1`)}>View payroll report</button>
            ) : (
              <button className="btnPrimary" onClick={closePayroll} disabled={closing}>{closing ? "Closing…" : "Close payroll"}</button>
            )}
          </div>
          {blockers && blockers.length > 0 ? (
            <div className="setuMiniTable">
              <div className="setuMiniTableHead">Blockers {blockerTotals ? `• ${blockerTotals.entries} entries` : ""}</div>
              {blockers.slice(0, 4).map((b, idx) => (
                <div className="setuMiniRow" key={idx}><span>{b.contractor_name}</span><strong>{Number(b.hours || 0).toFixed(2)} hrs</strong></div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="setuSurfaceCard">
          <div className="setuSectionLead">
            <div>
              <div className="setuSectionTitle">Operational focus</div>
              <div className="setuSectionHint">A manager-first queue for review, follow-up, and export completion.</div>
            </div>
          </div>
          <div className="setuFocusList">
            <button className="setuFocusItem" onClick={() => router.push("/approvals?scope=all")}><span>Approvals pending</span><strong>{insights.pendingApprovals}</strong></button>
            <button className="setuFocusItem" onClick={() => router.push("/profiles")}><span>Missing timesheets</span><strong>{insights.missingSubmissions}</strong></button>
            <button className="setuFocusItem" onClick={() => router.push("/profiles")}><span>Missing contractor rates</span><strong>{insights.peopleNeedingRates}</strong></button>
            <button className="setuFocusItem" onClick={() => router.push(`/projects?preset=${encodeURIComponent(preset)}&rangeStart=${encodeURIComponent(startDate)}&rangeEnd=${encodeURIComponent(endDate)}&healthFilter=over`)}><span>Over-budget projects</span><strong>{insights.overBudgetProjects}</strong></button>
            <button className="setuFocusItem" onClick={() => router.push(`/reports/payroll?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`)}><span>Exports / receipts</span><strong>{events.length}</strong></button>
          </div>
        </section>
      </div>

      <div className="setuCommandGrid setuCommandGridBottom">
        <section className="setuSurfaceCard">
          <div className="setuSectionLead">
            <div>
              <div className="setuSectionTitle">Financial snapshot</div>
              <div className="setuSectionHint">Compare current labor spend to the prior range and review project concentration.</div>
            </div>
          </div>
          <div className="setuTrendSummary">
            <div className="setuTrendCard"><span>Current payroll</span><strong>{formatMoney(insights.currentPayroll)}</strong></div>
            <div className="setuTrendCard"><span>Prior payroll</span><strong>{formatMoney(insights.previousPayroll)}</strong></div>
            <div className="setuTrendCard"><span>Payroll variance</span><strong className={insights.payrollChange >= 0 ? "isPositive" : "isNegative"}>{insights.payrollChange >= 0 ? "+" : ""}{insights.payrollChange.toFixed(1)}%</strong></div>
            <div className="setuTrendCard"><span>Approval coverage</span><strong>{insights.approvalsReadyPct.toFixed(0)}%</strong></div>
            <div className="setuTrendCard"><span>Budget capacity</span><strong>{insights.totalBudgetAmount > 0 ? formatMoney(insights.totalBudgetAmount) : "—"}</strong></div>
          </div>
          <div className="setuBarsList">
            {insights.topProjects.map((project) => {
              const width = insights.topProjects[0]?.cost ? Math.max(8, (project.cost / insights.topProjects[0].cost) * 100) : 8;
              return (
                <div className="setuBarBlock" key={project.id}>
                  <div className="setuBarHead"><span>{project.name}</span><span>{formatMoney(project.cost)} • {project.hours.toFixed(2)} hrs</span></div>
                  <div className="setuBarTrack"><div className="setuBarFill" style={{ width: `${width}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="setuSurfaceCard">
          <div className="setuSectionLead">
            <div>
              <div className="setuSectionTitle">Project health</div>
              <div className="setuSectionHint">Top projects by labor cost, now with budget health, variance risk, and no-budget visibility.</div>
            </div>
            <button className="pill" onClick={() => router.push("/projects")}>View projects</button>
          </div>
          <div className="setuProjectList">
            {insights.topProjects.map((project) => (
              <button className="setuProjectItem" key={project.id} onClick={() => router.push(`/reports/payroll?project_id=${encodeURIComponent(project.id)}&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`)}>
                <div style={{ display: "grid", gap: 8, flex: 1, minWidth: 0 }}>
                  <div>
                    <div className="setuProjectName">{project.name}</div>
                    <div className="setuProjectMeta">{project.peopleCount} contractors • {project.pending} pending items • {project.health === "over" ? "Over budget" : project.health === "near" ? "Near budget" : project.health === "within" ? "Within budget" : "No budget"}</div>
                  </div>
                  <div className="setuBarTrack"><div className="setuBarFill" style={{ width: `${Math.max(8, (project.cost / Math.max(insights.highestProjectCost, 1)) * 100)}%` }} /></div>
                  <div className="setuProjectMeta">{project.budgetAmount > 0 ? `${Math.min(999, (project.cost / Math.max(project.budgetAmount, 1)) * 100).toFixed(0)}% of budget used` : `${project.hours.toFixed(2)} hours logged`}</div>
                </div>
                <div className="setuProjectRight">
                  <div>{formatMoney(project.cost, project.currency)}</div>
                  <div className="muted">{project.budgetAmount > 0 ? `${formatMoney(project.budgetAmount, project.currency)} budget` : `${project.hours.toFixed(2)} hrs`}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="setuCommandGrid setuCommandGridBottom">
        <section className="setuSurfaceCard">
          <div className="setuSectionLead">
            <div>
              <div className="setuSectionTitle">Top contractor cost drivers</div>
              <div className="setuSectionHint">See which workers are driving labor cost in the active finance range.</div>
            </div>
          </div>
          <div className="setuBarsList">
            {insights.topContractors.map((person) => {
              const width = insights.topContractors[0]?.cost ? Math.max(8, (person.cost / insights.topContractors[0].cost) * 100) : 8;
              return (
                <div className="setuBarBlock" key={person.id}>
                  <div className="setuBarHead"><span>{person.name}</span><span>{formatMoney(person.cost)} • {person.hours.toFixed(2)} hrs</span></div>
                  <div className="setuBarTrack"><div className="setuBarFill" style={{ width: `${width}%` }} /></div>
                </div>
              );
            })}
            {!insights.topContractors.length ? <div className="muted">No contractor cost drivers in this period yet.</div> : null}
          </div>
        </section>

        <section className="setuSurfaceCard">
          <div className="setuSectionLead">
            <div>
              <div className="setuSectionTitle">Monthly payroll trend</div>
              <div className="setuSectionHint">Approved payroll, prior payroll, and current forecast in one view.</div>
            </div>
          </div>
          <div className="setuBarsList">
            {insights.monthlyTrend.map((item) => {
              const max = Math.max(...insights.monthlyTrend.map((x) => Number(x.value || 0)), 1);
              const width = Math.max(8, (Number(item.value || 0) / max) * 100);
              return (
                <div className="setuBarBlock" key={item.label}>
                  <div className="setuBarHead"><span>{item.label}</span><span>{formatMoney(Number(item.value || 0))}</span></div>
                  <div className="setuBarTrack"><div className="setuBarFill" style={{ width: `${width}%` }} /></div>
                  <div className="setuProjectMeta">{item.hint}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="setuCommandGrid setuCommandGridBottom">
        <section className="setuSurfaceCard">
          <div className="setuSectionLead">
            <div>
              <div className="setuSectionTitle">Recent activity</div>
              <div className="setuSectionHint">Exports and payroll events connected to this command surface.</div>
            </div>
          </div>
          <div className="setuActivityList">
            {events.length ? events.map((event) => (
              <div className="setuActivityItem" key={event.id}>
                <div>
                  <div className="setuActivityTitle">{event.export_type || "Export generated"}</div>
                  <div className="setuActivityMeta">{event.actor_name_snapshot || "SETU TRACK"} • {event.file_format || "file"}</div>
                </div>
                <div className="muted">{formatDateTime(event.created_at)}</div>
              </div>
            )) : (
              <div className="muted">No export activity in this period yet.</div>
            )}
          </div>
        </section>

        <section className="setuSurfaceCard">
          <div className="setuSectionLead">
            <div>
              <div className="setuSectionTitle">Recent payroll runs</div>
              <div className="setuSectionHint">Use runs to explain cost movement and export history.</div>
            </div>
            <button className="pill" onClick={() => router.push("/reports/payroll-runs")}>Payroll runs</button>
          </div>
          <div className="setuActivityList">
            {payrollRuns.map((run) => (
              <div className="setuActivityItem" key={run.id}>
                <div>
                  <div className="setuActivityTitle">{run.period_start} → {run.period_end}</div>
                  <div className="setuActivityMeta">{run.status || "open"} • {Number(run.total_hours || 0).toFixed(2)} hrs</div>
                </div>
                <div>{formatMoney(Number(run.total_amount || 0))}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
