// src/app/reports/payroll-runs/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "../../../../components/layout/AppShell";
import Button from "../../../../components/ui/Button";
import DataTable from "../../../../components/ui/DataTable";
import MetaFooter from "../../../../components/ui/MetaFooter";
import { EmptyState } from "../../../../components/ui/EmptyState";
import Drawer from "../../../../components/ui/Drawer";
import ExportReceiptDrawer from "../../../../components/ui/ExportReceiptDrawer";
import { StatusChip } from "../../../../components/ui/StatusChip";
import { apiJson } from "../../../../lib/api/client";

type Run = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
  total_hours?: number;
  total_amount?: number;
  currency?: string;
  is_paid: boolean;
  paid_at: string | null;
  paid_by: string | null;
  paid_by_name?: string | null;
  paid_note: string | null;
};

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
  meta: any;
};

type Line = {
  id: string;
  contractor_id: string;
  contractor_name: string;
  hours: number;
  hourly_rate: number;
  amount: number;
};

function formatMoney(amount: number, currency = "USD") {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

export default function PayrollRunDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [run, setRun] = useState<Run | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [savingPaid, setSavingPaid] = useState(false);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const columns = useMemo(
    () =>
      [
        {
          key: "contractor_name",
          header: "Contractor",
          render: (r: Line) => <div style={{ fontWeight: 650 }}>{r.contractor_name}</div>,
        },
        {
          key: "hours",
          header: "Hours",
          render: (r: Line) => <div className="muted">{r.hours.toFixed(2)}</div>,
        },
        {
          key: "hourly_rate",
          header: "Rate",
          render: (r: Line) => <div className="muted">${r.hourly_rate.toFixed(2)}</div>,
        },
        {
          key: "amount",
          header: "Amount",
          render: (r: Line) => <div style={{ fontWeight: 650 }}>${r.amount.toFixed(2)}</div>,
        },
      ] as any,
    []
  );

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const json = await apiJson<any>(`/api/payroll/runs/${encodeURIComponent(id)}`, { method: "GET" });
      setRun(json.run as Run);
      setLines((json.lines || []) as Line[]);
      setReceipts((json.receipts || json.exports || []) as Receipt[]);
    } catch (e: any) {
      setRun(null);
      setLines([]);
      setReceipts([]);
      setError(e?.message || "Failed to load payroll run.");
    } finally {
      setLoading(false);
    }
  }

  async function updatePaid(nextPaid: boolean) {
    if (!id || !run) return;
    const note = window.prompt(nextPaid ? "Paid note (optional)" : "Reason for marking unpaid (optional)", run.paid_note || "") || "";
    setSavingPaid(true);
    setError("");
    try {
      await apiJson(`/api/payroll/runs/${encodeURIComponent(id)}/paid`, {
        method: "POST",
        body: JSON.stringify({ paid: nextPaid, note }),
      });
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Failed to update paid status.");
    } finally {
      setSavingPaid(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [id]);

  return (
    <AppShell
      title="Payroll Run"
      subtitle={run ? `${run.period_start} → ${run.period_end}` : "Details"}
      right={
        <div className="row" style={{ gap: 10 }}>
          <Button variant="secondary" onClick={() => loadAll()} disabled={loading || savingPaid}>
            Refresh
          </Button>
          {run ? (
            run.is_paid ? (
              <Button variant="secondary" onClick={() => updatePaid(false)} disabled={savingPaid || loading}>
                Mark unpaid
              </Button>
            ) : (
              <Button onClick={() => updatePaid(true)} disabled={savingPaid || loading}>
                Mark paid
              </Button>
            )
          ) : null}
          <Button
            onClick={() => setDrawerOpen(true)}
            disabled={loading || !run}
            title="Open receipts"
            variant="secondary"
          >
            Receipts
          </Button>
        </div>
      }
    >
      <div style={{ maxWidth: 1200 }}>
        {loading ? (
          <div className="card cardPad">
            <div className="muted">Loading…</div>
          </div>
        ) : !run ? (
          <EmptyState title="Run not found" description={error || "This payroll run may have been deleted or you don’t have access."} />
        ) : (
          <>
            {error ? (
              <div className="card cardPad" style={{ marginBottom: 12 }}>
                <div className="muted">{error}</div>
              </div>
            ) : null}

            <div className="card cardPad">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Run status</div>
                  <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <StatusChip status={run.status} label={run.status} />
                    <StatusChip status={run.is_paid ? "paid" : "draft"} label={run.is_paid ? "Paid" : "Unpaid"} />
                  </div>
                  <div className="muted" style={{ marginTop: 8 }}>
                    Closed {new Date(run.created_at).toLocaleString()}
                    {run.paid_at ? ` • Paid ${new Date(run.paid_at).toLocaleString()}` : ""}
                    {run.paid_by_name || run.paid_by ? ` • By ${run.paid_by_name || run.paid_by}` : ""}
                    {run.paid_note ? ` • ${run.paid_note}` : ""}
                  </div>
                </div>

                <div className="row" style={{ gap: 18, flexWrap: "wrap" }}>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Total hours</div>
                    <div style={{ fontWeight: 750 }}>{Number(run.total_hours || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Total amount</div>
                    <div style={{ fontWeight: 750 }}>{formatMoney(Number(run.total_amount || 0), run.currency || "USD")}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Contractors</div>
                    <div style={{ fontWeight: 750 }}>{lines.length}</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <DataTable rows={lines} columns={columns} rowKey={(r: Line) => r.id} />
            </div>

            <MetaFooter />
          </>
        )}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Receipts">
        {receipts.length === 0 ? (
          <div className="muted">No receipts for this run yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {receipts.map((r) => (
              <button
                key={r.id}
                className="card cardPad"
                style={{ textAlign: "left", cursor: "pointer" }}
                onClick={() => {
                  setSelectedReceipt(r);
                  setReceiptOpen(true);
                }}
              >
                <div style={{ fontWeight: 650 }}>{r.label || r.type}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </Drawer>

      <ExportReceiptDrawer open={receiptOpen} onClose={() => setReceiptOpen(false)} receipt={selectedReceipt as any} />
    </AppShell>
  );
}
