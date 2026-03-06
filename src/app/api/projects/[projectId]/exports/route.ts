import { NextResponse } from "next/server";
import { requireManagerOrAdmin } from "../../../../../lib/api/gates";

export async function GET(req: Request, ctx: { params: { projectId: string } }) {
  try {
    const gate = await requireManagerOrAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const { supa, profile } = gate;
    const projectId = ctx.params.projectId;

    const url = new URL(req.url);
    const period_start = url.searchParams.get("period_start");
    const period_end = url.searchParams.get("period_end");
    const export_type = url.searchParams.get("export_type");

    let q = supa
      .from("project_exports")
      .select(
        "id, created_at, created_by, export_type, period_start, period_end, payload_hash, metadata, is_paid, paid_by, paid_at, paid_note"
      )
      .eq("org_id", profile.org_id)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (period_start) q = q.eq("period_start", period_start);
    if (period_end) q = q.eq("period_end", period_end);
    if (export_type) q = q.eq("export_type", export_type);

    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, exports: data || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
