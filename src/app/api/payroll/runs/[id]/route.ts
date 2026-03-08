import { NextResponse } from "next/server";
import { requireManagerOrAdmin } from "../../../../../lib/api/gates";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const gate = await requireManagerOrAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const runId = params?.id;
    if (!runId) return NextResponse.json({ ok: false, error: "Missing run id" }, { status: 400 });

    const { supa, profile } = gate;

    const { data: run, error: runErr } = await supa
      .from("payroll_runs")
      .select(
        "id, period_start, period_end, status, created_at, total_hours, total_amount, currency, created_by, locked_pay_period_id, paid_at, paid_by, paid_note"
      )
      .eq("org_id", profile.org_id)
      .eq("id", runId)
      .maybeSingle();

    if (runErr) return NextResponse.json({ ok: false, error: runErr.message }, { status: 400 });
    if (!run) return NextResponse.json({ ok: false, error: "Payroll run not found" }, { status: 404 });

    // Best-effort: resolve paid_by to full name for display
    if ((run as any)?.paid_by) {
      const { data: pb } = await supa
        .from("profiles")
        .select("full_name")
        .eq("org_id", profile.org_id)
        .eq("id", (run as any).paid_by)
        .maybeSingle();
      (run as any).paid_by_name = (pb as any)?.full_name || null;
    }

    const [{ data: lines, error: linesErr }, { data: entries, error: entriesErr }] = await Promise.all([
      supa
        .from("payroll_run_lines")
        .select("contractor_id, contractor_name_snapshot, hourly_rate_snapshot, hours, amount")
        .eq("org_id", profile.org_id)
        .eq("payroll_run_id", runId)
        .order("contractor_name_snapshot", { ascending: true }),
      supa
        .from("payroll_run_entries")
        .select(
          "time_entry_id, contractor_id, contractor_name_snapshot, project_id, project_name_snapshot, entry_date, hours, hourly_rate_snapshot, amount"
        )
        .eq("org_id", profile.org_id)
        .eq("payroll_run_id", runId)
        .order("entry_date", { ascending: true })
        .limit(2000),
    ]);

    if (linesErr) return NextResponse.json({ ok: false, error: linesErr.message }, { status: 400 });
    if (entriesErr) return NextResponse.json({ ok: false, error: entriesErr.message }, { status: 400 });

    const { data: audit, error: auditErr } = await supa
      .from("audit_log")
      .select("id, action, actor_id, created_at, metadata")
      .eq("org_id", profile.org_id)
      .eq("entity_type", "payroll_run")
      .eq("entity_id", runId)
      .order("created_at", { ascending: false })
      .limit(25);

    if (auditErr) {
      // Don't fail the page for audit issues; just omit it.
    }



    const { data: exports, error: expErr } = await supa
      .from("export_events")
      .select(
        "id, created_at, export_type, file_format, scope, project_id, actor_id, actor_name_snapshot, metadata, project_export_id, payload_hash"
      )
      .eq("org_id", profile.org_id)
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(25);

    const normalizedRun = {
      ...(run as any),
      is_paid: String((run as any)?.status || "").toLowerCase() === "paid" || !!(run as any)?.paid_at,
    };

    const normalizedLines = ((lines || []) as any[]).map((line) => ({
      id: String(line.contractor_id),
      contractor_id: line.contractor_id,
      contractor_name: line.contractor_name_snapshot || "Unknown contractor",
      hours: Number(line.hours || 0),
      hourly_rate: Number(line.hourly_rate_snapshot || 0),
      amount: Number(line.amount || 0),
    }));

    const receipts = ((exports || []) as any[]).map((evt) => ({
      id: evt.id,
      org_id: profile.org_id,
      created_at: evt.created_at,
      created_by: evt.actor_id || null,
      actor_name: evt.actor_name_snapshot || null,
      type: evt.export_type,
      label: evt.metadata?.project_name
        ? `${evt.export_type} • ${evt.metadata.project_name}`
        : evt.export_type,
      project_id: evt.project_id || null,
      payroll_run_id: runId,
      project_export_id: evt.project_export_id || evt.metadata?.project_export_id || null,
      payload_hash: evt.payload_hash || evt.metadata?.payload_hash || null,
      diff_status: "unknown",
      meta: {
        ...(evt.metadata || {}),
        file_format: evt.file_format,
        scope: evt.scope,
      },
    }));

    // Export receipts are best-effort; don't fail the page.

    return NextResponse.json({
      ok: true,
      run: normalizedRun,
      lines: normalizedLines,
      entries: entries || [],
      audit: (audit || []) as any,
      exports: (exports || []) as any,
      receipts,
      counts: {
        contractors: (lines || []).length,
        entries: (entries || []).length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
