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

type Run = {
  id: string;
  org_id: string;
  project_id: string;
  period_start: string;
  period_end: string;
  status: "open" | "closed";
  created_at: string;
  created_by: string;
  closed_at: string | null;
  closed_by: string | null;

  is_paid: boolean;
  paid_at: string | null;
  paid_by: string | null;
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

export default function PayrollRunDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [run, setRun] = useState<Run | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

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
    try {
      const res = await fetch(`/api/payroll/runs/${encodeURIComponent(id)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load payroll run.");
      setRun(json.run as Run);
      setLines((json.lines || []) as Line[]);
      setReceipts((json.receipts || []) as Receipt[]);
    } catch {
      setRun(null);
      setLines([]);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <AppShell
      title="Payroll Run"
      subtitle={run ? `${run.period_start} → ${run.period_end}` : "Details"}
      right={
        <div className="row" style={{ gap: 10 }}>
          <Button variant="secondary" onClick={() => loadAll()} disabled={loading}>
            Refresh
          </Button>
          <Button
            onClick={() => setDrawerOpen(true)}
            disabled={loading || !run}
            title="Open receipts"
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
          <EmptyState title="Run not found" description="This payroll run may have been deleted or you don’t have access." />
        ) : (
          <>
            <div className="card cardPad">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>Run status</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {run.status === "closed" ? "Closed" : "Open"}
                    {" · "}
                    {run.is_paid ? "Paid" : "Unpaid"}
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
