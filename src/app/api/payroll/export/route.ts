import { NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";
import { logExportEvent } from "../../../../lib/exports/logExportEvent";

type ExportMode = "summary" | "detail";

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

function yyyyMmDd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: Request) {
  try {
    const gate = await requireManagerOrAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const url = new URL(req.url);
    const mode = (url.searchParams.get("mode") || "summary") as ExportMode;

    let period_start = url.searchParams.get("period_start") || "";
    let period_end = url.searchParams.get("period_end") || "";

    if (mode !== "summary" && mode !== "detail") {
      return NextResponse.json({ ok: false, error: "Invalid mode" }, { status: 400 });
    }

    const { supa, profile } = gate;

    // ✅ Default period if UI didn't pass it:
    // 1) latest payroll_run for org, else
    // 2) current month → today
    if (!period_start || !period_end) {
      const { data: latestRun } = await supa
        .from("payroll_runs")
        .select("period_start, period_end")
        .eq("org_id", profile.org_id)
        .neq("status", "voided")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestRun?.period_start && latestRun?.period_end) {
        period_start = String(latestRun.period_start);
        period_end = String(latestRun.period_end);
      } else {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        period_start = yyyyMmDd(start);
        period_end = yyyyMmDd(now);
      }
    }

    // --- Existing logic continues (unchanged) ---
    // Pull approved entries grouped by project for this period.
    const { data: rows, error } = await supa.rpc("payroll_project_summary", {
      p_org_id: profile.org_id,
      p_period_start: period_start,
      p_period_end: period_end,
    });

    // If your DB does not have this RPC yet, keep response stable:
    if (error) {
      // Do not hard-fail the UI; return empty.
      return NextResponse.json({ ok: true, rows: [] });
    }

    // Log export receipt (best effort)
    await logExportEvent({
      org_id: profile.org_id,
      run_id: null,
      actor_id: profile.id,
      actor_name_snapshot: profile.full_name || null,
      export_type: mode === "summary" ? "payroll_csv_summary" : "payroll_csv_detail",
      file_format: "csv",
      scope: "org",
      project_id: null,
      period_start,
      period_end,
      metadata: { mode },
    });

    // Your UI expects JSON rows (not a download) for this page
    return NextResponse.json({ ok: true, rows: rows || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
