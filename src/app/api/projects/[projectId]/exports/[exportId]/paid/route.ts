import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../../lib/api/gates";

export async function POST(
  req: Request,
  ctx: { params: { projectId: string; exportId: string } }
) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const { supa, profile } = gate;
    const projectId = ctx.params.projectId;
    const exportId = ctx.params.exportId;

    const body = await req.json().catch(() => ({} as any));
    const is_paid = body?.is_paid === false ? false : true;
    const paid_note = String(body?.paid_note || "").slice(0, 2000);

    // Validate export belongs to org + project.
    const { data: existing, error: exErr } = await supa
      .from("project_exports")
      .select("id, org_id, project_id, is_paid")
      .eq("org_id", profile.org_id)
      .eq("project_id", projectId)
      .eq("id", exportId)
      .maybeSingle();

    if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 400 });
    if (!existing?.id) return NextResponse.json({ ok: false, error: "Export not found" }, { status: 404 });

    const patch: any = {
      is_paid,
      paid_note,
    };

    if (is_paid) {
      patch.paid_by = profile.id;
      patch.paid_at = new Date().toISOString();
    } else {
      patch.paid_by = null;
      patch.paid_at = null;
    }

    const { data, error } = await supa
      .from("project_exports")
      .update(patch)
      .eq("id", exportId)
      .eq("org_id", profile.org_id)
      .select("id,is_paid,paid_by,paid_at,paid_note")
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, export: data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
