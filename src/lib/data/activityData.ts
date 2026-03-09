import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityAuditRow = {
  id: string;
  action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string | null;
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
};

export type ActivityExportRow = {
  id: string;
  export_type: string | null;
  file_format: string | null;
  scope: string | null;
  created_at: string | null;
  period_start: string | null;
  period_end: string | null;
  metadata: Record<string, unknown> | null;
};

export type ActivityPayrollRunRow = {
  id: string;
  created_at: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string | null;
  total_amount: number | null;
};

export async function getActivityData(client: SupabaseClient, orgId: string) {
  const auditQuery = client
    .from("audit_log")
    .select("id,action,entity_type,entity_id,created_at,actor_id,metadata")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(40);

  const exportQuery = client
    .from("export_events")
    .select("id,export_type,file_format,scope,created_at,period_start,period_end,metadata")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20);

  const runQuery = client
    .from("payroll_runs")
    .select("id,created_at,period_start,period_end,status,total_amount")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20);

  const [auditRes, exportRes, runRes] = await Promise.all([auditQuery, exportQuery, runQuery]);
  if (auditRes.error || exportRes.error || runRes.error) {
    throw new Error(auditRes.error?.message || exportRes.error?.message || runRes.error?.message || "Failed to load activity");
  }

  return {
    auditRows: ((auditRes.data || []) as ActivityAuditRow[]).map((row) => ({ ...row, metadata: (row.metadata || null) as Record<string, unknown> | null })),
    exportRows: ((exportRes.data || []) as ActivityExportRow[]).map((row) => ({ ...row, metadata: (row.metadata || null) as Record<string, unknown> | null })),
    runRows: (runRes.data || []) as ActivityPayrollRunRow[],
  };
}
