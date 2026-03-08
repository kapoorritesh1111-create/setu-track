"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import RequireOnboarding from "../../components/auth/RequireOnboarding";
import WorkspaceKpiStrip from "../../components/setu/WorkspaceKpiStrip";
import { apiJson } from "../../lib/api/client";
import { presetToRange } from "../../lib/dateRanges";
import { StatusChip } from "../../components/ui/StatusChip";
import Button from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";

type RangePreset = "current_week" | "last_week" | "current_month" | "last_month";

type AnalyticsPayload = {
  ok: true;
  analytics: {
    total_payroll: number;
    total_hours: number;
    budget_used: number;
    budget_remaining: number;
    budget_risk_alerts: number;
    total_projects_tracked: number;
    incomplete_profiles: number;
    export_history_count: number;
    payroll_variance: { delta: number; pct: number };
  };
  payroll_by_project: Array<{
    project_id: string;
    project_name: string;
    amount: number;
    hours: number;
    budget_amount: number;
    remaining_budget: number;
    risk: string;
    currency: string;
  }>;
  payroll_by_contractor: Array<{
    contractor_id: string;
    contractor_name: string;
    amount: number;
    hours: number;
    project_count: number;
  }>;
  project_budgets: Array<{
    project_id: string;
    project_name: string;
    payroll_cost: number;
    budget_amount: number;
    remaining_budget: number;
    risk: string;
    currency: string;
  }>;
  export_history: Array<{
    id: string;
    export_type: string;
    exported_at: string;
    exported_by_name: string | null;
    file_format: string | null;
  }>;
};

const PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: "current_week", label: "Current week" },
  { value: "last_week", label: "Last week" },
  { value: "current_month", label: "Current month" },
  { value: "last_month", label: "Last month" },
];

