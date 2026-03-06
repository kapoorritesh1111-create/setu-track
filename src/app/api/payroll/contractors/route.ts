import { NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";

async function requireManagerOrAdmin(req: Request) {
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
  if (!prof?.org_id) return { ok: false as const, status: 403, error: "No org" };
  if (prof.role !== "admin" && prof.role !== "manager") {
    return { ok: false as const, status: 403, error: "Manager/Admin only" };
  }

  return { ok: true as const, supa, profile: prof };
}

export async function GET(req: Request) {
  try {
    const gate = await requireManagerOrAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const { supa, profile } = gate;

    // Return selectable people for payroll filters.
    // Admin: contractors + admins (so admin can report on their own time)
    // Manager: direct-report contractors + manager (self)
    const isAdmin = profile.role === "admin";
    let q = supa
      .from("profiles")
      .select("id, full_name, role, is_active, manager_id")
      .eq("org_id", profile.org_id)
      .eq("is_active", true);

    if (isAdmin) {
      q = q.in("role", ["contractor", "admin"]);
    } else {
      // manager
      q = q.or(`and(role.eq.contractor,manager_id.eq.${profile.id}),and(id.eq.${profile.id})`);
    }

    const { data, error } = await q
      .order("role", { ascending: false })
      .order("full_name", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, contractors: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
