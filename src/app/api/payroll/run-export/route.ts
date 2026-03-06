import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/api/gates";
import { toCsv } from "../../../../lib/csv";
import { logExportEvent } from "../../../../lib/exports/logExportEvent";

type ExportMode = "summary" | "detail";

export async function GET(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const url = new URL(req.url);
    const mode = (url.searchParams.get("mode") || "summary") as ExportMode;
    const run_id = url.searchParams.get("run_id");
    if (!run_id) return NextResponse.json({ ok: false, error: "Missing run_id" }, { status: 400 });
    if (mode !== "summary" && mode !== "detail") return NextResponse.json({ ok: false, error: "Invalid mode" }, { status: 400 });

    const { supa, profile } = gate;

    const { data: run, error: runErr } = await supa
      .from("payroll_runs")
      .select("id, period_start, period_end, status")
      .eq("org_id", profile.org_id)
      .eq("id", run_id)
      .maybeSingle();

    if (runErr) return NextResponse.json({ ok: false, error: runErr.message }, { status: 400 });
    if (!run) return NextResponse.json({ ok: false, error: "Run not found" }, { status: 404 });

    if (mode === "summary") {
      const { data: lines, error: linesErr } = await supa
        .from("payroll_run_lines")
        .select("contractor_id, contractor_name_snapshot, hourly_rate_snapshot, hours, amount")
        .eq("org_id", profile.org_id)
        .eq("payroll_run_id", run_id)
        .order("contractor_name_snapshot", { ascending: true });

      if (linesErr) return NextResponse.json({ ok: false, error: linesErr.message }, { status: 400 });

      const out = (lines ?? []).map((l: any) => ({
        contractor_id: l.contractor_id,
        contractor: l.contractor_name_snapshot ?? "",
        period_start: run.period_start,
        period_end: run.period_end,
        hourly_rate_snapshot: Number(l.hourly_rate_snapshot ?? 0).toFixed(2),
        total_hours: Number(l.hours ?? 0).toFixed(2),
        total_pay: Number(l.amount ?? 0).toFixed(2),
        run_status: run.status,
      }));

      const csv = toCsv(out, [
        "contractor_id",
        "contractor",
        "period_start",
        "period_end",
        "hourly_rate_snapshot",
        "total_hours",
        "total_pay",
        "run_status",
      ]);

      logExportEvent({
        org_id: profile.org_id,
        run_id: run.id,
        actor_id: profile.id,
        actor_name_snapshot: (profile as any).full_name ?? null,
        export_type: "payroll_run_csv_summary",
        file_format: "csv",
        scope: "run",
        period_start: run.period_start,
        period_end: run.period_end,
        metadata: { mode, run_status: run.status },
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="payroll_run_${run.period_start}_to_${run.period_end}_summary.csv"`,
        },
      });
    }

    // detail
    const { data: rows, error: rowsErr } = await supa
      .from("payroll_run_entries")
      .select(
        "time_entry_id, contractor_id, contractor_name_snapshot, project_id, project_name_snapshot, entry_date, hours, hourly_rate_snapshot, amount"
      )
      .eq("org_id", profile.org_id)
      .eq("payroll_run_id", run_id)
      .order("entry_date", { ascending: true });

    if (rowsErr) return NextResponse.json({ ok: false, error: rowsErr.message }, { status: 400 });

    const out = (rows ?? []).map((r: any) => ({
      time_entry_id: r.time_entry_id,
      contractor_id: r.contractor_id,
      contractor: r.contractor_name_snapshot ?? "",
      date: r.entry_date,
      project_id: r.project_id,
      project: r.project_name_snapshot ?? "",
      hours: Number(r.hours ?? 0).toFixed(2),
      rate: Number(r.hourly_rate_snapshot ?? 0).toFixed(2),
      pay: Number(r.amount ?? 0).toFixed(2),
      period_start: run.period_start,
      period_end: run.period_end,
      run_status: run.status,
    }));

    const csv = toCsv(out, [
      "time_entry_id",
      "contractor_id",
      "contractor",
      "date",
      "project_id",
      "project",
      "hours",
      "rate",
      "pay",
      "period_start",
      "period_end",
      "run_status",
    ]);

    logExportEvent({
      org_id: profile.org_id,
      run_id: run.id,
      actor_id: profile.id,
      actor_name_snapshot: (profile as any).full_name ?? null,
      export_type: "payroll_run_csv_detail",
      file_format: "csv",
      scope: "run",
      period_start: run.period_start,
      period_end: run.period_end,
      metadata: { mode, run_status: run.status },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="payroll_run_${run.period_start}_to_${run.period_end}_detail.csv"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