function money(amount: number, currency = "USD") {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

function riskState(risk: string) {
  if (risk === "healthy") return "approved";
  if (risk === "watch") return "open";
  if (risk === "high") return "submitted";
  if (risk === "over") return "rejected";
  return "draft";
}

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<RangePreset>("current_month");
  const range = useMemo(() => presetToRange(preset, "sunday"), [preset]);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const json = await apiJson<AnalyticsPayload>(`/api/dashboard/financial-intelligence?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`);
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [range.start, range.end]);

  const normalizedQuery = query.trim().toLowerCase();
  const currency = data?.payroll_by_project?.[0]?.currency || data?.project_budgets?.[0]?.currency || "USD";
  const filteredProjects = useMemo(() => {
    const rows = data?.payroll_by_project || [];
    if (!normalizedQuery) return rows;
    return rows.filter((item) => item.project_name.toLowerCase().includes(normalizedQuery));
  }, [data, normalizedQuery]);
  const filteredContractors = useMemo(() => {
    const rows = data?.payroll_by_contractor || [];
    if (!normalizedQuery) return rows;
    return rows.filter((item) => item.contractor_name.toLowerCase().includes(normalizedQuery));
  }, [data, normalizedQuery]);
  const budgetRows = useMemo(() => {
    const rows = data?.project_budgets || [];
    if (!normalizedQuery) return rows;
    return rows.filter((item) => item.project_name.toLowerCase().includes(normalizedQuery));
  }, [data, normalizedQuery]);
  const topProjects = filteredProjects.slice(0, 5);
  const topContractors = filteredContractors.slice(0, 6);
  const recentExports = (data?.export_history || []).slice(0, 6);
  const maxProjectAmount = Math.max(...topProjects.map((item) => item.amount), 1);
  const highestContractor = topContractors[0];

  return (
    <RequireOnboarding>
      <AppShell
        title="Analytics"
        subtitle="Financial intelligence, contractor cost visibility, and project budget risk across the active payroll operating window."
        right={
          <div className="row" style={{ gap: 10 }}>
            <select className="input" value={preset} onChange={(e) => setPreset(e.target.value as RangePreset)} aria-label="Analytics date range">
              {PRESETS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>Refresh</Button>
          </div>
        }
      >
        <WorkspaceKpiStrip
          items={[
            { label: "Payroll cost", value: loading ? "—" : money(data?.analytics.total_payroll || 0, currency), hint: `${range.start} → ${range.end}` },
            { label: "Hours approved", value: loading ? "—" : `${Number(data?.analytics.total_hours || 0).toFixed(2)}h`, hint: "Locked-run backed totals" },
            { label: "Budget alerts", value: loading ? "—" : String(data?.analytics.budget_risk_alerts || 0), hint: `${data?.analytics.total_projects_tracked || 0} tracked projects` },
            { label: "Variance", value: loading ? "—" : `${(data?.analytics.payroll_variance?.pct || 0) >= 0 ? "+" : ""}${Number(data?.analytics.payroll_variance?.pct || 0).toFixed(1)}%`, hint: "Current vs prior payroll snapshot" },
          ]}
        />

        {error ? (
          <div className="alert alertWarn" style={{ marginTop: 14 }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{error}</pre>
          </div>
        ) : null}

        <div className="setuCompareGrid" style={{ marginTop: 14 }}>
          <div className="setuCompareCard setuCompareCardPrimary">
            <div className="setuCompareLabel">Budget used</div>
            <div className="setuCompareValue">{loading ? "—" : money(data?.analytics.budget_used || 0, currency)}</div>
            <div className="setuCompareMeta">Tracked projects in selected window</div>
          </div>
          <div className="setuCompareCard">
            <div className="setuCompareLabel">Budget remaining</div>
            <div className="setuCompareValue">{loading ? "—" : money(data?.analytics.budget_remaining || 0, currency)}</div>
            <div className="setuCompareMeta">Funding still available across tracked work</div>
          </div>
          <div className="setuCompareCard">
            <div className="setuCompareLabel">Profile blockers</div>
            <div className="setuCompareValue">{loading ? "—" : String(data?.analytics.incomplete_profiles || 0)}</div>
            <div className="setuCompareMeta">Contractors missing payroll-critical data</div>
          </div>
          <div className="setuCompareCard">
            <div className="setuCompareLabel">Top contractor</div>
            <div className="setuCompareValue" style={{ fontSize: 22 }}>{highestContractor?.contractor_name || "—"}</div>
            <div className="setuCompareMeta">{highestContractor ? money(highestContractor.amount, currency) : "No contractor spend in range"}</div>
          </div>
        </div>

        <div className="card cardPad" style={{ marginTop: 14 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 900 }}>Analytics workbench</div>
              <div className="muted" style={{ marginTop: 4 }}>Search projects or contractors to narrow the current intelligence view.</div>
            </div>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search project or contractor"
              aria-label="Search analytics"
              style={{ minWidth: 260 }}
            />
          </div>
        </div>

        {loading ? (
          <div className="card cardPad" style={{ marginTop: 14 }}>
            <div className="muted">Loading analytics…</div>
          </div>
        ) : !data ? (
          <div style={{ marginTop: 14 }}>
            <EmptyState title="Analytics unavailable" description="We could not assemble a trusted analytics payload for this period." />
          </div>
        ) : (
          <section className="analyticsGrid">
            <div className="analyticsSplit">
              <article className="analyticsCard">
                <div className="analyticsTitle">Top project payroll concentration</div>
                <div className="analyticsHint">Projects ranked by payroll cost in the current operating window.</div>
                <div className="analyticsChart">
                  {topProjects.length ? topProjects.map((bar) => (
                    <div key={bar.project_id} className="analyticsBarWrap">
                      <div className="analyticsBar" style={{ height: `${Math.max(28, (bar.amount / maxProjectAmount) * 180)}px` }} />
                      <div className="analyticsBarLabel">{bar.project_name}</div>
                    </div>
                  )) : <div className="muted">No matching project payroll data in this range.</div>}
                </div>
              </article>

              <article className="analyticsCard">
                <div className="analyticsTitle">Project budget health</div>
                <div className="analyticsHint">Payroll cost against tracked project budgets.</div>
                <div className="analyticsList">
                  {budgetRows.length ? budgetRows.slice(0, 8).map((project) => (
                    <div key={project.project_id} className="analyticsListItem">
                      <div>
                        <div className="analyticsListTitle">{project.project_name}</div>
                        <div className="analyticsListMeta">
                          Used {money(project.payroll_cost, project.currency)} • Remaining {money(project.remaining_budget, project.currency)}
                        </div>
                      </div>
                      <div className="analyticsRight">
                        <StatusChip state={riskState(project.risk) as any} label={project.risk} />
                      </div>
                    </div>
                  )) : <div className="muted">Budget tracking will appear here once project budgets exist.</div>}
                </div>
              </article>
            </div>

            <div className="analyticsSplit">
              <article className="analyticsCard">
                <div className="analyticsTitle">Contractor cost distribution</div>
                <div className="analyticsHint">Highest payroll contributors in the current window.</div>
                <div className="analyticsList">
                  {topContractors.length ? topContractors.map((contractor) => (
                    <div key={contractor.contractor_id} className="analyticsListItem">
                      <div>
                        <div className="analyticsListTitle">{contractor.contractor_name}</div>
                        <div className="analyticsListMeta">{contractor.hours.toFixed(2)} approved hours • {contractor.project_count} projects</div>
                      </div>
                      <div className="analyticsRight">
                        <div className="analyticsListTitle">{money(contractor.amount, currency)}</div>
                        <div className="analyticsListMeta">Current period</div>
                      </div>
                    </div>
                  )) : <div className="muted">No matching contractor payroll data in this range.</div>}
                </div>
              </article>

              <article className="analyticsCard">
                <div className="analyticsTitle">Export and payroll operations</div>
                <div className="analyticsHint">Recent workflow activity and readiness signals.</div>
                <div className="analyticsList">
                  <div className="analyticsListItem">
                    <div>
                      <div className="analyticsListTitle">Export ledger</div>
                      <div className="analyticsListMeta">{data.analytics.export_history_count || 0} tracked exports in history</div>
                    </div>
                  </div>
                  <div className="analyticsListItem">
                    <div>
                      <div className="analyticsListTitle">Budget used</div>
                      <div className="analyticsListMeta">{money(data.analytics.budget_used || 0, currency)} consumed across tracked projects</div>
                    </div>
                  </div>
                  <div className="analyticsListItem">
                    <div>
                      <div className="analyticsListTitle">Budget remaining</div>
                      <div className="analyticsListMeta">{money(data.analytics.budget_remaining || 0, currency)} remaining budget</div>
                    </div>
                  </div>
                  <div className="analyticsListItem">
                    <div>
                      <div className="analyticsListTitle">Profile blockers</div>
                      <div className="analyticsListMeta">{data.analytics.incomplete_profiles || 0} contractor profiles missing payroll-required data</div>
                    </div>
                  </div>
                  {recentExports.length ? recentExports.map((item) => (
                    <div className="analyticsListItem" key={item.id}>
                      <div>
                        <div className="analyticsListTitle">{item.export_type || "Export"}</div>
                        <div className="analyticsListMeta">{new Date(item.exported_at).toLocaleString()} • {item.exported_by_name || "Unknown actor"}</div>
                      </div>
                      <div className="analyticsRight">
                        <div className="analyticsListMeta">{String(item.file_format || "file").toUpperCase()}</div>
                      </div>
                    </div>
                  )) : null}
                </div>
              </article>
            </div>
          </section>
        )}
      </AppShell>
    </RequireOnboarding>
  );
}
