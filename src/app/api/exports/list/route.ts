// src/app/api/exports/list/route.ts
import { NextResponse } from "next/server";
import { requireManagerOrAdmin } from "../../../../lib/api/gates";
import { supabaseService } from "../../../../lib/supabaseServer";

type ApiRow = {
  id: string;
  org_id: string;
  created_at: string;

  actor_id: string;
  actor_name_snapshot: string | null;

  export_type: string;
  file_format: string;
  scope: string;

  project_id: string | null;
  run_id: string | null;

  metadata: any;
};

export async function GET(req: Request) {
  const supa = supabaseService();
  try {
    const gate = await requireManagerOrAdmin(req);
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
    }

    const { supa, profile } = gate;

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

    const { data, error } = await supa
      .from("export_events")
      .select(
        "id, org_id, created_at, actor_id, actor_name_snapshot, export_type, file_format, scope, project_id, run_id, metadata"
      )
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const exports = ((data || []) as ApiRow[]).map((r) => ({
      id: r.id,
      org_id: r.org_id,
      created_at: r.created_at,

      // shape expected by UI
      created_by: r.actor_id,
      actor_name: r.actor_name_snapshot,

      type: r.export_type,
      label: r.metadata?.label || null,

      project_id: r.project_id,
      payroll_run_id: r.run_id,

      // optional fields for UI (project_exports handles diff/paid separately)
      project_export_id: r.metadata?.project_export_id || null,
      payload_hash: null,
      diff_status: "unknown" as const,

      meta: r.metadata || {},
    }));

    return NextResponse.json({ ok: true, exports });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}