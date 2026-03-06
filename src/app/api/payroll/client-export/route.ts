import { NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";
import { buildZip } from "../../../../lib/exports/simpleZip";
import { buildPayrollCoverPdf, buildPayrollDetailPdf, buildPayrollSummaryPdf } from "../../../../lib/exports/simplePdf";
import { logExportEvent } from "../../../../lib/exports/logExportEvent";
import crypto from "crypto";

export const runtime = "nodejs";

function csvEscape(v: any) {
  const s = (v ?? "").toString();
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows: Record<string, any>[], headers: string[]) {
  const head = headers.map(csvEscape).join(",");
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")).join("\n");
  return head + "\n" + body + "\n";
}

async function requireAdmin(req: Request) {
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
  if (prof.role !== "admin") return { ok: false as const, status: 403, error: "Admin only" };

  return { ok: true as const, supa, profile: prof };
}

export async function GET(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const url = new URL(req.url);
    const period_start = url.searchParams.get("period_start");
    const period_end = url.searchParams.get("period_end");
    const project_id = url.searchParams.get("project_id");

    if (!period_start || !period_end || !project_id) {
      return NextResponse.json({ ok: false, error: "Missing period_start/period_end/project_id" }, { status: 400 });
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
      .select("id,status,currency")
      .eq("org_id", profile.org_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .neq("status", "voided")
      .maybeSingle();
    if (runErr) return NextResponse.json({ ok: false, error: runErr.message }, { status: 400 });
    if (!run?.id) return NextResponse.json({ ok: false, error: "No payroll run snapshot" }, { status: 409 });

    const { data: proj, error: projErr } = await supa
      .from("projects")
      .select("id,name")
      .eq("org_id", profile.org_id)
      .eq("id", project_id)
      .maybeSingle();
    if (projErr) return NextResponse.json({ ok: false, error: projErr.message }, { status: 400 });

    const projectName = proj?.name || project_id;
    const safeProject = projectName.replace(/[^a-z0-9\-_.]+/gi, "_");
    const stamp = `${period_start}_to_${period_end}`;

    const { data: ent, error: entErr } = await supa
      .from("payroll_run_entries")
      .select("time_entry_id,entry_date,contractor_id,contractor_name_snapshot,project_name_snapshot,project_id,hours,hourly_rate_snapshot,amount")
      .eq("payroll_run_id", run.id)
      .eq("project_id", project_id)
      .order("contractor_name_snapshot", { ascending: true })
      .order("entry_date", { ascending: true });
    if (entErr) return NextResponse.json({ ok: false, error: entErr.message }, { status: 400 });

    // Detail CSV
    const detailRows = (ent ?? []).map((r: any) => {
      const hours = Number(r.hours ?? 0);
      const rate = Number(r.hourly_rate_snapshot ?? 0);
      const pay = Number(r.amount ?? hours * rate);
      return {
        entry_id: r.time_entry_id,
        date: r.entry_date,
        contractor_id: r.contractor_id,
        contractor: r.contractor_name_snapshot ?? "",
        project_id: r.project_id,
        project: r.project_name_snapshot ?? "",
        hours: hours.toFixed(2),
        rate: rate.toFixed(2),
        pay: pay.toFixed(2),
      };
    });
    const detailCsv = toCsv(detailRows, ["entry_id","date","contractor_id","contractor","project_id","project","hours","rate","pay"]);

    // Summary (compute from project-scoped entries)
    const by = new Map<string, { contractor_id: string; contractor: string; hours: number; pay: number }>();
    for (const r of ent ?? []) {
      const cid = (r as any).contractor_id as string;
      const name = (r as any).contractor_name_snapshot ?? "";
      const hours = Number((r as any).hours ?? 0);
      const pay = Number((r as any).amount ?? hours * Number((r as any).hourly_rate_snapshot ?? 0));
      const cur = by.get(cid) || { contractor_id: cid, contractor: name, hours: 0, pay: 0 };
      cur.hours += hours;
      cur.pay += pay;
      by.set(cid, cur);
    }
    const summaryRows = Array.from(by.values())
      .map((x) => {
        const rate = x.hours > 0 ? x.pay / x.hours : 0;
        return {
          contractor_id: x.contractor_id,
          contractor: x.contractor,
          period_start,
          period_end,
          project_id,
          project: projectName,
          total_hours: x.hours.toFixed(2),
          rate: rate.toFixed(2),
          total_pay: x.pay.toFixed(2),
        };
      })
      .sort((a, b) => (a.contractor || "").localeCompare(b.contractor || ""));
    const summaryCsv = toCsv(summaryRows, ["contractor_id","contractor","project_id","project","period_start","period_end","total_hours","rate","total_pay"]);

    const generatedAtIso = new Date().toISOString();
    const pdfMeta = {
      periodStart: period_start,
      periodEnd: period_end,
      projectName,
      generatedAtIso,
    };
    const pdfSummaryLines = summaryRows.map((s) => ({
      contractor: s.contractor,
      hours: Number(s.total_hours),
      avgRate: Number((s as any).rate),
      pay: Number(s.total_pay),
    }));
    const pdfDetailLines = detailRows.map((d) => ({
      date: d.date,
      contractor: d.contractor,
      project: d.project,
      hours: Number(d.hours),
      rate: Number(d.rate),
      pay: Number(d.pay),
    }));
    const pdf = buildPayrollSummaryPdf(pdfMeta as any, pdfSummaryLines);
    const pdfDetail = buildPayrollDetailPdf(pdfMeta as any, pdfDetailLines);
    const totalHours = summaryRows.reduce((a, s) => a + Number(s.total_hours || 0), 0);
    const totalPay = summaryRows.reduce((a, s) => a + Number(s.total_pay || 0), 0);
    const cover = buildPayrollCoverPdf(pdfMeta as any, { totalHours, totalPay, currency: (run as any)?.currency || "USD" });

    const manifest = {
      type: "client_payroll_bundle",
      period_start,
      period_end,
      project_id,
      project_name: projectName,
      generated_at: generatedAtIso,
      files: [
        `cover_${safeProject}_${stamp}.pdf`,
        `payroll_${safeProject}_${stamp}_summary.csv`,
        `payroll_${safeProject}_${stamp}_detail.csv`,
        `payroll_${safeProject}_${stamp}_summary.pdf`,
        `payroll_${safeProject}_${stamp}_detail.pdf`,
      ],
    };

    const zip = buildZip([
      { name: `cover_${safeProject}_${stamp}.pdf`, data: cover },
      { name: `payroll_${safeProject}_${stamp}_summary.csv`, data: Buffer.from(summaryCsv, "utf8") },
      { name: `payroll_${safeProject}_${stamp}_detail.csv`, data: Buffer.from(detailCsv, "utf8") },
      { name: `payroll_${safeProject}_${stamp}_summary.pdf`, data: pdf },
      { name: `payroll_${safeProject}_${stamp}_detail.pdf`, data: pdfDetail },
      { name: `manifest_${safeProject}_${stamp}.json`, data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8") },
    ]);

    // Phase 3.2: create/update a first-class project export record so it can be marked paid.
    // This is separate from export_events (immutable receipts).
    const payloadHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(manifest))
      .digest("hex");

    let projectExportId: string | null = null;
    try {
      const { data: pe, error: peErr } = await supa
        .from("project_exports")
        .upsert(
          {
            org_id: profile.org_id,
            project_id,
            export_type: "payroll_client_bundle",
            period_start,
            period_end,
            payload_hash: payloadHash,
            metadata: { project_name: projectName, run_id: run.id, file_format: "zip" },
            created_by: profile.id,
          } as any,
          { onConflict: "org_id,project_id,export_type,period_start,period_end" }
        )
        .select("id")
        .maybeSingle();
      if (!peErr) projectExportId = (pe as any)?.id ?? null;
    } catch {
      // Never block download.
      projectExportId = null;
    }

    logExportEvent({
      org_id: profile.org_id,
      run_id: run.id,
      project_export_id: projectExportId,
      actor_id: profile.id,
      actor_name_snapshot: (profile as any).full_name ?? null,
      export_type: "payroll_client_bundle",
      file_format: "zip",
      scope: "project",
      project_id,
      period_start,
      period_end,
      metadata: { project_name: projectName, run_status: run.status, payload_hash: payloadHash },
    });

    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="payroll_${safeProject}_${stamp}.zip"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
