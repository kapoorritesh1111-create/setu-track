import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/api/gates";

type Action = "mark_paid" | "void" | "reopen";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const runId = params?.id;
    if (!runId) return NextResponse.json({ ok: false, error: "Missing run id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "") as Action;
    const reason = body?.reason ? String(body.reason).slice(0, 500) : null;

    if (!action || !["mark_paid", "void", "reopen"].includes(action)) {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
    }

    const { supa, profile } = gate;

    // Load run (org-scoped)
    const { data: run, error: runErr } = await supa
      .from("payroll_runs")
      .select("id, org_id, period_start, period_end, status")
      .eq("org_id", profile.org_id)
      .eq("id", runId)
      .maybeSingle();

    if (runErr) return NextResponse.json({ ok: false, error: runErr.message }, { status: 400 });
    if (!run) return NextResponse.json({ ok: false, error: "Run not found" }, { status: 404 });

    const before = { status: run.status };

    // Status rules:
    // - mark_paid: only from 'closed'
    // - void: only from 'closed' (cannot void paid)
    // - reopen: only from 'closed' (voids the run + unlocks the pay period)
    if (action === "mark_paid") {
      if (run.status !== "closed") {
        return NextResponse.json({ ok: false, error: "Only closed runs can be marked paid." }, { status: 409 });
      }

      const { error: updErr } = await supa
        .from("payroll_runs")
        .update({ status: "paid" })
        .eq("org_id", profile.org_id)
        .eq("id", runId);

      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });

      await supa.from("audit_log").insert({
        org_id: profile.org_id,
        actor_id: profile.id,
        action: "payroll_run_mark_paid",
        entity_type: "payroll_run",
        entity_id: runId,
        before,
        after: { status: "paid" },
        metadata: { reason },
      });

      return NextResponse.json({ ok: true, status: "paid" });
    }

    if (action === "void") {
      if (run.status !== "closed") {
        return NextResponse.json({ ok: false, error: "Only closed runs can be voided." }, { status: 409 });
      }

      const { error: updErr } = await supa
        .from("payroll_runs")
        .update({ status: "voided" })
        .eq("org_id", profile.org_id)
        .eq("id", runId);

      if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });

      await supa.from("audit_log").insert({
        org_id: profile.org_id,
        actor_id: profile.id,
        action: "payroll_run_voided",
        entity_type: "payroll_run",
        entity_id: runId,
        before,
        after: { status: "voided" },
        metadata: { reason },
      });

      return NextResponse.json({ ok: true, status: "voided" });
    }

    // reopen
    if (run.status !== "closed") {
      return NextResponse.json({ ok: false, error: "Only closed runs can be reopened." }, { status: 409 });
    }

    // 1) Void the run with a specific audit action.
    const { error: updErr } = await supa
      .from("payroll_runs")
      .update({ status: "voided" })
      .eq("org_id", profile.org_id)
      .eq("id", runId);

    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });

    // 2) Unlock the pay period row (if it exists).
    const { error: unlockErr } = await supa
      .from("pay_periods")
      .update({ locked: false, locked_at: null, locked_by: null })
      .eq("org_id", profile.org_id)
      .eq("period_start", run.period_start)
      .eq("period_end", run.period_end);

    if (unlockErr) return NextResponse.json({ ok: false, error: unlockErr.message }, { status: 400 });

    await supa.from("audit_log").insert({
      org_id: profile.org_id,
      actor_id: profile.id,
      action: "payroll_run_reopened",
      entity_type: "payroll_run",
      entity_id: runId,
      before,
      after: { status: "voided" },
      metadata: { reason, period_start: run.period_start, period_end: run.period_end },
    });

    return NextResponse.json({ ok: true, status: "voided", reopened: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
