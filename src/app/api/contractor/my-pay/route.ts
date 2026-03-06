import { NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";

function monthEndISO(startISO: string) {
  // startISO: YYYY-MM-DD (assumed day 01)
  const [y, m] = startISO.split("-").map((x) => Number(x));
  const end = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day of month
  const yyyy = end.getUTCFullYear();
  const mm = String(end.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(end.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function requireUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false as const, status: 401, error: "Missing auth token" };

  const supa = supabaseService();

  const { data: caller, error: callerErr } = await supa.auth.getUser(token);
  if (callerErr || !caller?.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  const { data: prof, error: profErr } = await supa
    .from("profiles")
    .select("id, org_id, role, full_name, hourly_rate")
    .eq("id", caller.user.id)
    .maybeSingle();

  if (profErr) return { ok: false as const, status: 400, error: profErr.message };
  if (!prof?.org_id) return { ok: false as const, status: 403, error: "Profile/org missing" };

  return { ok: true as const, supa, profile: prof };
}

export async function POST(req: Request) {
  try {
    const gate = await requireUser(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const body = await req.json().catch(() => ({}));
    const period_start = String(body?.period_start || "");
    const period_end = String(body?.period_end || "") || (period_start ? monthEndISO(period_start) : "");

    if (!period_start || !period_end) {
      return NextResponse.json({ ok: false, error: "period_start and period_end are required" }, { status: 400 });
    }

    const { supa, profile } = gate;
    const user_id = profile.id;
    const org_id = profile.org_id;

    // Current period entries (from view for convenience)
    const { data: ents, error: entErr } = await supa
      .from("v_time_entries")
      .select("id, entry_date, status, hours_worked, project_id, project_name, hourly_rate_snapshot")
      .eq("org_id", org_id)
      .eq("user_id", user_id)
      .gte("entry_date", period_start)
      .lte("entry_date", period_end)
      .order("entry_date", { ascending: false });

    if (entErr) return NextResponse.json({ ok: false, error: entErr.message }, { status: 400 });

    const entries = (ents || []) as any[];

    const totals = entries.reduce(
      (acc, r) => {
        const h = Number(r.hours_worked || 0);
        const rate = Number(r.hourly_rate_snapshot || profile.hourly_rate || 0);
        const amt = h * rate;
        acc.all_hours += h;
        if (r.status === "approved") {
          acc.approved_hours += h;
          acc.approved_amount += amt;
        } else {
          acc.pending_hours += h;
          acc.pending_amount += amt;
          acc.pending_count += 1;
        }
        return acc;
      },
      { all_hours: 0, approved_hours: 0, approved_amount: 0, pending_hours: 0, pending_amount: 0, pending_count: 0 }
    );

    const pending_entries = entries
      .filter((r) => r.status !== "approved")
      .slice(0, 20);

    // Last closed payroll run line for this contractor (latest closed run in org)
    const { data: runs, error: runErr } = await supa
      .from("payroll_runs")
      .select("id, period_start, period_end, currency, created_at, status")
      .eq("org_id", org_id)
      .eq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(12);

    if (runErr) return NextResponse.json({ ok: false, error: runErr.message }, { status: 400 });

    const runList = (runs || []) as any[];
    const runIds = runList.map((r) => r.id);

    let payout_history: any[] = [];
    let last_closed: any = null;

    if (runIds.length) {
      const { data: lines, error: lineErr } = await supa
        .from("payroll_run_lines")
        .select("id, payroll_run_id, contractor_id, contractor_name, total_hours, total_amount, currency")
        .eq("contractor_id", user_id)
        .in("payroll_run_id", runIds);

      if (lineErr) return NextResponse.json({ ok: false, error: lineErr.message }, { status: 400 });

      const lineList = (lines || []) as any[];
      const runMap: Record<string, any> = {};
      for (const r of runList) runMap[r.id] = r;

      payout_history = lineList
        .map((l) => ({
          ...l,
          period_start: runMap[l.payroll_run_id]?.period_start,
          period_end: runMap[l.payroll_run_id]?.period_end,
          created_at: runMap[l.payroll_run_id]?.created_at,
          status: runMap[l.payroll_run_id]?.status,
        }))
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
        .slice(0, 6);

      last_closed = payout_history.length ? payout_history[0] : null;
    }

    return NextResponse.json({
      ok: true,
      period_start,
      period_end,
      profile: { id: profile.id, full_name: profile.full_name, role: profile.role, hourly_rate: profile.hourly_rate },
      totals,
      pending_entries,
      last_closed,
      payout_history,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
