import { NextResponse } from "next/server";
import { requireManagerOrAdmin } from "../../../../lib/api/gates";

export async function GET(req: Request) {
  try {
    const gate = await requireManagerOrAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const url = new URL(req.url);
    const period_start = url.searchParams.get("period_start") || "";
    const period_end = url.searchParams.get("period_end") || "";
    const project_id = url.searchParams.get("project_id") || "";
    const run_id_param = url.searchParams.get("run_id") || "";
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || 10)));

    if (!period_start || !period_end) {
      return NextResponse.json({ ok: false, error: "Missing period_start/period_end" }, { status: 400 });
    }

    const { supa, profile } = gate;

    // Resolve the payroll run snapshot for this period (preferred), unless caller passes run_id explicitly.
    let run_id = run_id_param;
    if (!run_id) {
      const { data: run, error: runErr } = await supa
        .from("payroll_runs")
        .select("id,status")
        .eq("org_id", profile.org_id)
        .eq("period_start", period_start)
        .eq("period_end", period_end)
        .neq("status", "voided")
        .maybeSingle();
      if (!runErr && run?.id) run_id = run.id;
    }

    let q = supa
      .from("export_events")
      .select(
        "id, created_at, export_type, file_format, scope, project_id, period_start, period_end, actor_id, actor_name_snapshot, metadata, run_id"
      )
      .eq("org_id", profile.org_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (run_id) q = q.eq("run_id", run_id);
    if (project_id) q = q.eq("project_id", project_id);

    const { data: events, error: evErr } = await q;
    if (evErr) return NextResponse.json({ ok: false, error: evErr.message }, { status: 400 });

    return NextResponse.json(
      { ok: true, run_id: run_id || null, events: events || [] },
      { status: 200, headers: { "cache-control": "private, max-age=10" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
