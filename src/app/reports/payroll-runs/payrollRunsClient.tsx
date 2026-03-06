"use client";

import { useEffect, useMemo, useState } from "react";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import { apiJson } from "../../../lib/api/client";
import { useProfile } from "../../../lib/useProfile";
import { SummaryBar } from "../../../components/ui/SummaryBar";
import { StatCard } from "../../../components/ui/StatCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import { TrustBlock } from "../../../components/ui/TrustBlock";
import { CommandCard } from "../../../components/ui/CommandCard";
import ActionMenu from "../../../components/ui/ActionMenu";
import MetaFooter from "../../../components/ui/MetaFooter";
import { EmptyState } from "../../../components/ui/EmptyState";

type Run = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
  total_hours: number;
  total_amount: number;
  currency: string;
};

function money(x: number) {
  return Number(x || 0).toFixed(2);
}

export default function PayrollRunsClient({ requestedRunId }: { requestedRunId?: string }) {
  const { profile, loading } = useProfile();
  const [runs, setRuns] = useState<Run[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const canView = profile?.role === "admin";

  // If we came from "Close payroll" and have a run id, deep-link straight to the run detail.
  useEffect(() => {
    if (!canView) return;
    if (!requestedRunId) return;
    window.location.href = `/reports/payroll-runs/${requestedRunId}`;
  }, [canView, requestedRunId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!canView) return;
      setMsg("");
      try {
        const data = await apiJson<{ ok: true; runs: Run[] }>("/api/payroll/runs", { method: "GET" });
        if (!cancelled) setRuns(data.runs || []);
        if (!cancelled) setLoadedAt(new Date().toISOString());
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message || "Failed to load payroll runs");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [canView]);

  const content = useMemo(() => {
    if (!canView) return <div className="card cardPad">Admins only.</div>;
    if (msg) return <div className="card cardPad">{msg}</div>;
    if (!runs.length)
      return (
        <div className="card">
          <EmptyState
            title="No payroll runs yet"
            description="Close (lock) a pay period to generate an immutable payroll run you can export later."
            action={
              <a className="pill btnPrimary" href="/reports/payroll">
                Go to payroll report
              </a>
            }
          />
        </div>
      );

    const totalRuns = runs.length;
    const totalHours = runs.reduce((a, r) => a + Number(r.total_hours || 0), 0);
    const currency = runs[0]?.currency || "USD";
    const totalAmount = runs.reduce((a, r) => a + Number(r.total_amount || 0), 0);
    const lastClosed = [...runs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      ?.created_at;

    return (
      <>
        <SummaryBar>
          <StatCard label="Runs" value={totalRuns} hint="Closed pay periods" />
          <StatCard label="Total hours" value={totalHours.toFixed(2)} hint="Across all runs" />
          <StatCard label="Total amount" value={`${currency} ${money(totalAmount)}`} hint="Across all runs" />
          <StatCard
            label="Last closed"
            value={lastClosed ? new Date(lastClosed).toLocaleDateString() : "—"}
            hint={lastClosed ? new Date(lastClosed).toLocaleTimeString() : ""}
          />
        </SummaryBar>

        <TrustBlock
          tone={msg ? "warn" : "neutral"}
          subtitle={
            "Runs are immutable snapshots generated when a pay period is locked. Use exports for audit-grade records."
          }
          items={[
            { label: "Last refreshed", value: loadedAt ? new Date(loadedAt).toLocaleString() : "—" },
            { label: "Data scope", value: "Org-wide (admin)", mono: false },
            { label: "Exports", value: "Summary + Detail CSV", mono: false },
            { label: "Status model", value: "Locked → Paid", mono: false },
          ]}
        />

        <CommandCard
          title="Payroll runs"
          subtitle="Closed pay periods with totals and exports"
          right={<div style={{ opacity: 0.75, fontSize: 12 }}>{runs.length} total</div>}
          className="paySection"
          footer={
            <MetaFooter
              left={[
                { label: "Rows", value: String(runs.length), mono: true },
                { label: "Last refresh", value: loadedAt ? new Date(loadedAt).toLocaleString() : "—" },
              ]}
            />
          }
        >
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Hours</th>
                  <th>Amount</th>
                  <th>Closed</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const qs = new URLSearchParams({ period_start: r.period_start, period_end: r.period_end }).toString();
                  const exportSummary = `/api/payroll/run-export?${new URLSearchParams({
                    mode: "summary",
                    run_id: r.id,
                  }).toString()}`;

                  const exportDetail = `/api/payroll/run-export?${new URLSearchParams({
                    mode: "detail",
                    run_id: r.id,
                  }).toString()}`;

                  const s = String(r.status || "").toLowerCase();
                  const chip = s.includes("paid") ? "paid" : s.includes("lock") || s.includes("close") ? "locked" : (s as any);

                  return (
                    <tr key={r.id}>
                      <td>
                        <span className="mono">
                          {r.period_start} → {r.period_end}
                        </span>
                      </td>
                      <td>
                        <StatusChip status={chip} label={r.status} />
                      </td>
                      <td className="mono">{Number(r.total_hours || 0).toFixed(2)}</td>
                      <td className="mono">
                        {r.currency} {money(Number(r.total_amount || 0))}
                      </td>
                      <td>{new Date(r.created_at).toLocaleString()}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <a className="btn btnSecondary" href={`/reports/payroll-runs/${r.id}`}>
                          Open
                        </a>
                        <span style={{ display: "inline-block", width: 6 }} />
                        <ActionMenu
                          ariaLabel="Run actions"
                          items={[
                            { label: "Open live payroll report", href: `/reports/payroll?${qs}` },
                            { label: "Export summary CSV", href: exportSummary },
                            { label: "Export detail CSV", href: exportDetail },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CommandCard>
      </>
    );
  }, [canView, msg, runs, loadedAt]);

  return (
    <RequireOnboarding>
      <AppShell title="Payroll runs" subtitle="Audit-grade history of closed payroll periods">
        {loading ? <div className="card cardPad">Loading…</div> : content}
      </AppShell>
    </RequireOnboarding>
  );
}
