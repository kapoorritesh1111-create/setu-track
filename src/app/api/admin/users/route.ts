import { NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";

type Role = "admin" | "manager" | "contractor";

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false as const, status: 401, error: "Missing auth token" };

  const supa = supabaseService();

  const { data: caller, error: callerErr } = await supa.auth.getUser(token);
  if (callerErr || !caller?.user) return { ok: false as const, status: 401, error: "Unauthorized" };

  const { data: callerProf, error: callerProfErr } = await supa
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", caller.user.id)
    .maybeSingle();

  if (callerProfErr) return { ok: false as const, status: 400, error: callerProfErr.message };
  if (!callerProf?.org_id || callerProf.role !== "admin") {
    return { ok: false as const, status: 403, error: "Admin only" };
  }

  return { ok: true as const, supa, org_id: callerProf.org_id };
}

export async function GET(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const { supa, org_id } = gate;

    // 1) Profiles for org
    const { data: profs, error: profErr } = await supa
      .from("profiles")
      .select("id, full_name, role, manager_id, hourly_rate, is_active, created_at")
      .eq("org_id", org_id);

    if (profErr) return NextResponse.json({ ok: false, error: profErr.message }, { status: 400 });

    const profById = new Map<string, any>();
    (profs ?? []).forEach((p: any) => profById.set(p.id, p));

    // 2) Auth users (email / last sign-in)
    const { data: authList, error: listErr } = await supa.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) return NextResponse.json({ ok: false, error: listErr.message }, { status: 400 });

    const authById = new Map<string, any>();
    (authList?.users ?? []).forEach((u: any) => authById.set(u.id, u));

    // 3) Merge (only users that have a profile in this org)
    const merged = (profs ?? []).map((p: any) => {
      const au = authById.get(p.id);
      return {
        id: p.id,
        email: au?.email ?? null,
        last_sign_in_at: au?.last_sign_in_at ?? null,
        created_at: p.created_at ?? au?.created_at ?? null,
        full_name: p.full_name ?? null,
        role: p.role as Role,
        manager_id: p.manager_id ?? null,
        hourly_rate: p.hourly_rate ?? 0,
        is_active: !!p.is_active,
      };
    });

    // sort: active first, then name/email
    merged.sort((a: any, b: any) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      const an = (a.full_name || a.email || "").toLowerCase();
      const bn = (b.full_name || b.email || "").toLowerCase();
      return an.localeCompare(bn);
    });

    return NextResponse.json({ ok: true, users: merged });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
