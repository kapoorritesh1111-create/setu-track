"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../../../components/layout/AppShell";
import AdminTabs from "../../../components/admin/AdminTabs";
import Button from "../../../components/ui/Button";
import DataTable from "../../../components/ui/DataTable";
import MetaFooter from "../../../components/ui/MetaFooter";
import { EmptyState } from "../../../components/ui/EmptyState";
import ExportReceiptDrawer from "../../../components/ui/ExportReceiptDrawer";
import { apiJson } from "../../../lib/api/client";
import WorkspaceKpiStrip from "../../../components/setu/WorkspaceKpiStrip";

type ExportReceipt = {
  id: string;
  org_id: string;
  created_at: string;
  created_by: string | null;
  actor_name: string | null;
  type: string;
  label: string | null;
  project_id: string | null;
  project_name?: string | null;
  payroll_run_id: string | null;
  project_export_id?: string | null;
  payload_hash: string | null;
  diff_status: "same" | "changed" | "unknown" | null;
  meta: any;
};

type Row = ExportReceipt;

function DiffBadge({ row }: { row: Row }) {
  const status = row.diff_status || "unknown";
  const text = row.meta?.diff_status_label || (status === "same" ? "Matches previous" : status === "changed" ? "Updated" : "Baseline export");
  return <span className={`pill setuDiffChip ${status}`}>{text}</span>;
}

function ReceiptBadge({ row }: { row: Row }) {
  const label = row.meta?.receipt_status_label || "Receipt";
  const cls = row.meta?.is_paid ? "pill ok" : row.project_export_id ? "pill warn" : "pill";
  return <span className={cls}>{label}</span>;
}

function money(amount: number, currency = "USD") {
  return `${currency} ${Number(amount || 0).toFixed(2)}`;
}

export default function AdminExportsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);

  const columns = useMemo(
    () =>
      [
        {
          key: "label",
          header: "Receipt",
          render: (r: Row) => (
            <div className="setuReceiptStack">
              <div className="setuExportTitle">{r.label || r.type}</div>
              <div className="setuExportMeta">{r.type} • {r.meta?.file_format?.toUpperCase?.() || "FILE"} • {r.meta?.scope || "org"}</div>
            </div>
          ),
        },
        {
          key: "project_id",
          header: "Project / Period",
          render: (r: Row) => (
            <div className="setuReceiptStack">
              <div style={{ fontWeight: 800 }}>{r.project_name || r.project_id || "Org-level export"}</div>
              <div className="setuMiniHint">{r.meta?.period_label || "No period linked"}</div>
              {r.meta?.total_amount ? <div className="setuMiniHint">{money(Number(r.meta.total_amount || 0), r.meta?.currency || "USD")} • {Number(r.meta?.total_hours || 0).toFixed(2)} hrs</div> : null}
            </div>
          ),
        },
        {
          key: "statuses",
          header: "Status",
          render: (r: Row) => (
            <div className="setuStatusStack">
              <ReceiptBadge row={r} />
              <DiffBadge row={r} />
              {r.meta?.payroll_run_status ? <span className="setuMiniHint">Run: {r.meta.payroll_run_status}</span> : null}
            </div>
          ),
        },
        {
          key: "created_at",
          header: "Created",
          render: (r: Row) => (
            <div className="setuReceiptStack">
              <div>{new Date(r.created_at).toLocaleString()}</div>
              <div className="setuMiniHint">By {r.actor_name || r.created_by || "—"}</div>
            </div>
          ),
        },
        {
          key: "actions",
          header: "",
          render: (r: Row) => (
            <Button
              variant="secondary"
              onClick={() => {
                setSelected(r);
                setOpen(true);
              }}
            >
              View receipt
            </Button>
          ),
        },
      ] as any,
    []
  );

  async function load() {
    setLoading(true);
    try {
      const json = await apiJson<{ ok: boolean; exports?: Row[]; error?: string }>("/api/exports/list");
      if (!json?.ok) throw new Error(json?.error || "Failed to load exports.");
      setRows((json.exports || []) as Row[]);
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

  const totals = useMemo(() => {
    const linked = rows.filter((row) => !!row.project_export_id).length;
    const paid = rows.filter((row) => !!row.meta?.is_paid).length;
    const changed = rows.filter((row) => row.diff_status === "changed").length;
    return { linked, paid, changed };
  }, [rows]);

  return (
    <AppShell
      title="Exports"
      subtitle="Audit receipts, client export linkage, and paid-state history across payroll operations."
      right={
        <div className="row" style={{ gap: 10 }}>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      }
    >
      <div style={{ maxWidth: 1280 }}>
        <AdminTabs active="exports" />

        
        <WorkspaceKpiStrip
          items={[
            { label: "Receipts", value: String(rows.length), hint: "Tracked export receipts" },
            { label: "Project-linked", value: String(totals.linked), hint: "End-to-end client export linkage" },
            { label: "Paid", value: String(totals.paid), hint: "Receipts connected to paid exports" },
            { label: "Changed payloads", value: String(totals.changed), hint: "Diff-status receipts" },
          ]}
        />

<div className="setuCompareGrid" style={{ marginTop: 12 }}>
          <div className="setuCompareCard setuCompareCardPrimary">
            <div className="setuCompareLabel">Total receipts</div>
            <div className="setuCompareValue">{rows.length}</div>
            <div className="setuCompareMeta">All export receipts in org scope</div>
          </div>
          <div className="setuCompareCard">
            <div className="setuCompareLabel">Linked to project exports</div>
            <div className="setuCompareValue">{totals.linked}</div>
            <div className="setuCompareMeta">End-to-end project export tracking</div>
          </div>
          <div className="setuCompareCard">
            <div className="setuCompareLabel">Paid receipts</div>
            <div className="setuCompareValue">{totals.paid}</div>
            <div className="setuCompareMeta">Receipts attached to paid project exports</div>
          </div>
          <div className="setuCompareCard">
            <div className="setuCompareLabel">Updated payloads</div>
            <div className="setuCompareValue">{totals.changed}</div>
            <div className="setuCompareMeta">Exports that differ from prior payloads</div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {loading ? (
            <div className="card cardPad">
              <div className="muted">Loading…</div>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState title="No exports yet" description="Export receipts will appear here when you generate reports." />
          ) : (
            <div className="setuExportTable">
              <DataTable rows={rows} columns={columns} rowKey={(r: Row) => r.id} />
            </div>
          )}
        </div>

        <MetaFooter />
      </div>

      <ExportReceiptDrawer open={open} onClose={() => setOpen(false)} receipt={selected as any} />
    </AppShell>
  );
}
