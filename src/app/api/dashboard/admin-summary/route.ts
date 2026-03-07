import { NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false as const, status: 401, error: "Missing auth token" };

  const supa = supabaseService();
  const { data: caller, error: callerErr } = await supa.auth.getUser(token);
  if (callerErr || !caller?.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  const { data: prof, error: profErr } = await supa
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", caller.user.id)
    .maybeSingle();

  if (profErr) return { ok: false as const, status: 400, error: profErr.message };
  if (!prof?.org_id || prof.role !== "admin") return { ok: false as const, status: 403, error: "Admin only" };

  return { ok: true as const, supa, profile: prof };
}

export async function POST(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const body = await req.json().catch(() => ({}));
    const period_start = String(body?.period_start || "");
    const period_end = String(body?.period_end || "");
    if (!period_start || !period_end) {
      return NextResponse.json({ ok: false, error: "period_start and period_end are required" }, { status: 400 });
    }

    const { supa, profile } = gate;

    const [
      { data: run, error: runErr },
      { data: entries, error: entriesErr },
      { data: contractors, error: contractorsErr },
    ] = await Promise.all([
      supa
        .from("payroll_runs")
        .select("id,status,total_hours,total_amount,currency,created_at,paid_at,period_start,period_end")
        .eq("org_id", profile.org_id)
        .eq("period_start", period_start)
        .eq("period_end", period_end)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supa
        .from("v_time_entries")
        .select("user_id,status,hours_worked,hourly_rate_snapshot,entry_date")
        .eq("org_id", profile.org_id)
        .gte("entry_date", period_start)
        .lte("entry_date", period_end),
      supa
        .from("profiles")
        .select("id")
        .eq("org_id", profile.org_id)
        .eq("role", "contractor")
        .eq("is_active", true),
    ]);

    if (runErr || entriesErr || contractorsErr) {
      const error = runErr || entriesErr || contractorsErr;
      return NextResponse.json({ ok: false, error: error?.message || "Failed to load summary" }, { status: 400 });
    }

    let approvedHours = 0;
    let approvedAmount = 0;
    let pendingEntries = 0;

    for (const row of (entries || []) as any[]) {
      const hours = Number(row.hours_worked ?? 0);
      const rate = Number(row.hourly_rate_snapshot ?? 0);
      if (row.status === "approved") {
        approvedHours += hours;
        approvedAmount += hours * rate;
      }
      if (row.status === "submitted") pendingEntries += 1;
    }

    const summary = {
      total_hours: Number(run?.total_hours ?? approvedHours ?? 0),
      total_amount: Number(run?.total_amount ?? approvedAmount ?? 0),
      pending_entries: pendingEntries,
      active_contractors: Number((contractors || []).length || 0),
      payroll_state: run?.status || "open",
      payroll_run_id: run?.id || null,
      closed_at: run?.created_at || null,
      paid_at: run?.paid_at || null,
      currency: run?.currency || "USD",
    };

    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
