import { NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";

async function requireOrgMember(req: Request) {
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

  return { ok: true as const, supa, profile: prof };
}

export async function GET(req: Request) {
  try {
    const gate = await requireOrgMember(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const url = new URL(req.url);
    const period_start = url.searchParams.get("period_start");
    const period_end = url.searchParams.get("period_end");
    if (!period_start || !period_end) return NextResponse.json({ ok: false, error: "Missing params" }, { status: 400 });

    const { supa, profile } = gate;

    const { data, error } = await supa
      .from("pay_periods")
      .select("locked, locked_at, locked_by")
      .eq("org_id", profile.org_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    let locked_by_name: string | null = null;
    if (data?.locked_by) {
      const { data: p } = await supa
        .from("profiles")
        .select("full_name")
        .eq("id", data.locked_by)
        .maybeSingle();
      locked_by_name = (p?.full_name as string) || null;
    }

    return NextResponse.json({
      ok: true,
      locked: !!data?.locked,
      locked_at: data?.locked_at ?? null,
      locked_by: data?.locked_by ?? null,
      locked_by_name,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
