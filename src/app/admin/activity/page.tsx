"use client";

import { useEffect, useState } from "react";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import SetuPage from "../../../components/layout/SetuPage";
import LoadingState from "../../../components/ui/LoadingState";
import ErrorState from "../../../components/ui/ErrorState";
import TableSkeleton from "../../../components/ui/TableSkeleton";
import { supabase } from "../../../lib/supabaseBrowser";
import { useProfile } from "../../../lib/useProfile";
import { getActivityData, type ActivityAuditRow as AuditRow, type ActivityExportRow as ExportEvent, type ActivityPayrollRunRow as PayrollRun } from "../../../lib/data/activityData";
import ActivityEventRow from "../../../components/activity/ActivityEventRow";
import { activityTitle, formatActivityDetail, humanizeActivityVerb, activityTone } from "../../../lib/activityPresentation";
import { formatDateTime, formatMoney } from "../../../lib/format";


function metadataLabel(metadata?: Record<string, unknown> | null) {
  const value = metadata && typeof metadata === "object" ? metadata["label"] : null;
  return typeof value === "string" && value.trim() ? value : null;
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
        const { auditRows, exportRows, runRows } = await getActivityData(supabase as any, profile.org_id);
        if (!mounted) return;
        setAuditRows(auditRows);
        setExportRows(exportRows);
        setRunRows(runRows);
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
    return <SetuPage title="Activity" subtitle="Audit, payroll, and export events across the workspace"><LoadingState title="Loading activity" description="Reading audit, export, and payroll timelines." /></SetuPage>;
  }

  if (profile?.role !== "admin") {
    return <SetuPage title="Activity" subtitle="Audit, payroll, and export events across the workspace"><div className="alert alertWarn">Admin access required.</div></SetuPage>;
  }

  return (
    <SetuPage title="Activity" subtitle="Audit, payroll, and export events across the workspace">
      {error ? <ErrorState message={error} onRetry={() => void (profile?.org_id ? getActivityData(supabase as any, profile.org_id).then(({ auditRows, exportRows, runRows }) => { setAuditRows(auditRows); setExportRows(exportRows); setRunRows(runRows); setError(""); }).catch((e: any) => setError(e?.message || "Failed to load activity.")) : null)} /> : null}
      <div className="setuKpiGrid" style={{ marginBottom: 16 }}>
        <div className="setuMetricCard"><div className="setuMetricLabel">Audit events</div><div className="setuMetricValue">{auditRows.length}</div><div className="setuMetricHint">Recent entity and payroll lifecycle events.</div></div>
        <div className="setuMetricCard"><div className="setuMetricLabel">Export events</div><div className="setuMetricValue">{exportRows.length}</div><div className="setuMetricHint">Client and payroll export history.</div></div>
        <div className="setuMetricCard"><div className="setuMetricLabel">Payroll runs</div><div className="setuMetricValue">{runRows.length}</div><div className="setuMetricHint">Recent locked, paid, or voided snapshots.</div></div>
        <div className="setuMetricCard"><div className="setuMetricLabel">Latest run amount</div><div className="setuMetricValue">{runRows[0] ? formatMoney(runRows[0].total_amount) : "—"}</div><div className="setuMetricHint">Latest payroll run from the timeline.</div></div>
      </div>
      <div className="setuSignalGrid" style={{ marginBottom: 16 }}>
        <div className="setuSignalCard"><div className="setuSignalLabel">Timeline health</div><strong>{auditRows.length + exportRows.length + runRows.length}</strong><span>Unified audit, export, and payroll events visible from one operational workspace.</span></div>
        <div className="setuSignalCard"><div className="setuSignalLabel">Latest payroll status</div><strong>{runRows[0]?.status || '—'}</strong><span>{runRows[0] ? `${formatMoney(runRows[0].total_amount)} in the latest run.` : 'No payroll runs recorded yet.'}</span></div>
        <div className="setuSignalCard"><div className="setuSignalLabel">Latest export</div><strong>{exportRows[0]?.export_type || '—'}</strong><span>{exportRows[0] ? formatDateTime(exportRows[0].created_at) : 'No export history in this workspace yet.'}</span></div>
        <div className="setuSignalCard"><div className="setuSignalLabel">Actor coverage</div><strong>{new Set(auditRows.map((row) => row.actor_name || row.actor_id || 'system')).size}</strong><span>Distinct actors captured in the audit stream.</span></div>
      </div>
      {busy ? <TableSkeleton rows={6} /> : (
        <div className="setuCommandGrid">
          <section className="setuSurfaceCard">
            <div className="setuSectionLead"><div><div className="setuSectionTitle">Audit timeline</div><div className="setuSectionHint">Trace payroll lifecycle, approvals, and data changes from one place.</div></div></div>
            <div className="setuMiniTable">
              {auditRows.map((row) => (
                <ActivityEventRow
                  key={row.id}
                  actorName={row.actor_name}
                  actorEmail={row.actor_email}
                  title={activityTitle(row.action)}
                  actionLabel={humanizeActivityVerb(row.action)}
                  detail={formatActivityDetail(row)}
                  timestamp={row.created_at}
                  tone={activityTone(row.action)}
                />
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
                  <div className="muted" style={{ fontSize: 12 }}>{formatDateTime(row.created_at)}</div>
                </div>
              ))}
              {exportRows.map((row) => (
                <div className="setuMiniRow" key={`exp-${row.id}`}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{metadataLabel(row.metadata) || row.export_type || "Export event"}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{row.period_start || "—"} → {row.period_end || "—"}</div>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{formatDateTime(row.created_at)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </SetuPage>
  );
}
