import { NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";
import { buildPayrollDetailPdf, buildPayrollSummaryPdf } from "../../../../lib/exports/simplePdf";
import { logExportEvent } from "../../../../lib/exports/logExportEvent";

export const runtime = "nodejs";

type Mode = "summary" | "detail";

async function requireManagerOrAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false as const, status: 401, error: "Missing auth token" };

  const supa = supabaseService();

  const { data: caller, error: callerErr } = await supa.auth.getUser(token);
  if (callerErr || !caller?.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  const { data: prof, error: profErr } = await supa
    .from("profiles")
    .select("id, org_id, role, full_name")
    .eq("id", caller.user.id)
    .maybeSingle();

  if (profErr) return { ok: false as const, status: 400, error: profErr.message };
  if (!prof?.org_id) return { ok: false as const, status: 403, error: "No org" };
  if (prof.role !== "admin" && prof.role !== "manager") return { ok: false as const, status: 403, error: "Manager/Admin only" };

  return { ok: true as const, supa, profile: prof };
}

export async function GET(req: Request) {
  try {
    const gate = await requireManagerOrAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const url = new URL(req.url);
    const mode = (url.searchParams.get("mode") || "summary") as Mode;
    const period_start = url.searchParams.get("period_start");
    const period_end = url.searchParams.get("period_end");
    const project_id = url.searchParams.get("project_id") || "";
    const project_name = url.searchParams.get("project_name") || "";

    if (!period_start || !period_end) {
      return NextResponse.json({ ok: false, error: "Missing period_start/period_end" }, { status: 400 });
    }
    if (mode !== "summary" && mode !== "detail") {
      return NextResponse.json({ ok: false, error: "Invalid mode" }, { status: 400 });
    }

    const { supa, profile } = gate;

    const { data: pp, error: ppErr } = await supa
      .from("pay_periods")
      .select("locked")
      .eq("org_id", profile.org_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .maybeSingle();
    if (ppErr) return NextResponse.json({ ok: false, error: ppErr.message }, { status: 400 });
    if (!pp?.locked) return NextResponse.json({ ok: false, error: "Pay period is not locked" }, { status: 409 });

    const { data: run, error: runErr } = await supa
      .from("payroll_runs")
      .select("id,status")
      .eq("org_id", profile.org_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .neq("status", "voided")
      .maybeSingle();
    if (runErr) return NextResponse.json({ ok: false, error: runErr.message }, { status: 400 });
    if (!run?.id) {
      return NextResponse.json(
        { ok: false, error: "Locked pay period has no payroll run snapshot." },
        { status: 409 }
      );
    }

    const generatedAtIso = new Date().toISOString();
    const meta = {
      orgName: "SETU GROUPS",
      productName: "SETU TRACK",
      periodStart: period_start,
      periodEnd: period_end,
      projectName: project_name || undefined,
      generatedAtIso,
    };

    if (mode === "summary") {
      let q = supa
        .from("payroll_run_lines")
        .select("contractor_name_snapshot,hours,hourly_rate_snapshot,amount")
        .eq("payroll_run_id", run.id)
        .order("contractor_name_snapshot", { ascending: true });

      if (project_id) {
        // If project scoped, compute from entries (lines are overall by contractor)
        const { data: ent, error: entErr } = await supa
          .from("payroll_run_entries")
          .select("contractor_name_snapshot,hours,hourly_rate_snapshot,amount")
          .eq("payroll_run_id", run.id)
          .eq("project_id", project_id);
        if (entErr) return NextResponse.json({ ok: false, error: entErr.message }, { status: 400 });

        const by = new Map<string, { contractor: string; hours: number; pay: number }>();
        for (const r of ent ?? []) {
          const name = (r as any).contractor_name_snapshot || "";
          const hours = Number((r as any).hours ?? 0);
          const pay = Number((r as any).amount ?? (hours * Number((r as any).hourly_rate_snapshot ?? 0)));
          const cur = by.get(name) || { contractor: name, hours: 0, pay: 0 };
          cur.hours += hours;
          cur.pay += pay;
          by.set(name, cur);
        }
        const lines = Array.from(by.values()).map((x) => ({
          contractor: x.contractor,
          hours: x.hours,
          avgRate: x.hours > 0 ? x.pay / x.hours : 0,
          pay: x.pay,
        }));

        const pdf = buildPayrollSummaryPdf(meta as any, lines);

        logExportEvent({
          org_id: profile.org_id,
          run_id: run.id,
          actor_id: profile.id,
          actor_name_snapshot: (profile as any).full_name ?? null,
          export_type: "payroll_pdf_summary",
          file_format: "pdf",
          scope: project_id ? "project" : "run",
          project_id: project_id || null,
          period_start,
          period_end,
          metadata: { mode, project_name: project_name || null, run_status: run.status },
        });

        return new NextResponse(new Uint8Array(pdf), {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `attachment; filename="payroll_summary_${period_start}_to_${period_end}${project_id ? "_project" : ""}.pdf"`,
          },
        });
      }

      const { data: lines, error: linesErr } = await q;
      if (linesErr) return NextResponse.json({ ok: false, error: linesErr.message }, { status: 400 });

      const mapped = (lines ?? []).map((r: any) => ({
        contractor: r.contractor_name_snapshot ?? "",
        hours: Number(r.hours ?? 0),
        // payroll_run_lines stores a single locked snapshot rate per contractor
        avgRate: Number(r.hourly_rate_snapshot ?? 0),
        pay: Number(r.amount ?? 0),
      }));

      const pdf = buildPayrollSummaryPdf(meta as any, mapped);

      logExportEvent({
        org_id: profile.org_id,
        run_id: run.id,
        actor_id: profile.id,
        actor_name_snapshot: (profile as any).full_name ?? null,
        export_type: "payroll_pdf_summary",
        file_format: "pdf",
        scope: "run",
        period_start,
        period_end,
        metadata: { mode, run_status: run.status },
      });

      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="payroll_summary_${period_start}_to_${period_end}.pdf"`,
        },
      });
    }

    // detail
    let q = supa
      .from("payroll_run_entries")
      .select("entry_date,contractor_name_snapshot,project_name_snapshot,hours,hourly_rate_snapshot,amount,project_id")
      .eq("payroll_run_id", run.id)
      .order("contractor_name_snapshot", { ascending: true })
      .order("entry_date", { ascending: true });
    if (project_id) q = q.eq("project_id", project_id);
    const { data: ent, error: entErr } = await q;
    if (entErr) return NextResponse.json({ ok: false, error: entErr.message }, { status: 400 });

    const mapped = (ent ?? []).map((r: any) => {
      const hours = Number(r.hours ?? 0);
      const rate = Number(r.hourly_rate_snapshot ?? 0);
      const pay = Number(r.amount ?? hours * rate);
      return {
        date: r.entry_date,
        contractor: r.contractor_name_snapshot ?? "",
        project: r.project_name_snapshot ?? "",
        hours,
        rate,
        pay,
      };
    });

    const pdf = buildPayrollDetailPdf(meta as any, mapped);

    logExportEvent({
      org_id: profile.org_id,
      run_id: run.id,
      actor_id: profile.id,
      actor_name_snapshot: (profile as any).full_name ?? null,
      export_type: "payroll_pdf_detail",
      file_format: "pdf",
      scope: project_id ? "project" : "run",
      project_id: project_id || null,
      period_start,
      period_end,
      metadata: { mode, project_name: project_name || null, run_status: run.status },
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="payroll_detail_${period_start}_to_${period_end}${project_id ? "_project" : ""}.pdf"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
