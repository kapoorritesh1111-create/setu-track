import { NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";
import { requireManagerOrAdmin } from "../../../../lib/api/gates";

/**
 * GET /api/payroll/summary
 * Returns per-project payroll summaries for the current org.
 *
 * NOTE:
 * - This is a read endpoint used by /reports/payroll.
 * - Export generation remains in /api/payroll/export (which requires period params).
 */
export async function GET(req: Request) {
  const supa = supabaseService();
  const auth = await requireManagerOrAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Per-project totals for approved entries (not locked period based).
  // If you later want "by pay period", create a separate endpoint.
  const { data, error } = await supa
    .from("projects")
    .select(
      "id,name,updated_at, project_exports:project_exports(id,created_at,period_start,period_end, total_amount, paid_at, paid_by, paid_note)"
    )
    .eq("org_id", auth.org_id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Normalize: most recent export per project (if any)
  const rows = (data || []).map((p: any) => {
    const exports = (p.project_exports || []).sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latest = exports[0] || null;
    return {
      project_id: p.id,
      project_name: p.name,
      latest_export_id: latest?.id || null,
      latest_period_start: latest?.period_start || null,
      latest_period_end: latest?.period_end || null,
      latest_total_amount: latest?.total_amount || 0,
      paid_at: latest?.paid_at || null,
      paid_by: latest?.paid_by || null,
      paid_note: latest?.paid_note || null,
      updated_at: p.updated_at,
    };
  });

  return NextResponse.json({ rows });
}