"use client";

import { useEffect, useMemo, useState } from "react";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import Button from "../../../components/ui/Button";
import LoadingState from "../../../components/ui/LoadingState";
import ErrorState from "../../../components/ui/ErrorState";
import DateRangeToolbar from "../../../components/ui/DateRangeToolbar";
import { EmptyState } from "../../../components/ui/EmptyState";
import { presetToRange, type DatePreset } from "../../../lib/dateRanges";
import { useProfile } from "../../../lib/useProfile";
import { supabase } from "../../../lib/supabaseBrowser";
import { formatDateRange, formatMoney } from "../../../lib/format";
import { apiJson } from "../../../lib/api/client";
import {
  buildOpsNotifications,
  getMissingRateUsers,
  getMissingTimesheetUsers,
  getPendingForecast,
  getProjectRiskSummary,
  getStaleApprovals,
  getSubmittedHours,
  getOvertimeRows,
  severityLabel,
  type ContractorLite,
  type EntryLite,
  type ProjectBudgetLite,
} from "../../../lib/opsNotifications";

type ExportEvent = { id: string; created_at: string; export_type: string | null; file_format: string | null; actor_name_snapshot: string | null };

export default function NotificationsPage() {
  const { loading, profile } = useProfile() as any;
  const initialRange = presetToRange("current_month");
  const [preset, setPreset] = useState<DatePreset>("current_month");
  const [start, setStart] = useState(initialRange.start);
  const [end, setEnd] = useState(initialRange.end);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<EntryLite[]>([]);
  const [contractors, setContractors] = useState<ContractorLite[]>([]);
  const [budgets, setBudgets] = useState<ProjectBudgetLite[]>([]);
  const [locked, setLocked] = useState(false);
  const [events, setEvents] = useState<ExportEvent[]>([]);

  useEffect(() => {
    if (preset === "custom") return;
    const next = presetToRange(preset as Exclude<DatePreset, "custom">);
    setStart(next.start);
    setEnd(next.end);
  }, [preset]);

  useEffect(() => {
    if (loading || !profile?.org_id) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError("");
      try {
        const [
          { data: entryRows, error: entryError },
          { data: contractorRows, error: contractorError },
          { data: budgetRows, error: budgetError },
        ] = await Promise.all([
          supabase
            .from("v_time_entries")
            .select("user_id, full_name, entry_date, status, hours_worked, hourly_rate_snapshot, project_id, project_name")
            .eq("org_id", profile.org_id)
            .gte("entry_date", start)
            .lte("entry_date", end),
          supabase
            .from("profiles")
            .select("id, full_name, hourly_rate, is_active")
            .eq("org_id", profile.org_id)
            .eq("role", "contractor")
            .eq("is_active", true),
          supabase
            .from("projects")
            .select("id, name, budget_amount, budget_hours, budget_currency")
            .eq("org_id", profile.org_id),
        ]);

        const lockJson = await apiJson<{ ok: boolean; locked: boolean; locked_at: string | null }>(`/api/pay-period/status?${new URLSearchParams({ period_start: start, period_end: end }).toString()}`)
          .catch(() => ({ ok: false, locked: false, locked_at: null }));
        const exportJson = await apiJson<{ ok: boolean; events?: ExportEvent[] }>(`/api/exports/recent?${new URLSearchParams({ period_start: start, period_end: end, limit: "8" }).toString()}`)
          .catch(() => ({ ok: false, events: [] }));

        if (entryError || contractorError || budgetError) {
          throw new Error(entryError?.message || contractorError?.message || budgetError?.message || "Failed to load operations notifications.");
        }

        if (!cancelled) {
          setRows((entryRows || []) as EntryLite[]);
          setContractors((contractorRows || []) as ContractorLite[]);
          setBudgets((budgetRows || []) as ProjectBudgetLite[]);
          setLocked(!!lockJson?.locked);
          setEvents((exportJson?.events || []) as ExportEvent[]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load operations notifications.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, profile?.org_id, start, end]);

  const notificationState = useMemo(() => {
    const notifications = buildOpsNotifications({ contractors, rows, budgets, periodLocked: locked, exportsCount: events.length });
    const missingTimesheets = getMissingTimesheetUsers(contractors, rows);
    const missingRates = getMissingRateUsers(contractors, rows);
    const staleApprovals = getStaleApprovals(rows);
    const overtime = getOvertimeRows(rows);
    const risk = getProjectRiskSummary(rows, budgets);
    const pendingForecast = getPendingForecast(rows);
    const submittedHours = getSubmittedHours(rows);
    return { notifications, missingTimesheets, missingRates, staleApprovals, overtime, risk, pendingForecast, submittedHours };
  }, [contractors, rows, budgets, locked, events.length]);

  const titleRight = (
    <div className="setuHeaderActions">
      <Button variant="secondary" onClick={() => (window.location.href = "/dashboard")}>Dashboard</Button>
      <Button variant="primary" onClick={() => (window.location.href = "/reports/payroll")}>Payroll report</Button>
    </div>
  );

  return (
    <RequireOnboarding>
      <AppShell title="Notifications" subtitle="Operations alerts, payroll blockers, reminders, and readiness signals" right={titleRight}>
        <div style={{ maxWidth: 1180, marginTop: 12 }}>
          <div className="card cardPad" style={{ marginBottom: 14 }}>
            <div className="setuCardHeaderRow" style={{ marginBottom: 12 }}>
              <div>
                <div className="setuSectionTitle" style={{ fontSize: 20 }}>Notification center groundwork</div>
                <div className="setuSectionHint">A single surface for reminder-ready timesheets, approval blockers, budget risk alerts, rate audits, and export readiness.</div>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{formatDateRange(start, end)}</div>
            </div>
            <DateRangeToolbar
              preset={preset}
              start={start}
              end={end}
              onPresetChange={setPreset}
              onStartChange={(value) => { setPreset("custom"); setStart(value); }}
              onEndChange={(value) => { setPreset("custom"); setEnd(value); }}
              onRefresh={() => {
                setBusy(true);
                setStart((v) => v);
              }}
              compact
              busy={busy}
            />
          </div>

          {busy ? <LoadingState title="Loading notifications" description="Reviewing approvals, payroll, project risk, and export readiness." /> : null}
          {!busy && error ? <ErrorState message={error} /> : null}

          {!busy && !error ? (
            <>
              <div className="setuKpiGrid" style={{ marginBottom: 14 }}>
                <div className="setuMetricCard"><div className="setuMetricLabel">Active alerts</div><div className="setuMetricValue">{notificationState.notifications.length}</div><div className="setuMetricHint">Across payroll, approvals, projects, people, and exports.</div></div>
                <div className="setuMetricCard"><div className="setuMetricLabel">Forecast exposure</div><div className="setuMetricValue">{formatMoney(notificationState.pendingForecast)}</div><div className="setuMetricHint">{notificationState.submittedHours.toFixed(2)} submitted hours are not yet locked.</div></div>
                <div className="setuMetricCard"><div className="setuMetricLabel">Budget risk</div><div className="setuMetricValue">{notificationState.risk.over.length + notificationState.risk.near.length}</div><div className="setuMetricHint">{notificationState.risk.over.length} over budget • {notificationState.risk.near.length} near budget.</div></div>
                <div className="setuMetricCard"><div className="setuMetricLabel">Export readiness</div><div className="setuMetricValue">{locked ? (events.length ? "Tracked" : "Ready") : "Open"}</div><div className="setuMetricHint">{locked ? (events.length ? `${events.length} receipts recorded` : "Locked period still needs an official export receipt.") : "Current period can still move before close."}</div></div>
              </div>

              {notificationState.notifications.length ? (
                <div className="card cardPad" style={{ marginBottom: 14 }}>
                  <div className="setuCardHeaderRow" style={{ marginBottom: 12 }}>
                    <div>
                      <div className="setuSectionTitle" style={{ fontSize: 20 }}>Priority queue</div>
                      <div className="setuSectionHint">Use this queue to decide what should be automated next: reminders, alerts, or export nudges.</div>
                    </div>
                  </div>
                  <div className="setuNotificationList">
                    {notificationState.notifications.map((item) => (
                      <button key={item.id} className={`setuNotificationItem severity-${item.severity}`} onClick={() => (window.location.href = item.href)}>
                        <div style={{ display: "grid", gap: 6, flex: 1, minWidth: 0 }}>
                          <div className="setuNotificationHead">
                            <span className="setuNotificationTitle">{item.title}</span>
                            <span className={`setuNotificationBadge severity-${item.severity}`}>{severityLabel(item.severity)}</span>
                          </div>
                          <div className="setuProjectMeta">{item.body}</div>
                        </div>
                        <div className="setuNotificationMeta">
                          <strong>{item.metric}</strong>
                          <span>Open →</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card cardPad" style={{ marginBottom: 14 }}>
                  <EmptyState title="No active alerts in this range" description="The current period has no missing timesheets, rate gaps, stale approvals, budget risk, or export blockers." />
                </div>
              )}

              <div className="setuCommandGrid setuCommandGridBottom">
                <section className="setuSurfaceCard">
                  <div className="setuSectionLead"><div><div className="setuSectionTitle">Reminder-ready contractors</div><div className="setuSectionHint">A simple groundwork layer for future automated nudges.</div></div><Button variant="secondary" onClick={() => (window.location.href = "/profiles")}>People</Button></div>
                  <div className="setuFocusList">
                    {notificationState.missingTimesheets.slice(0, 8).map((person) => (
                      <button key={person.id} className="setuFocusItem" onClick={() => (window.location.href = "/profiles")}><span>{person.full_name || "Contractor"}</span><strong>Missing time</strong></button>
                    ))}
                    {!notificationState.missingTimesheets.length ? <div className="muted">No missing timesheet reminders are needed right now.</div> : null}
                  </div>
                </section>

                <section className="setuSurfaceCard">
                  <div className="setuSectionLead"><div><div className="setuSectionTitle">Rate audit + approval anomalies</div><div className="setuSectionHint">Gaps that weaken forecast quality or should block auto-close later.</div></div><Button variant="secondary" onClick={() => (window.location.href = "/approvals?scope=all")}>Approvals</Button></div>
                  <div className="setuBarsList">
                    <div className="setuBarBlock"><div className="setuBarHead"><span>Missing default rates</span><span>{notificationState.missingRates.length}</span></div><div className="setuProjectMeta">Set contractor rates before enabling stronger forecast automation.</div></div>
                    <div className="setuBarBlock"><div className="setuBarHead"><span>Stale approvals</span><span>{notificationState.staleApprovals.length}</span></div><div className="setuProjectMeta">Submitted entries aging beyond the target review window.</div></div>
                    <div className="setuBarBlock"><div className="setuBarHead"><span>Long-hour anomalies</span><span>{notificationState.overtime.length}</span></div><div className="setuProjectMeta">Daily hours above threshold should be reviewed before payroll is finalized.</div></div>
                  </div>
                </section>
              </div>

              <div className="setuCommandGrid setuCommandGridBottom">
                <section className="setuSurfaceCard">
                  <div className="setuSectionLead"><div><div className="setuSectionTitle">Project budget alerts</div><div className="setuSectionHint">Projects already drifting into near-budget or over-budget territory.</div></div><Button variant="secondary" onClick={() => (window.location.href = "/projects?healthFilter=over")}>Projects</Button></div>
                  <div className="setuActivityList">
                    {[...notificationState.risk.over, ...notificationState.risk.near].slice(0, 8).map((project) => (
                      <div className="setuActivityItem" key={project.id}>
                        <div>
                          <div className="setuActivityTitle">{project.name}</div>
                          <div className="setuActivityMeta">{project.state === "over" ? "Over budget" : "Near budget"} • {project.pending} pending items</div>
                        </div>
                        <div>{formatMoney(project.cost, project.currency)}</div>
                      </div>
                    ))}
                    {!notificationState.risk.over.length && !notificationState.risk.near.length ? <div className="muted">No budget risk alerts in this period.</div> : null}
                  </div>
                </section>

                <section className="setuSurfaceCard">
                  <div className="setuSectionLead"><div><div className="setuSectionTitle">Export readiness</div><div className="setuSectionHint">Connect payroll close to receipts, export history, and finance handoff confidence.</div></div><Button variant="secondary" onClick={() => (window.location.href = "/admin/exports")}>Exports</Button></div>
                  <div className="setuBarsList">
                    <div className="setuBarBlock"><div className="setuBarHead"><span>Pay period state</span><span>{locked ? "Locked" : "Open"}</span></div><div className="setuProjectMeta">Locked periods should produce official export receipts for auditability.</div></div>
                    <div className="setuBarBlock"><div className="setuBarHead"><span>Receipts in range</span><span>{events.length}</span></div><div className="setuProjectMeta">{events.length ? `Latest receipt at ${new Date(events[0].created_at).toLocaleString()}` : "No receipt yet in this range."}</div></div>
                    <div className="setuBarBlock"><div className="setuBarHead"><span>Suggested next step</span><span>{locked && !events.length ? "Export" : locked ? "Review" : "Approve"}</span></div><div className="setuProjectMeta">{locked && !events.length ? "Generate the official export bundle now." : locked ? "Review receipts and finance handoff history." : "Reduce approval blockers before finalizing payroll."}</div></div>
                  </div>
                </section>
              </div>
            </>
          ) : null}
        </div>
      </AppShell>
    </RequireOnboarding>
  );
}
