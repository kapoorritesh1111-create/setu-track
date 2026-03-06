// src/app/reports/payroll/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../../../components/layout/AppShell";
import Button from "../../../components/ui/Button";
import DataTable from "../../../components/ui/DataTable";
import MetaFooter from "../../../components/ui/MetaFooter";
import { EmptyState } from "../../../components/ui/EmptyState";
import Drawer from "../../../components/ui/Drawer";
import ExportReceiptDrawer from "../../../components/ui/ExportReceiptDrawer";
import { useDebouncedValue } from "../../../lib/useDebouncedValue";
import { apiJson } from "../../../lib/api/client";

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

type Row = {
  id: string;
  project_id: string;
  project_name: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  total_amount: number;
  receipts: Receipt[];
};

export default function PayrollReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState<Receipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 250);

  const filtered = useMemo(() => {
    const s = dq.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.project_name.toLowerCase().includes(s) ||
        r.project_id.toLowerCase().includes(s) ||
        `${r.period_start} ${r.period_end}`.toLowerCase().includes(s)
    );
  }, [dq, rows]);

  const columns = useMemo(
    () =>
      [
        {
          key: "project_name",
          header: "Project",
          render: (r: Row) => (
            <div>
              <div style={{ fontWeight: 650 }}>{r.project_name}</div>
              <div className="muted" style={{ marginTop: 2 }}>
                {r.project_id}
              </div>
            </div>
          ),
        },
        {
          key: "period",
          header: "Period",
          render: (r: Row) => (
            <div className="muted">
              {r.period_start} → {r.period_end}
            </div>
          ),
        },
        {
          key: "total_hours",
          header: "Hours",
          render: (r: Row) => <div className="muted">{r.total_hours.toFixed(2)}</div>,
        },
        {
          key: "total_amount",
          header: "Amount",
          render: (r: Row) => <div style={{ fontWeight: 650 }}>${r.total_amount.toFixed(2)}</div>,
        },
        {
          key: "receipts",
          header: "Receipts",
          render: (r: Row) => (
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedReceipts(r.receipts || []);
                setDrawerOpen(true);
              }}
            >
              View
            </Button>
          ),
        },
      ] as any,
    []
  );

  async function load() {
    setLoading(true);
    try {
      const json = await apiJson<{ ok: boolean; rows?: Row[]; error?: string }>("/api/payroll/summary");
      if (!json?.ok) throw new Error(json?.error || "Failed to load payroll report.");
      setRows((json.rows || []) as Row[]);
    } catch (e: any) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell
      title="Payroll"
      subtitle="Project payroll summaries"
      right={
        <div className="row" style={{ gap: 10 }}>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects…"
            style={{ minWidth: 260 }}
          />
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      }
    >
      <div style={{ maxWidth: 1200 }}>
        {loading ? (
          <div className="card cardPad">
            <div className="muted">Loading…</div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No payroll data" description="Once payroll exports are generated, summaries will appear here." />
        ) : (
          <DataTable rows={filtered} columns={columns} rowKey={(r: Row) => r.id} />
        )}

        <MetaFooter />
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Receipts">
        {selectedReceipts.length === 0 ? (
          <div className="muted">No receipts.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {selectedReceipts.map((r) => (
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
