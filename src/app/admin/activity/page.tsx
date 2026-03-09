"use client";

import { useEffect, useState } from "react";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import { supabase } from "../../../lib/supabaseBrowser";
import { useProfile } from "../../../lib/useProfile";

type AuditRow = {
  id: string;
  action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string | null;
  actor_id: string | null;
  metadata: any;
};

type ExportEvent = {
  id: string;
  export_type: string | null;
  file_format: string | null;
  scope: string | null;
  created_at: string | null;
  period_start: string | null;
  period_end: string | null;
  metadata: any;
};

type PayrollRun = {
  id: string;
  created_at: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string | null;
  total_amount: number | null;
};

function formatWhen(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function formatMoney(value?: number | null) {
  return `USD ${Number(value || 0).toFixed(2)}`;
}

function tone(action?: string | null) {
  const text = String(action || "").toLowerCase();
  if (text.includes("void") || text.includes("delete") || text.includes("reject")) return "pill warn";
  if (text.includes("lock") || text.includes("approve") || text.includes("export") || text.includes("paid")) return "pill ok";
  return "pill";
}

export default function AdminActivityPage() {
  return (
    <RequireOnboarding>
      <AdminActivityInner />
    </RequireOnboarding>
  );
}

function AdminActivityInner() {
  const { profile, loading } = useProfile() as any;
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [exportRows, setExportRows] = useState<ExportEvent[]>([]);
  const [runRows, setRunRows] = useState<PayrollRun[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!profile?.org_id || profile?.role !== "admin") return;
    let mounted = true;
    (async () => {
      setBusy(true);
      setError("");
      try {
        const [auditRes, exportRes, runRes] = await Promise.all([
          supabase.from("audit_log").select("id,action,entity_type,entity_id,created_at,actor_id,metadata").eq("org_id", profile.org_id).order("created_at", { ascending: false }).limit(40),
          supabase.from("export_events").select("id,export_type,file_format,scope,created_at,period_start,period_end,metadata").eq("org_id", profile.org_id).order("created_at", { ascending: false }).limit(20),
          supabase.from("payroll_runs").select("id,created_at,period_start,period_end,status,total_amount").eq("org_id", profile.org_id).order("created_at", { ascending: false }).limit(20),
        ]);
        if (auditRes.error || exportRes.error || runRes.error) throw new Error(auditRes.error?.message || exportRes.error?.message || runRes.error?.message || "Failed to load activity");
        if (!mounted) return;
        setAuditRows((auditRes.data || []) as AuditRow[]);
        setExportRows((exportRes.data || []) as ExportEvent[]);
        setRunRows((runRes.data || []) as PayrollRun[]);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load activity.");
      } finally {
        if (mounted) setBusy(false);
      }
    })();
    return () => { mounted = false; };
  }, [profile?.org_id, profile?.role]);

  if (loading) {
    return <AppShell title="Activity" subtitle="Admin activity timeline"><div className="card cardPad"><div className="muted">Loading activity…</div></div></AppShell>;
  }

  if (profile?.role !== "admin") {
    return <AppShell title="Activity" subtitle="Admin activity timeline"><div className="alert alertWarn">Admin access required.</div></AppShell>;
  }

  return (
    <AppShell title="Activity" subtitle="Audit, payroll, and export events across the workspace">
      {error ? <div className="alert alertError">{error}</div> : null}
      <div className="setuKpiGrid" style={{ marginBottom: 16 }}>
        <div className="setuMetricCard"><div className="setuMetricLabel">Audit events</div><div className="setuMetricValue">{auditRows.length}</div><div className="setuMetricHint">Recent entity and payroll lifecycle events.</div></div>
        <div className="setuMetricCard"><div className="setuMetricLabel">Export events</div><div className="setuMetricValue">{exportRows.length}</div><div className="setuMetricHint">Client and payroll export history.</div></div>
        <div className="setuMetricCard"><div className="setuMetricLabel">Payroll runs</div><div className="setuMetricValue">{runRows.length}</div><div className="setuMetricHint">Recent locked, paid, or voided snapshots.</div></div>
        <div className="setuMetricCard"><div className="setuMetricLabel">Latest run amount</div><div className="setuMetricValue">{runRows[0] ? formatMoney(runRows[0].total_amount) : "—"}</div><div className="setuMetricHint">Latest payroll run from the timeline.</div></div>
      </div>
      {busy ? <div className="card cardPad"><div className="muted">Loading activity…</div></div> : (
        <div className="setuCommandGrid">
          <section className="setuSurfaceCard">
            <div className="setuSectionLead"><div><div className="setuSectionTitle">Audit timeline</div><div className="setuSectionHint">Trace payroll lifecycle, approvals, and data changes from one place.</div></div></div>
            <div className="setuMiniTable">
              {auditRows.map((row) => (
                <div className="setuMiniRow" key={row.id} style={{ alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{row.action || "event"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{row.entity_type || "entity"} • {row.entity_id || "—"} • actor {row.actor_id || "system"}</div>
                    {row.metadata ? <div className="muted" style={{ fontSize: 12 }}>{JSON.stringify(row.metadata).slice(0, 180)}</div> : null}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={tone(row.action)}>{row.action || "event"}</span>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{formatWhen(row.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="setuSurfaceCard">
            <div className="setuSectionLead"><div><div className="setuSectionTitle">Operations timeline</div><div className="setuSectionHint">Recent exports and payroll runs for release-grade operational review.</div></div></div>
            <div className="setuMiniTable">
              {runRows.map((row) => (
                <div className="setuMiniRow" key={`run-${row.id}`}>
                  <div>
                    <div style={{ fontWeight: 800 }}>Payroll run • {row.period_start} → {row.period_end}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{formatMoney(row.total_amount)} • {row.status || "open"}</div>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{formatWhen(row.created_at)}</div>
                </div>
              ))}
              {exportRows.map((row) => (
                <div className="setuMiniRow" key={`exp-${row.id}`}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{row.metadata?.label || row.export_type || "Export event"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{row.period_start || "—"} → {row.period_end || "—"}</div>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{formatWhen(row.created_at)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
