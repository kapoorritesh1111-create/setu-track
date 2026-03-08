"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseBrowser";
import { CardPad } from "../../ui/Card";
import { StatCard } from "../../ui/StatCard";
import { presetToRange } from "../../../lib/dateRanges";
import { MetricsRow } from "../../ui/MetricsRow";
import { apiJson } from "../../../lib/api/client";
import { StatusChip } from "../../ui/StatusChip";
import { EmptyState } from "../../ui/EmptyState";

type OverviewPayload = {
  ok: true;
  warnings: string[];
  metrics: {
    active_contractors: number;
    hours_logged: number;
    approved_hours: number;
    approvals_pending: number;
    payroll_ready: number;
    current_payroll_total: number;
    currency: string;
  };
  watchlist: Array<{
    project_id: string;
    project_name: string;
    payroll_cost: number;
    hours: number;
    budget_amount: number;
    remaining_budget: number;
    currency: string;
    risk: string;
  }>;
  contractor_cost_distribution: Array<{
    contractor_id: string;
    contractor_name: string;
    amount: number;
    hours: number;
  }>;
  recent_activity: Array<{ id: string; type: string; title: string; meta: string; at: string }>;
};

function money(x: number, currency = "USD") {
  return `${currency} ${Number(x || 0).toFixed(2)}`;
}

function riskState(risk: string) {
  if (risk === "healthy") return "approved";
  if (risk === "watch") return "open";
  if (risk === "high") return "submitted";
  if (risk === "over") return "rejected";
  return "draft";
}

export default function ManagerDashboard({ orgId }: { orgId: string; userId: string }) {
  const router = useRouter();
  const range = useMemo(() => presetToRange("current_month", "sunday"), []);
  const [pending, setPending] = useState(0);
  const [approvedHours, setApprovedHours] = useState(0);
  const [msg, setMsg] = useState("");
  const [financials, setFinancials] = useState<any | null>(null);
  const [overview, setOverview] = useState<OverviewPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMsg("");
      try {
        const [{ data: p, error: pErr }, { data: a, error: aErr }, financial, overviewJson] = await Promise.all([
          supabase.from("v_time_entries").select("id").eq("org_id", orgId).eq("status", "submitted"),
          supabase
            .from("v_time_entries")
            .select("hours_worked")
            .eq("org_id", orgId)
            .gte("entry_date", range.start)
            .lte("entry_date", range.end)
            .eq("status", "approved"),
          apiJson<any>(`/api/dashboard/financial-intelligence?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`),
          apiJson<OverviewPayload>(`/api/dashboard/overview?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`),
        ]);
        if (cancelled) return;
        if (pErr) throw pErr;
        if (aErr) throw aErr;
        setPending(((p as any) ?? [])?.length ?? 0);
        const sum = (((a as any) ?? []) as any[]).reduce((acc, r) => acc + Number(r.hours_worked ?? 0), 0);
        setApprovedHours(sum);
        setFinancials(financial);
        setOverview(overviewJson);
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message || "Failed to load manager dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, range.start, range.end]);

  const currency = overview?.metrics.currency || "USD";
  const topRisk = overview?.watchlist?.[0];

  return (
    <>
      {msg ? (
        <div className="alert alertInfo">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg}</pre>
        </div>
      ) : null}

      <MetricsRow>
        <StatCard label="Pending approvals" value={pending} hint="Submitted entries" />
        <StatCard label="Approved hours" value={`${approvedHours.toFixed(2)} hrs`} hint={`${range.start} → ${range.end}`} />
        <StatCard label="Payroll this month" value={money(Number(financials?.analytics?.total_payroll || 0), currency)} hint="Locked-run backed totals" />
        <StatCard label="Incomplete profiles" value={`${financials?.analytics?.incomplete_profiles || 0}`} hint="Payroll blockers" />
      </MetricsRow>

      <div className="setuCompareGrid" style={{ marginTop: 14 }}>
        <div className="setuCompareCard setuCompareCardPrimary">
          <div className="setuCompareLabel">Payroll ready</div>
          <div className="setuCompareValue">{overview?.metrics ? `${Math.round((overview.metrics.payroll_ready || 0) * 100)}%` : "—"}</div>
          <div className="setuCompareMeta">Share of approved hours vs total logged hours</div>
        </div>
        <div className="setuCompareCard">
          <div className="setuCompareLabel">Approvals pending</div>
          <div className="setuCompareValue">{overview?.metrics?.approvals_pending ?? pending}</div>
          <div className="setuCompareMeta">Needs immediate review this cycle</div>
        </div>
        <div className="setuCompareCard">
          <div className="setuCompareLabel">Risk watch project</div>
          <div className="setuCompareValue" style={{ fontSize: 22 }}>{topRisk?.project_name || "—"}</div>
          <div className="setuCompareMeta">{topRisk ? `${money(topRisk.payroll_cost, topRisk.currency)} payroll consumed` : "No active project risk"}</div>
        </div>
        <div className="setuCompareCard">
          <div className="setuCompareLabel">Active contractors</div>
          <div className="setuCompareValue">{overview?.metrics?.active_contractors ?? "—"}</div>
          <div className="setuCompareMeta">Visible workers in current window</div>
        </div>
      </div>

      <CardPad className="dbPayCard" style={{ marginTop: 14 } as any}>
        <div className="dbPayHeader">
          <div>
            <div className="dbPayTitle">Operations command</div>
            <div className="muted">Approvals, payroll visibility, and risk management in one place.</div>
          </div>
          <div className="dbPayValue">{overview?.metrics ? money(overview.metrics.current_payroll_total, currency) : "Ready"}</div>
        </div>

        <div className="dbQuickGrid">
          <button className="dbQuickBtn" onClick={() => router.push("/approvals")}>Approvals<span className="muted">Review submitted time</span></button>
          <button className="dbQuickBtn" onClick={() => router.push("/reports/payroll")}>Payroll<span className="muted">Project and contractor finance</span></button>
          <button className="dbQuickBtn" onClick={() => router.push("/analytics")}>Analytics<span className="muted">Risk, exports, and trends</span></button>
        </div>
      </CardPad>

      <div className="grid2 dbActivitySplit" style={{ marginTop: 14 }}>
        <CardPad>
          <div style={{ fontWeight: 900 }}>Project risk watchlist</div>
          <div className="muted" style={{ marginTop: 4 }}>The projects most likely to require manager intervention.</div>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {overview?.watchlist?.length ? overview.watchlist.slice(0, 5).map((row) => (
              <div key={row.project_id} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{row.project_name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {money(row.payroll_cost, row.currency)} used • {money(row.remaining_budget, row.currency)} remaining
                  </div>
                </div>
                <StatusChip state={riskState(row.risk) as any} label={row.risk} />
              </div>
            )) : <EmptyState title="No watchlist items" description="Budget and payroll watch items will surface here once work is flowing." />}
          </div>
        </CardPad>

        <CardPad>
          <div style={{ fontWeight: 900 }}>Recent activity</div>
          <div className="muted" style={{ marginTop: 4 }}>Recent payroll and export activity for this operating window.</div>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {overview?.recent_activity?.length ? overview.recent_activity.map((item) => (
              <div key={item.id} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{item.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{item.meta}</div>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{new Date(item.at).toLocaleString()}</div>
              </div>
            )) : <EmptyState title="No recent activity" description="Recent run closures and exports will appear here." />}
          </div>
        </CardPad>
      </div>
    </>
  );
}
