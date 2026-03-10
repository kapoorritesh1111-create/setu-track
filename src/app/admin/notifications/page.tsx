"use client";

import { useEffect, useMemo, useState } from "react";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import SetuPage from "../../../components/layout/SetuPage";
import Button from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import LoadingState from "../../../components/ui/LoadingState";
import ErrorState from "../../../components/ui/ErrorState";
import { supabase } from "../../../lib/supabaseBrowser";
import { useProfile } from "../../../lib/useProfile";
import { toISODate } from "../../../lib/date";
import { buildOpsNotifications, severityLabel, type ContractorLite, type EntryLite, type OpsNotification, type ProjectBudgetLite } from "../../../lib/opsNotifications";
import { formatDateRange } from "../../../lib/format";

type PayrollRun = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
};

type SeverityFilter = "all" | "critical" | "high" | "medium" | "info";
type AreaFilter = "all" | OpsNotification["area"];

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toISODate(start), end: toISODate(end) };
}

export default function AdminNotificationsPage() {
  const { profile, userId, loading: profileLoading, error: profileError } = useProfile();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState<OpsNotification[]>([]);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [areaFilter, setAreaFilter] = useState<AreaFilter>("all");
  const [range, setRange] = useState(monthRange());

  const isManagerOrAdmin = profile?.role === "admin" || profile?.role === "manager";

  async function load() {
    if (!profile?.org_id || !userId || !isManagerOrAdmin) return;
    setBusy(true);
    setError("");

    try {
      const contractorScopeQuery = supabase
        .from("profiles")
        .select("id, full_name, hourly_rate, is_active, manager_id")
        .eq("org_id", profile.org_id)
        .eq("role", "contractor")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      const entryScopeQuery = supabase
        .from("v_time_entries")
        .select("user_id, full_name, entry_date, status, hours_worked, hourly_rate_snapshot, project_id, project_name")
        .eq("org_id", profile.org_id)
        .gte("entry_date", range.start)
        .lte("entry_date", range.end)
        .order("entry_date", { ascending: false });

      const projectBudgetQuery = supabase
        .from("projects")
        .select("id, name, budget_amount, budget_hours, budget_currency")
        .eq("org_id", profile.org_id);

      const payrollRunQuery = supabase
        .from("payroll_runs")
        .select("id, period_start, period_end, status")
        .eq("org_id", profile.org_id)
        .order("created_at", { ascending: false })
        .limit(6);

      const [contractorResp, entryResp, budgetResp, runResp] = await Promise.all([
        contractorScopeQuery,
        entryScopeQuery,
        projectBudgetQuery,
        payrollRunQuery,
      ]);

      if (contractorResp.error || entryResp.error || budgetResp.error || runResp.error) {
        throw new Error(contractorResp.error?.message || entryResp.error?.message || budgetResp.error?.message || runResp.error?.message || "Failed to load notifications.");
      }

      const contractorsRaw = ((contractorResp.data || []) as (ContractorLite & { manager_id?: string | null })[]);
      const scopedContractors = profile.role === "manager"
        ? contractorsRaw.filter((row) => row.manager_id === userId)
        : contractorsRaw;

      const allowedIds = new Set(scopedContractors.map((row) => row.id));
      const entriesRaw = (entryResp.data || []) as EntryLite[];
      const scopedEntries = profile.role === "manager"
        ? entriesRaw.filter((row) => allowedIds.has(row.user_id))
        : entriesRaw;

      const budgets = (budgetResp.data || []) as ProjectBudgetLite[];
      const runs = (runResp.data || []) as PayrollRun[];
      const periodLocked = runs.some((run) => run.period_start === range.start && run.period_end === range.end && run.status === "locked");

      const built = buildOpsNotifications({
        contractors: scopedContractors,
        rows: scopedEntries,
        budgets,
        periodLocked,
        exportsCount: 0,
      });

      setNotifications(built);
    } catch (e: any) {
      setError(e?.message || "Failed to load notifications.");
      setNotifications([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (profileLoading || !profile || !userId || !isManagerOrAdmin) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, profile?.org_id, profile?.role, userId, range.start, range.end]);

  const filtered = useMemo(() => {
    return notifications.filter((item) => {
      const severityOk = severityFilter === "all" || item.severity === severityFilter;
      const areaOk = areaFilter === "all" || item.area === areaFilter;
      return severityOk && areaOk;
    });
  }, [notifications, severityFilter, areaFilter]);

  const summary = useMemo(() => {
    const counts = {
      critical: notifications.filter((item) => item.severity === "critical").length,
      high: notifications.filter((item) => item.severity === "high").length,
      medium: notifications.filter((item) => item.severity === "medium").length,
      info: notifications.filter((item) => item.severity === "info").length,
    };
    const top = notifications[0] || null;
    return {
      ...counts,
      total: notifications.length,
      attention: counts.critical + counts.high,
      top,
    };
  }, [notifications]);

  return (
    <RequireOnboarding>
      <SetuPage
        title="Notifications"
        subtitle={`Operational signals for ${profile?.role === "manager" ? "your team" : "the organization"} • ${formatDateRange(range.start, range.end)}`}
        right={<Button variant="secondary" onClick={() => void load()} disabled={busy}>{busy ? "Refreshing…" : "Refresh"}</Button>}
      >
        {profileLoading ? (
          <LoadingState title="Loading notifications" description="Checking payroll blockers, approval drift, budget pressure, and rate gaps." />
        ) : profileError ? (
          <ErrorState message={profileError} onRetry={() => void load()} />
        ) : !profile ? (
          <ErrorState message="Profile missing." onRetry={() => void load()} />
        ) : !isManagerOrAdmin ? (
          <div className="alert alertWarn"><strong>Access restricted.</strong> This workspace is only available to managers and admins.</div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : busy ? (
          <LoadingState title="Loading notifications" description="Building the current signal queue from payroll, approvals, projects, and people data." />
        ) : (
          <>
            <div className="analyticsKpis">
              <div className="setuMetricCard"><div className="setuMetricLabel">Open signals</div><div className="setuMetricValue">{summary.total}</div><div className="setuMetricHint">Shared operational queue for the active range.</div></div>
              <div className="setuMetricCard"><div className="setuMetricLabel">Needs attention</div><div className="setuMetricValue">{summary.attention}</div><div className="setuMetricHint">Critical and high-priority blockers first.</div></div>
              <div className="setuMetricCard"><div className="setuMetricLabel">Critical</div><div className="setuMetricValue">{summary.critical}</div><div className="setuMetricHint">Signals most likely to block payroll or trust.</div></div>
              <div className="setuMetricCard"><div className="setuMetricLabel">Forecast watch</div><div className="setuMetricValue">{summary.info}</div><div className="setuMetricHint">Open payroll movement and follow-up indicators.</div></div>
            </div>

            <div className="setuCommandGrid" style={{ marginTop: 18 }}>
              <section className="setuSurfaceCard">
                <div className="setuSectionLead">
                  <div>
                    <div className="setuSectionTitle">Notification queue</div>
                    <div className="setuSectionHint">One workspace for the highest-value follow-up actions already surfacing across dashboard, projects, approvals, and analytics.</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                  {(["all", "critical", "high", "medium", "info"] as SeverityFilter[]).map((value) => (
                    <button key={value} type="button" className={`pill ${severityFilter === value ? "ok" : ""}`} onClick={() => setSeverityFilter(value)}>
                      {value === "all" ? "All severities" : severityLabel(value as Exclude<SeverityFilter, "all">)}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
                  {(["all", "payroll", "approvals", "projects", "people", "exports", "rates"] as AreaFilter[]).map((value) => (
                    <button key={value} type="button" className={`pill ${areaFilter === value ? "ok" : ""}`} onClick={() => setAreaFilter(value)}>
                      {value === "all" ? "All areas" : value}
                    </button>
                  ))}
                </div>

                {filtered.length === 0 ? (
                  <EmptyState title="No signals match this filter" description="Try another severity or area filter, or refresh the workspace." />
                ) : (
                  <div className="setuFocusList">
                    {filtered.map((item) => (
                      <a key={item.id} href={item.href} className="setuFocusItem" style={{ textDecoration: "none" }}>
                        <span>{item.title}</span>
                        <strong>{severityLabel(item.severity)} • {item.metric}</strong>
                        <span className="muted" style={{ fontSize: 13 }}>{item.body}</span>
                      </a>
                    ))}
                  </div>
                )}
              </section>

              <section className="setuSurfaceCard">
                <div className="setuSectionLead">
                  <div>
                    <div className="setuSectionTitle">Priority snapshot</div>
                    <div className="setuSectionHint">A lightweight summary so managers can decide what to address first.</div>
                  </div>
                </div>

                <div className="setuSignalGrid">
                  <div className="setuSignalCard">
                    <div className="setuSignalLabel">Top issue</div>
                    <strong>{summary.top?.title || "No open blockers"}</strong>
                    <span>{summary.top ? `${severityLabel(summary.top.severity)} priority • ${summary.top.metric}` : "Operations are clear for the current range."}</span>
                  </div>
                  <div className="setuSignalCard">
                    <div className="setuSignalLabel">Critical pressure</div>
                    <strong>{summary.critical}</strong>
                    <span>{summary.critical ? "Resolve these first to reduce payroll and finance risk." : "No critical issues in the queue."}</span>
                  </div>
                  <div className="setuSignalCard">
                    <div className="setuSignalLabel">Budget + approvals</div>
                    <strong>{notifications.filter((item) => item.area === "projects" || item.area === "approvals").length}</strong>
                    <span>Combined project and review signals often drive payroll delay.</span>
                  </div>
                  <div className="setuSignalCard">
                    <div className="setuSignalLabel">Rate + people audit</div>
                    <strong>{notifications.filter((item) => item.area === "people" || item.area === "rates").length}</strong>
                    <span>Use this to catch missing submissions and weak rate baselines.</span>
                  </div>
                </div>

                <div className="setuMiniTable" style={{ marginTop: 18 }}>
                  <div className="setuMiniTableHead">Recommended sequence</div>
                  <div className="setuMiniRow"><span>1. Clear blockers</span><strong>{summary.critical + summary.high}</strong></div>
                  <div className="setuMiniRow"><span>2. Review stale approvals</span><strong>{notifications.filter((item) => item.id === "stale-approvals").length ? "Queued" : "Clear"}</strong></div>
                  <div className="setuMiniRow"><span>3. Check budget risk</span><strong>{notifications.filter((item) => item.id === "project-budget-risk").length ? "Queued" : "Clear"}</strong></div>
                  <div className="setuMiniRow"><span>4. Confirm payroll movement</span><strong>{notifications.filter((item) => item.id === "forecast-open").length ? "Open" : "Stable"}</strong></div>
                </div>
              </section>
            </div>
          </>
        )}
      </SetuPage>
    </RequireOnboarding>
  );
}
