"use client";

import { useEffect, useMemo, useState } from "react";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import { apiJson, getAccessToken } from "../../../lib/api/client";
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
  paid_at?: string | null;
  paid_by?: string | null;
  paid_by_name?: string | null;
  paid_note?: string | null;
};

function money(x: number) {
  return x.toFixed(2);
}

export default function PayrollRunsPage() {
  const { profile, loading } = useProfile();
  const [runs, setRuns] = useState<Run[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const canView = profile?.role === "admin";

  async function downloadFromApi(path: string, fallbackName: string) {
    const token = await getAccessToken();
    const res = await fetch(path, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      try {
        const j = JSON.parse(text);
        throw new Error(j?.error || `Export failed (${res.status})`);
      } catch {
        throw new Error(text || `Export failed (${res.status})`);
      }
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

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
    const lastClosed = [...runs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at;

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
                  <th>Paid</th>
                  <th>Hours</th>
                  <th>Amount</th>
                  <th>Closed</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const qs = new URLSearchParams({ period_start: r.period_start, period_end: r.period_end }).toString();
                  const exportSummary = `/api/payroll/export?${new URLSearchParams({
                    mode: "summary",
                    period_start: r.period_start,
                    period_end: r.period_end,
                  }).toString()}`;

                  const exportDetail = `/api/payroll/export?${new URLSearchParams({
                    mode: "detail",
                    period_start: r.period_start,
                    period_end: r.period_end,
                  }).toString()}`;

                  const exportPdfSummary = `/api/payroll/export-pdf?${new URLSearchParams({
                    mode: "summary",
                    period_start: r.period_start,
                    period_end: r.period_end,
                  }).toString()}`;

                  const exportPdfDetail = `/api/payroll/export-pdf?${new URLSearchParams({
                    mode: "detail",
                    period_start: r.period_start,
                    period_end: r.period_end,
                  }).toString()}`;

                  // Map run statuses into our chip language (fallback to "locked" for safety)
                  const s = String(r.status || "").toLowerCase();
                  const chip =
                    s.includes("paid") ? "paid" : s.includes("lock") || s.includes("close") ? "locked" : (s as any);

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
                      <td>
                        {r.paid_at ? (
                          <div style={{ display: "grid" }}>
                            <span className="mono">{new Date(r.paid_at).toLocaleDateString()}</span>
                            <span className="muted" style={{ fontSize: 12 }}>
                              {r.paid_by_name || r.paid_by || "—"}
                              {r.paid_note ? ` • ${r.paid_note}` : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="mono">{Number(r.total_hours || 0).toFixed(2)}</td>
                      <td className="mono">
                        {r.currency} {money(Number(r.total_amount || 0))}
                      </td>
                      <td>{new Date(r.created_at).toLocaleString()}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <a className="btn btnSecondary" href={`/reports/payroll?${qs}`}>
                          View
                        </a>
                        <span style={{ display: "inline-block", width: 6 }} />
                        <ActionMenu
                          trigger="pill"
                          triggerLabel="Actions"
                          ariaLabel="Run actions"
                          items={[
                            {
                              label: "Download summary CSV",
                              onSelect: () =>
                                downloadFromApi(
                                  exportSummary,
                                  `payroll_summary_${r.period_start}_to_${r.period_end}.csv`
                                ),
                            },
                            {
                              label: "Download detail CSV",
                              onSelect: () =>
                                downloadFromApi(
                                  exportDetail,
                                  `payroll_detail_${r.period_start}_to_${r.period_end}.csv`
                                ),
                            },
                            {
                              label: "Download PDF (summary)",
                              onSelect: () =>
                                downloadFromApi(
                                  exportPdfSummary,
                                  `payroll_summary_${r.period_start}_to_${r.period_end}.pdf`
                                ),
                            },
                            {
                              label: "Download PDF (detail)",
                              onSelect: () =>
                                downloadFromApi(
                                  exportPdfDetail,
                                  `payroll_detail_${r.period_start}_to_${r.period_end}.pdf`
                                ),
                            },
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
