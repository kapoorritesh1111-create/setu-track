"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/layout/AppShell";
import RequireOnboarding from "../../components/auth/RequireOnboarding";
import WorkspaceKpiStrip from "../../components/setu/WorkspaceKpiStrip";
import { apiJson } from "../../lib/api/client";
import { presetToRange } from "../../lib/dateRanges";
import { StatusChip } from "../../components/ui/StatusChip";

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
  const range = useMemo(() => presetToRange("current_month", "sunday"), []);
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const json = await apiJson<AnalyticsPayload>(`/api/dashboard/financial-intelligence?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`);
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.end, range.start]);

  const currency = data?.payroll_by_project?.[0]?.currency || data?.project_budgets?.[0]?.currency || "USD";
  const topProjects = data?.payroll_by_project?.slice(0, 5) || [];
  const topContractors = data?.payroll_by_contractor?.slice(0, 5) || [];
  const budgetRows = data?.project_budgets?.slice(0, 6) || [];
  const maxProjectAmount = Math.max(...topProjects.map((item) => item.amount), 1);

  return (
    <RequireOnboarding>
      <AppShell
        title="Analytics"
        subtitle="Financial intelligence, contractor cost visibility, and project budget risk across the active payroll operating window."
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
                )) : <div className="muted">No project payroll data in this range.</div>}
              </div>
            </article>

            <article className="analyticsCard">
              <div className="analyticsTitle">Project budget health</div>
              <div className="analyticsHint">Payroll cost against tracked project budgets.</div>
              <div className="analyticsList">
                {budgetRows.length ? budgetRows.map((project) => (
                  <div key={project.project_id} className="analyticsListItem">
                    <div>
                      <div className="analyticsListTitle">{project.project_name}</div>
                      <div className="analyticsListMeta">
                        Used {money(project.payroll_cost, project.currency)} • Remaining {money(project.remaining_budget, project.currency)}
                      </div>
                    </div>
                    <div className="analyticsRight">
                      <StatusChip state={riskState(project.risk)} label={project.risk} />
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
                )) : <div className="muted">No contractor payroll data in this range.</div>}
              </div>
            </article>

            <article className="analyticsCard">
              <div className="analyticsTitle">Export and payroll operations</div>
              <div className="analyticsHint">Recent financial workflow activity and readiness signals.</div>
              <div className="analyticsList">
                <div className="analyticsListItem">
                  <div>
                    <div className="analyticsListTitle">Export ledger</div>
                    <div className="analyticsListMeta">{data?.analytics.export_history_count || 0} tracked exports in history</div>
                  </div>
                </div>
                <div className="analyticsListItem">
                  <div>
                    <div className="analyticsListTitle">Budget used</div>
                    <div className="analyticsListMeta">{money(data?.analytics.budget_used || 0, currency)} consumed across tracked projects</div>
                  </div>
                </div>
                <div className="analyticsListItem">
                  <div>
                    <div className="analyticsListTitle">Budget remaining</div>
                    <div className="analyticsListMeta">{money(data?.analytics.budget_remaining || 0, currency)} remaining budget</div>
                  </div>
                </div>
                <div className="analyticsListItem">
                  <div>
                    <div className="analyticsListTitle">Profile blockers</div>
                    <div className="analyticsListMeta">{data?.analytics.incomplete_profiles || 0} contractor profiles missing payroll-required data</div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </AppShell>
    </RequireOnboarding>
  );
}
