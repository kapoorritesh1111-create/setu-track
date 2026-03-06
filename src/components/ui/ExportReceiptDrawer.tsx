// src/components/ui/ExportReceiptDrawer.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "./Button";
import { Card } from "./Card";
import { CheckCircle2, Copy, ExternalLink, Loader2, X } from "lucide-react";

export type ExportReceipt = {
  id: string;
  kind: string;
  title: string;
  description?: string | null;
  created_at: string;
  project_id?: string | null;
  project_export_id?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  payload?: any;
};

type Receipt = {
  id: string;
  org_id: string;
  created_at: string;
  created_by?: string | null;
  actor_name?: string | null;

  type: string;
  label?: string | null;

  project_id?: string | null;
  payroll_run_id?: string | null;

  // Step 4 link (optional)
  project_export_id?: string | null;

  payload_hash?: string | null;
  diff_status?: "same" | "changed" | "unknown" | null;

  meta?: any;
};

// ✅ FIX: restore the named type export that pages expect:
// import ExportReceiptDrawer, { ExportReceipt } from ".../ExportReceiptDrawer"
export type ExportReceipt = Receipt;

type PaidState = {
  id: string;
  is_paid: boolean;
  paid_by: string | null;
  paid_at: string | null;
  paid_note: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  receipt: ExportReceipt | null;
};

export default function ExportReceiptDrawer({ open, onClose, receipt }: Props) {
  const r = receipt;

  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState<PaidState | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  const isProjectLinked = !!(r?.project_id && r?.project_export_id);

  const canTogglePaid = useMemo(() => {
    // client-side permissive; API enforces admin via server gate
    return isProjectLinked;
  }, [isProjectLinked]);

  useEffect(() => {
    setPaid(null);
    setCopyOk(false);
    setBusy(false);
  }, [r?.id, open]);

  async function copyReceiptId() {
    if (!r?.id) return;
    try {
      await navigator.clipboard.writeText(r.id);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 900);
    } catch {
      // ignore
    }
  }

  async function togglePaid(nextPaid: boolean) {
    // FIX: r can be null
    if (!r?.project_id || !r?.project_export_id) return;

    const note =
      nextPaid ? window.prompt("Paid note (optional)", paid?.paid_note || "") ?? "" : "";

    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(r.project_id)}/exports/${encodeURIComponent(
          r.project_export_id
        )}/paid`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ is_paid: nextPaid, paid_note: note }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        alert(json?.error || "Failed to update paid status.");
        return;
      }
      setPaid(json.export as PaidState);
    } catch (e: any) {
      alert(e?.message || "Failed to update paid status.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="drawerOverlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        // click outside closes
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawerPanel">
        <div className="drawerHeader">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Export Receipt</div>
            <div className="muted" style={{ marginTop: 2 }}>
              Official record of an export action
            </div>
          </div>
          <button className="iconBtn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="drawerBody">
          {!r ? (
            <div className="card cardPad">
              <div className="muted">No receipt selected.</div>
            </div>
          ) : (
            <>
              <Card>
                <div
                  className="row"
                  style={{ justifyContent: "space-between", alignItems: "center" }}
                >
                  <div>
                    <div style={{ fontWeight: 650 }}>{r.label || r.type}</div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <Button variant="secondary" onClick={copyReceiptId}>
                      <Copy size={14} style={{ marginRight: 6 }} />
                      {copyOk ? "Copied" : "Copy ID"}
                    </Button>
                    <a className="pill" href="/admin/exports" style={{ textDecoration: "none" }}>
                      Exports <ExternalLink size={14} style={{ marginLeft: 6 }} />
                    </a>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="grid2">
                    <div>
                      <div className="muted">Receipt ID</div>
                      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                        {r.id}
                      </div>
                    </div>
                    <div>
                      <div className="muted">Created by</div>
                      <div>{r.actor_name || r.created_by || "—"}</div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div style={{ fontWeight: 650, marginBottom: 8 }}>Details</div>
                <div className="grid2">
                  <div>
                    <div className="muted">Project</div>
                    <div>{r.project_id || "—"}</div>
                  </div>
                  <div>
                    <div className="muted">Payroll Run</div>
                    <div>{r.payroll_run_id || "—"}</div>
                  </div>
                  <div>
                    <div className="muted">Payload hash</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {r.payload_hash || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="muted">Diff</div>
                    <div>
                      {r.diff_status === "same"
                        ? "No changes"
                        : r.diff_status === "changed"
                        ? "Changed"
                        : "Unknown"}
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 650 }}>Paid status</div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      Project export payments (separate from payroll run paid)
                    </div>
                  </div>

                  {canTogglePaid ? (
                    <div className="row" style={{ gap: 8 }}>
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => togglePaid(false)}
                        title="Mark unpaid"
                      >
                        {busy ? <Loader2 size={14} className="spin" /> : null}
                        Mark unpaid
                      </Button>
                      <Button disabled={busy} onClick={() => togglePaid(true)} title="Mark paid">
                        {busy ? <Loader2 size={14} className="spin" /> : null}
                        Mark paid
                      </Button>
                    </div>
                  ) : (
                    <div className="muted">Not linked to a project export record.</div>
                  )}
                </div>

                <div style={{ marginTop: 12 }}>
                  {!paid ? (
                    <div className="muted">Paid information will appear here after the export is linked.</div>
                  ) : (
                    <div className="grid2">
                      <div>
                        <div className="muted">Status</div>
                        <div className="row" style={{ gap: 8, alignItems: "center" }}>
                          <CheckCircle2 size={16} />
                          {paid.is_paid ? "Paid" : "Unpaid"}
                        </div>
                      </div>
                      <div>
                        <div className="muted">Paid at</div>
                        <div>{paid.paid_at ? new Date(paid.paid_at).toLocaleString() : "—"}</div>
                      </div>
                      <div>
                        <div className="muted">Paid by</div>
                        <div>{paid.paid_by || "—"}</div>
                      </div>
                      <div>
                        <div className="muted">Note</div>
                        <div>{paid.paid_note || "—"}</div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}