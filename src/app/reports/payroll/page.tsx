"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "../../../components/layout/AppShell";
import Button from "../../../components/ui/Button";
import MetaFooter from "../../../components/ui/MetaFooter";
import { EmptyState } from "../../../components/ui/EmptyState";
import Drawer from "../../../components/ui/Drawer";
import ExportReceiptDrawer from "../../../components/ui/ExportReceiptDrawer";
import { apiJson } from "../../../lib/api/client";
import { buildRangeQuery, coercePreset } from "../../../lib/rangeQuery";

type PaymentStatus = "awaiting_export" | "awaiting_payment" | "paid";
type ExportStatus = "not_generated" | "generated" | "linked";
type ViewMode = "project" | "contractor" | "register";
type DatePreset = "current_week" | "last_week" | "current_month" | "last_month" | "custom";
type PeriodScope = "closed_only" | "open_and_closed";

type Receipt = {
  id: string;
  org_id: string;
  created_at: string;
  created_by: string | null;
  actor_name: string | null;
  type: string;
  label: string | null;
  project_id: string | null;
  payroll_run_id: string | null;
  project_export_id?: string | null;
  payload_hash: string | null;
  diff_status: "same" | "changed" | "unknown" | null;
  meta: Record<string, unknown>;
};

type RegisterRow = {
  id: string;
  project_id: string;
  project_name: string;
  period_start: string;
  period_end: string;
  period_state: "closed" | "open";
  contractor_count: number;
  contractors: Array<{ id: string; name: string; role: string | null }>;
  total_hours: number;
  total_amount: number;
  currency: string;
  export_status: ExportStatus;
  payment_status: PaymentStatus;
  is_paid: boolean;
  paid_at: string | null;
  paid_by: string | null;
  paid_note: string | null;
  receipt_count: number;
  latest_project_export_id: string | null;
  receipts: Receipt[];
};

type ProjectSummaryRow = {
  id: string;
  project_id: string;
  project_name: string;
  period_count: number;
  contractor_count: number;
  total_hours: number;
  total_amount: number;
  currency: string;
  export_status: ExportStatus;
  payment_status: PaymentStatus;
  paid_amount: number;
  receipt_count: number;
  budget_hours: number | null;
  budget_amount: number | null;
  budget_currency: string;
  hours_variance: number | null;
  amount_variance: number | null;
};

type ContractorSummaryRow = {
  id: string;
  person_id: string;
  person_name: string;
  role: string | null;
  project_count: number;
  total_hours: number;
  total_amount: number;
  currency: string;
  export_status: ExportStatus;
  payment_status: PaymentStatus;
  paid_amount: number;
  related_project_ids: string[];
};

type TrendPoint = { key: string; label: string; amount: number; hours: number };

type ApiPayload = {
  ok: true;
  range: { start: string; end: string; preset: DatePreset; period_scope: PeriodScope };
  options: {
    projects: Array<{ id: string; name: string }>;
    people: Array<{ id: string; name: string; role: string | null }>;
  };
  kpis: {
    total_payroll_cost: number;
    total_hours: number;
    paid_amount: number;
    needs_export_count: number;
    visible_projects: number;
    periods_in_view: number;
    exports_linked: number;
    paid_rows: number;
  };
  trend: TrendPoint[];
  project_summary: ProjectSummaryRow[];
  contractor_summary: ContractorSummaryRow[];
  register: RegisterRow[];
  recent_activity: Array<{ id: string; created_at: string; project_name: string; export_type: string; paid: boolean }>;
};

