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
    const period_start = body?.period_start as string | undefined;
    const period_end = body?.period_end as string | undefined;
    const force = !!body?.force;

    if (!period_start || !period_end) {
      return NextResponse.json({ ok: false, error: "Missing period_start/period_end" }, { status: 400 });
    }

    const { supa, profile } = gate;

    // Safety: if a payroll run exists for this period, block unless force=true.
    const { count: runCount, error: runErr } = await supa
      .from("payroll_runs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", profile.org_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .neq("status", "voided");

    if (runErr) return NextResponse.json({ ok: false, error: runErr.message }, { status: 400 });

    if ((runCount ?? 0) > 0 && !force) {
      return NextResponse.json(
        {
          ok: false,
          error: `Payroll run exists for ${period_start} → ${period_end} (${runCount}). Unlock requires force.`,
          requires_force: true,
          run_count: runCount ?? 0,
        },
        { status: 409 }
      );
    }

    // Unlock the pay period row
    const { error: updErr } = await supa
      .from("pay_periods")
      .update({ locked: false, locked_at: null, locked_by: null })
      .eq("org_id", profile.org_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end);

    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
