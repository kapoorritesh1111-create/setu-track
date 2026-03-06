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

    const body = await req.json();
    const period_start = body?.period_start as string | undefined;
    const period_end = body?.period_end as string | undefined;

    if (!period_start || !period_end) {
      return NextResponse.json({ ok: false, error: "Missing period_start/period_end" }, { status: 400 });
    }

    const { supa } = gate;

    // Create a reproducible payroll run + lock the period
    const { data, error } = await supa.rpc("close_payroll_period", {
      p_period_start: period_start,
      p_period_end: period_end,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, run_id: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