const PRESET_OPTIONS: Array<{ value: DatePreset; label: string }> = [
  { value: "current_week", label: "Current Week" },
  { value: "last_week", label: "Last Week" },
  { value: "current_month", label: "Current Month" },
  { value: "last_month", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

function money(amount: number, currency = "USD") {
  return `${currency} ${amount.toFixed(2)}`;
}

function statusLabel(value: PaymentStatus | ExportStatus) {
  switch (value) {
    case "awaiting_export":
      return "Awaiting export";
    case "awaiting_payment":
      return "Awaiting payment";
    case "paid":
      return "Paid";
    case "not_generated":
      return "Not generated";
    case "generated":
      return "Generated";
    case "linked":
      return "Linked";
    default:
      return value;
  }
}

function pillClass(value: PaymentStatus | ExportStatus) {
  if (value === "paid" || value === "linked") return "pill ok";
  if (value === "awaiting_payment") return "pill warn";
  if (value === "awaiting_export" || value === "not_generated") return "pill";
  return "pill";
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="setuMetricCard">
      <div className="setuMetricLabel">{label}</div>
      <div className="setuMetricValue">{value}</div>
      <div className="setuMetricHint">{hint}</div>
    </div>
  );
}

function PayrollReportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPreset = coercePreset(searchParams.get("preset"), "last_month");
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [error, setError] = useState<string>("");

  const [view, setView] = useState<ViewMode>("project");
  const [preset, setPreset] = useState<DatePreset>(initialPreset);
  const [periodScope, setPeriodScope] = useState<PeriodScope>("closed_only");
  const [projectId, setProjectId] = useState("");
  const [personId, setPersonId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string>("all");
  const [exportStatus, setExportStatus] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [start, setStart] = useState(searchParams.get("start") || "");
  const [end, setEnd] = useState(searchParams.get("end") || "");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState<Receipt[]>([]);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("preset", preset);
      params.set("period_scope", periodScope);
      if (preset === "custom") {
        if (start) params.set("start", start);
        if (end) params.set("end", end);
      }
      if (projectId) params.set("project_id", projectId);
      if (personId) params.set("person_id", personId);
      if (paymentStatus !== "all") params.set("payment_status", paymentStatus);
      if (exportStatus !== "all") params.set("export_status", exportStatus);
      if (query.trim()) params.set("q", query.trim());

      const json = await apiJson<ApiPayload>(`/api/payroll/summary?${params.toString()}`);
      setPayload(json);
      if (json.range.preset === "custom") {
        setStart(json.range.start);
        setEnd(json.range.end);
      }
    } catch (e: any) {
      setPayload(null);
      setError(e?.message || "Failed to load payroll report.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, periodScope, projectId, personId, paymentStatus, exportStatus, view]);

  const trendMax = useMemo(() => {
    return Math.max(1, ...(payload?.trend || []).map((point) => point.amount));
  }, [payload]);

  const reportSignals = useMemo(() => {
    const register = payload?.register || [];
    return {
      awaitingExport: register.filter((row) => row.payment_status === "awaiting_export" || row.export_status === "not_generated").length,
      awaitingPayment: register.filter((row) => row.payment_status === "awaiting_payment").length,
      paidRows: register.filter((row) => row.is_paid).length,
    };
  }, [payload]);

  const budgetSignals = useMemo(() => {
    const projects = payload?.project_summary || [];
    const budgeted = projects.filter((row) => Number(row.budget_amount || 0) > 0);
    const overBudget = budgeted.filter((row) => Number(row.amount_variance || 0) > 0);
    return {
      budgetedCount: budgeted.length,
      overBudgetCount: overBudget.length,
      totalBudget: budgeted.reduce((sum, row) => sum + Number(row.budget_amount || 0), 0),
    };
  }, [payload]);

  async function togglePaid(row: RegisterRow, nextPaid: boolean) {
    if (!row.latest_project_export_id) return;
    const note = window.prompt(nextPaid ? "Paid note (optional)" : "Reason for marking unpaid (optional)", row.paid_note || "") ?? "";
    try {
      setBusyRowId(row.id);
      await apiJson(`/api/projects/${encodeURIComponent(row.project_id)}/exports/${encodeURIComponent(row.latest_project_export_id)}/paid`, {
        method: "POST",
        body: { is_paid: nextPaid, paid_note: note },
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed to update paid status.");
    } finally {
      setBusyRowId(null);
    }
  }

  function exportCurrentView() {
    const data = payload?.register || [];
    if (!data.length) return;
    const headers = ["project", "period_start", "period_end", "contractor_count", "hours", "gross_pay", "export_status", "payment_status"];
    const rows = data.map((row) => [
      row.project_name,
      row.period_start,
      row.period_end,
      String(row.contractor_count),
      row.total_hours.toFixed(2),
      row.total_amount.toFixed(2),
      row.export_status,
      row.payment_status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `setu-payroll-report-${payload?.range.start || "range"}-to-${payload?.range.end || "range"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const sharedQuery = buildRangeQuery({ preset, start, end });

  const headerRight = (
    <div className="setuHeaderActions">
      <Button variant="secondary" onClick={() => router.push(`/dashboard?${sharedQuery}`)}>Dashboard</Button>
      <Button variant="secondary" onClick={() => router.push(`/analytics?${sharedQuery}`)}>Analytics</Button>
      <Button variant="secondary" onClick={() => void load()} disabled={loading}>Refresh</Button>
      <Button variant="secondary" onClick={() => router.push("/reports/payroll-runs")}>Open Payroll Runs</Button>
      <Button onClick={exportCurrentView} disabled={!payload?.register?.length}>Export Current View</Button>
    </div>
  );

  return (
    <AppShell
      title="Payroll Report"
      subtitle="Finance-ready payroll visibility for active time-entry workers, project summaries, and payment confirmation."
      right={headerRight}
    >
      <div className="setuReportPage">
        <div className="setuCommandHero" style={{ marginBottom: 0 }}>
          <div>
            <div className="setuSectionEyebrow">Connected workspace</div>
            <h2 className="setuCommandTitle">Payroll report is the finance-depth surface behind the command center.</h2>
            <p className="setuCommandText">Use the same active period from dashboard or analytics, then switch between project, contractor, and register views without losing financial context.</p>
          </div>
          <div className="setuHeaderActions">
            <span className="pill">{payload?.range.start || start || "Range"} → {payload?.range.end || end || ""}</span>
            <button className="pill" onClick={() => router.push(`/approvals?${sharedQuery}`)}>Open approvals queue</button>
            <button className="pill" onClick={() => router.push(`/projects?${sharedQuery}`)}>Projects</button>
          </div>
        </div>

        <div className="setuSummaryStrip">
          <div className="setuSummaryStripItem">
            <span>Periods in view</span>
            <strong>{payload?.kpis.periods_in_view ?? 0}</strong>
          </div>
          <div className="setuSummaryStripItem">
            <span>Awaiting export</span>
            <strong>{reportSignals.awaitingExport}</strong>
          </div>
          <div className="setuSummaryStripItem">
            <span>Awaiting payment</span>
            <strong>{reportSignals.awaitingPayment}</strong>
          </div>
          <div className="setuSummaryStripItem">
            <span>Paid rows</span>
            <strong>{reportSignals.paidRows}</strong>
          </div>
        </div>

        <div className="setuFilterBar">
          <div className="setuFilterGrid">
            <label className="setuField">
              <span>Date</span>
              <select className="input" value={preset} onChange={(e) => setPreset(e.target.value as DatePreset)}>
                {PRESET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="setuField">
              <span>Period scope</span>
              <select className="input" value={periodScope} onChange={(e) => setPeriodScope(e.target.value as PeriodScope)}>
                <option value="closed_only">Closed only</option>
                <option value="open_and_closed">Open + Closed</option>
              </select>
            </label>

            <label className="setuField">
              <span>Project</span>
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">All visible projects</option>
                {(payload?.options.projects || []).map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </label>

            <label className="setuField">
              <span>Contractor</span>
              <select className="input" value={personId} onChange={(e) => setPersonId(e.target.value)}>
                <option value="">All active workers</option>
                {(payload?.options.people || []).map((person) => (
                  <option key={person.id} value={person.id}>{person.name}{person.role ? ` • ${person.role}` : ""}</option>
                ))}
              </select>
            </label>

            <label className="setuField">
              <span>Payment</span>
              <select className="input" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                <option value="all">All</option>
                <option value="awaiting_export">Awaiting export</option>
                <option value="awaiting_payment">Awaiting payment</option>
                <option value="paid">Paid</option>
              </select>
            </label>

            <label className="setuField">
              <span>Export</span>
              <select className="input" value={exportStatus} onChange={(e) => setExportStatus(e.target.value)}>
                <option value="all">All</option>
                <option value="not_generated">Not generated</option>
                <option value="generated">Generated</option>
                <option value="linked">Linked</option>
              </select>
            </label>
          </div>

          {preset === "custom" ? (
            <div className="setuCustomRangeRow">
              <label className="setuField"><span>Start</span><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
              <label className="setuField"><span>End</span><input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
              <Button variant="secondary" onClick={() => void load()}>Apply range</Button>
            </div>
          ) : null}

          <div className="setuViewToolbar">
            <div className="setuSegmented">
              <button className={view === "project" ? "segActive" : ""} onClick={() => setView("project")}>By Project</button>
              <button className={view === "contractor" ? "segActive" : ""} onClick={() => setView("contractor")}>By Contractor</button>
              <button className={view === "register" ? "segActive" : ""} onClick={() => setView("register")}>Register</button>
            </div>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search project, person, id, or period" />
            <Button variant="secondary" onClick={() => void load()}>Run report</Button>
          </div>
        </div>

        {loading ? (
          <div className="card cardPad"><div className="muted">Loading payroll report…</div></div>
        ) : error ? (
          <div className="card cardPad"><div>{error}</div></div>
        ) : !payload || payload.register.length === 0 ? (
          <div className="card"><EmptyState title="No payroll data in current view" description="Try another date preset, include open periods, or clear project/contractor filters." /></div>
        ) : (
          <>
            <div className="setuMetricsGrid">
              <MetricCard label="Total payroll cost" value={money(payload.kpis.total_payroll_cost)} hint="Across the current filtered view." />
              <MetricCard label="Total hours" value={payload.kpis.total_hours.toFixed(2)} hint="Anyone with active time entries in scope." />
              <MetricCard label="Paid in view" value={money(payload.kpis.paid_amount)} hint={`${payload.kpis.paid_rows} paid rows currently visible.`} />
              <MetricCard label="Needs export" value={String(payload.kpis.needs_export_count)} hint="Rows still awaiting first client export." />
              <MetricCard label="Budget coverage" value={String(budgetSignals.budgetedCount)} hint={budgetSignals.budgetedCount ? `${budgetSignals.overBudgetCount} project(s) over budget in view.` : "Add project budgets to activate variance tracking."} />
            </div>

            <div className="setuInsightGrid">
              <div className="setuHeroCard setuNarrativeCard">
                <div className="setuSectionEyebrow">Current reporting scope</div>
                <h2>One payroll workspace for finance summary, contractor summary, and row-level action control.</h2>
                <p>
                  Filters support current week, last week, current month, last month, and custom range. Project and contractor summaries stay aligned to the active access scope, while export and payment signals remain visible in the same view.
                </p>
                <div className="setuNarrativeStats">
                  <span className="pill">{payload.kpis.visible_projects} visible projects</span>
                  <span className="pill">{payload.kpis.periods_in_view} periods in view</span>
                  <span className="pill">{payload.kpis.exports_linked} exports linked</span>
                  <span className="pill">{payload.kpis.paid_rows} paid rows</span>
                </div>
              </div>

              <div className="setuChartCard">
                <div className="setuSectionTitle">Payroll cost trend</div>
                <div className="setuSectionHint">Trend by pay period for the current filter set.</div>
                <div className="setuTrendBars">
                  {payload.trend.length === 0 ? (
                    <div className="muted">No trend data for current filters.</div>
                  ) : payload.trend.map((point) => (
                    <div key={point.key} className="setuTrendRow">
                      <div className="setuTrendMeta">
                        <strong>{point.label}</strong>
                        <span>{money(point.amount)}</span>
                      </div>
                      <div className="setuTrendTrack"><div className="setuTrendFill" style={{ width: `${Math.max(8, Math.round((point.amount / trendMax) * 100))}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="setuContentGrid">
              <div className="setuMainCard">
                <div className="setuCardHeaderRow">
                  <div>
                    <div className="setuSectionTitle">
                      {view === "project" ? "Summary by project" : view === "contractor" ? "Summary by contractor" : "Payroll register"}
                    </div>
                    <div className="setuSectionHint">
                      {view === "project"
                        ? "Project-level totals based on the current access scope."
                        : view === "contractor"
                        ? "Any active worker with time entries in the selected view, including managers/admins when applicable."
                        : "Detailed payroll ledger with export state, payment state, and row actions."}
                    </div>
                  </div>
                  <div className="muted">{view === "project" ? `${payload.project_summary.length} projects` : view === "contractor" ? `${payload.contractor_summary.length} workers` : `${payload.register.length} rows`}</div>
                </div>

                {view === "project" ? (
                  <div className="tableWrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Periods</th>
                          <th>Contractors</th>
                          <th>Hours</th>
                          <th>Gross Pay</th>
                          <th>Budget</th>
                          <th>Variance</th>
                          <th>Export</th>
                          <th>Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payload.project_summary.map((row) => (
                          <tr key={row.id}>
                            <td><strong>{row.project_name}</strong><div className="muted">{row.project_id}</div></td>
                            <td>{row.period_count}</td>
                            <td>{row.contractor_count}</td>
                            <td>{row.total_hours.toFixed(2)}</td>
                            <td><strong>{money(row.total_amount, row.currency)}</strong></td>
                            <td><span className={pillClass(row.export_status)}>{statusLabel(row.export_status)}</span></td>
                            <td><span className={pillClass(row.payment_status)}>{statusLabel(row.payment_status)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : view === "contractor" ? (
                  <div className="tableWrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Person</th>
                          <th>Role</th>
                          <th>Projects</th>
                          <th>Hours</th>
                          <th>Gross Pay</th>
                          <th>Export</th>
                          <th>Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payload.contractor_summary.map((row) => (
                          <tr key={row.id}>
                            <td><strong>{row.person_name}</strong><div className="muted">{row.person_id}</div></td>
                            <td>{row.role || "—"}</td>
                            <td>{row.project_count}</td>
                            <td>{row.total_hours.toFixed(2)}</td>
                            <td><strong>{money(row.total_amount, row.currency)}</strong></td>
                            <td><span className={pillClass(row.export_status)}>{statusLabel(row.export_status)}</span></td>
                            <td><span className={pillClass(row.payment_status)}>{statusLabel(row.payment_status)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="tableWrap">
                    <table className="table setuRegisterTable">
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Period</th>
                          <th>Contractors</th>
                          <th>Hours</th>
                          <th>Gross Pay</th>
                          <th>Export Status</th>
                          <th>Payment Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payload.register.map((row) => (
                          <tr key={row.id}>
                            <td>
                              <strong>{row.project_name}</strong>
                              <div className="muted">{row.project_id}</div>
                            </td>
                            <td>
                              {row.period_start} → {row.period_end}
                              <div className="muted">{row.period_state}</div>
                            </td>
                            <td>
                              <strong>{row.contractor_count}</strong>
                              <div className="muted">{row.contractors.slice(0, 2).map((c) => c.name).join(", ")}{row.contractors.length > 2 ? ` +${row.contractors.length - 2}` : ""}</div>
                            </td>
                            <td>{row.total_hours.toFixed(2)}</td>
                            <td><strong>{money(row.total_amount, row.currency)}</strong></td>
                            <td>
                              <span className={pillClass(row.export_status)}>{statusLabel(row.export_status)}</span>
                              <div className="setuInlineMeta">
                                <span className="setuMiniHint">{row.export_status === "not_generated" ? "Generate from Payroll Runs" : `${row.receipt_count} receipt(s) linked`}</span>
                                {row.latest_project_export_id ? <span className="setuMiniHint">Export ID {row.latest_project_export_id.slice(0, 8)}</span> : null}
                              </div>
                            </td>
                            <td>
                              <span className={pillClass(row.payment_status)}>{statusLabel(row.payment_status)}</span>
                              <div className="setuInlineMeta">
                                <span className="setuMiniHint">{row.is_paid ? `Paid ${row.paid_at ? new Date(row.paid_at).toLocaleDateString() : ""}` : row.export_status === "not_generated" ? "Awaiting first export" : "Linked export not yet paid"}</span>
                                {row.paid_note ? <span className="setuMiniHint">{row.paid_note}</span> : null}
                              </div>
                            </td>
                            <td>
                              <div className="setuActionRow">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedReceipts(row.receipts);
                                    setDrawerOpen(true);
                                  }}
                                >
                                  Receipts ({row.receipt_count})
                                </Button>
                                {row.latest_project_export_id ? (
                                  <>
                                    <a className="btn btnSecondary btnSm setuLinkButton" href="/admin/exports">Export history</a>
                                    <Button
                                      size="sm"
                                      variant={row.is_paid ? "secondary" : "primary"}
                                      loading={busyRowId === row.id}
                                      onClick={() => void togglePaid(row, !row.is_paid)}
                                    >
                                      {row.is_paid ? "Mark unpaid" : "Mark paid"}
                                    </Button>
                                  </>
                                ) : (
                                  <Button size="sm" variant="secondary" onClick={() => (window.location.href = "/reports/payroll-runs")}>Export first</Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="setuSideStack">
                <div className="setuSideCard">
                  <div className="setuSectionTitle">Budget vs actual</div>
                  <div className="setuSectionHint">Track which projects are burning above plan in the current payroll view.</div>
                  <div className="setuDistributionList">
                    {payload.project_summary.slice(0, 5).map((row) => {
                      const pct = payload.kpis.total_payroll_cost > 0 ? Math.round((row.total_amount / payload.kpis.total_payroll_cost) * 100) : 0;
                      const hasBudget = row.budget_amount != null && row.budget_amount > 0;
                      const variance = Number(row.amount_variance || 0);
                      return (
                        <div key={row.id} className="setuDistributionItem">
                          <div className="setuTrendMeta"><strong>{row.project_name}</strong><span>{money(row.total_amount, row.currency)}{hasBudget ? ` vs ${money(row.budget_amount || 0, row.budget_currency || row.currency)}` : ` (${pct}%)`}</span></div>
                          <div className="setuTrendTrack"><div className="setuTrendFill" style={{ width: `${Math.max(6, hasBudget && row.budget_amount ? Math.min(100, Math.round((row.total_amount / row.budget_amount) * 100)) : pct)}%` }} /></div>
                          <div className="muted" style={{ fontSize: 12 }}>{hasBudget ? `${variance > 0 ? 'Over' : 'Within'} by ${money(variance, row.budget_currency || row.currency)}` : 'No budget set yet'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="setuSideCard">
                  <div className="setuSectionTitle">Recent export activity</div>
                  <div className="setuSectionHint">Latest export receipts in the current org scope.</div>
                  {payload.recent_activity.length === 0 ? (
                    <div className="muted">No project-linked exports in current view yet.</div>
                  ) : (
                    <div className="setuActivityList">
                      {payload.recent_activity.map((item) => (
                        <div key={item.id} className="setuActivityItem">
                          <div>
                            <strong>{item.project_name}</strong>
                            <div className="muted">{item.export_type}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div className={item.paid ? "pill ok" : "pill"}>{item.paid ? "Paid" : "Unpaid"}</div>
                            <div className="muted">{new Date(item.created_at).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <MetaFooter />
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Receipts" subtitle="Export history for the selected payroll row">
        {selectedReceipts.length === 0 ? (
          <div className="muted">No linked receipts yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {selectedReceipts.map((receipt) => (
              <button
                key={receipt.id}
                className="card cardPad"
                style={{ textAlign: "left", cursor: "pointer" }}
                onClick={() => {
                  setSelectedReceipt(receipt);
                  setReceiptOpen(true);
                }}
              >
                <div style={{ fontWeight: 650 }}>{receipt.label || receipt.type}</div>
                <div className="muted" style={{ marginTop: 4 }}>{new Date(receipt.created_at).toLocaleString()}</div>
              </button>
            ))}
          </div>
        )}
      </Drawer>

      <ExportReceiptDrawer open={receiptOpen} onClose={() => setReceiptOpen(false)} receipt={selectedReceipt as any} />
    </AppShell>
  );
}


export default function PayrollReportPage() {
  return (
    <Suspense fallback={<AppShell title="Payroll Report" subtitle="Connect grow track — payroll intelligence across projects, contractors, and registers"><div className="card cardPad"><div className="muted">Loading payroll report…</div></div></AppShell>}>
      <PayrollReportPageContent />
    </Suspense>
  );
}
