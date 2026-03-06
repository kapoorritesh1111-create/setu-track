// src/app/admin/exports/page.tsx
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

type ExportReceipt = {
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

type Row = ExportReceipt;

function DiffBadge({ status }: { status: Row["diff_status"] }) {
  const text = status === "same" ? "No changes" : status === "changed" ? "Changed" : "Unknown";
  const cls = status === "changed" ? "pill warn" : status === "same" ? "pill ok" : "pill";
  return <span className={cls}>{text}</span>;
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
          header: "Export",
          render: (r: Row) => (
            <div>
              <div style={{ fontWeight: 650 }}>{r.label || r.type}</div>
              <div className="muted" style={{ marginTop: 2 }}>
                {r.type}
              </div>
            </div>
          ),
        },
        {
          key: "project_id",
          header: "Project",
          render: (r: Row) => (
            <div className="muted" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
              {r.project_id || "—"}
            </div>
          ),
        },
        {
          key: "diff_status",
          header: "Diff",
          render: (r: Row) => <DiffBadge status={r.diff_status} />,
        },
        {
          key: "created_at",
          header: "Created",
          render: (r: Row) => <div className="muted">{new Date(r.created_at).toLocaleString()}</div>,
        },
        {
          key: "actor_name",
          header: "By",
          render: (r: Row) => <div>{r.actor_name || r.created_by || "—"}</div>,
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

  return (
    <AppShell
      title="Exports"
      subtitle="Receipts & history"
      right={
        <div className="row" style={{ gap: 10 }}>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      }
    >
      <div style={{ maxWidth: 1200 }}>
        <AdminTabs active="exports" />

        <div style={{ marginTop: 12 }}>
          {loading ? (
            <div className="card cardPad">
              <div className="muted">Loading…</div>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState title="No exports yet" description="Export receipts will appear here when you generate reports." />
          ) : (
            <DataTable rows={rows} columns={columns} rowKey={(r: Row) => r.id} />
          )}
        </div>

        <MetaFooter />
      </div>

      <ExportReceiptDrawer open={open} onClose={() => setOpen(false)} receipt={selected as any} />
    </AppShell>
  );
}
