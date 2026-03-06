// src/components/ui/ExportReceiptDrawer.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "./Button";
import { Card } from "./Card";
import { CheckCircle2, Copy, ExternalLink, Loader2, X } from "lucide-react";
import { apiJson } from "../../lib/api/client";

export type ExportReceipt = {
  id: string;
  org_id?: string;
  created_at: string;
  created_by?: string | null;
  actor_name?: string | null;

  type?: string | null;
  label?: string | null;

  project_id?: string | null;
  payroll_run_id?: string | null;
  project_export_id?: string | null;

  payload_hash?: string | null;
  diff_status?: "same" | "changed" | "unknown" | null;

  meta?: any;
};

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

  const canTogglePaid = useMemo(() => isProjectLinked, [isProjectLinked]);

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
      // ignore clipboard errors
    }
  }

  async function togglePaid(nextPaid: boolean) {
    if (!r?.project_id || !r?.project_export_id) return;

    const note = nextPaid ? window.prompt("Paid note (optional)") : null;

  setBusy(true);

  try {
    const res = await apiJson("/api/project-exports/mark-paid", {
      method: "POST",
      body: JSON.stringify({
        project_id: r.project_id,
        export_id: r.project_export_id,
        paid: nextPaid,
        note,
      }),
    });

    setPaid(res);
  } finally {
    setBusy(false);
  }
}
