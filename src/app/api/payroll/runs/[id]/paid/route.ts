import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/api/gates";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const runId = params?.id;
    if (!runId) return NextResponse.json({ ok: false, error: "Missing run id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const paid = Boolean(body?.paid);
    const note = typeof body?.note === "string" ? body.note : null;

    const { supa, profile } = gate;

    // Validate run belongs to org
    const { data: run, error: runErr } = await supa
      .from("payroll_runs")
      .select("id")
      .eq("org_id", profile.org_id)
      .eq("id", runId)
      .maybeSingle();

    if (runErr) return NextResponse.json({ ok: false, error: runErr.message }, { status: 400 });
    if (!run) return NextResponse.json({ ok: false, error: "Payroll run not found" }, { status: 404 });

    const { data, error } = await supa.rpc("mark_payroll_run_paid", {
      p_run_id: runId,
      p_paid: paid,
      p_note: note,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, run: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
