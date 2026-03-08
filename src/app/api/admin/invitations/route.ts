// src/app/api/admin/invitations/route.ts
import { NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";
import { buildAuthCallbackUrl } from "../../../../lib/appUrl";

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false as const, status: 401, error: "Missing auth token" };

  const supa = supabaseService();

  const { data: caller, error: callerErr } = await supa.auth.getUser(token);
  if (callerErr || !caller?.user) {
    return { ok: false as const, status: 401, error: callerErr?.message || "Unauthorized" };
  }

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

    const { supa } = gate;

    const { data, error } = await supa.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const users = (data?.users ?? []).map((u: any) => {
      const email = u.email || "";
      const created_at = u.created_at || null;
      const last_sign_in_at = u.last_sign_in_at || null;
      const email_confirmed_at = u.email_confirmed_at || u.confirmed_at || null;

      // ✅ More reliable: if never signed in AND not confirmed -> pending
      const status = last_sign_in_at || email_confirmed_at ? "active" : "pending";

      return {
        id: u.id,
        email,
        status,
        created_at,
        last_sign_in_at,
        email_confirmed_at,
      };
    });

    // Pending first, then newest created
    users.sort((a: any, b: any) => {
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });

    return NextResponse.json({ ok: true, users });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const { supa } = gate;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ ok: false, error: "Email required" }, { status: 400 });

    const redirectTo = buildAuthCallbackUrl();

    const { data, error } = await supa.auth.admin.generateLink({
      type: "invite",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    } as any);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const action_link = (data as any)?.properties?.action_link || (data as any)?.action_link || null;
    if (!action_link) return NextResponse.json({ ok: false, error: "Invite link not available" }, { status: 400 });

    return NextResponse.json({ ok: true, action_link });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const { supa, org_id } = gate;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

    const user_id = String(body.user_id || "").trim();
    if (!user_id) return NextResponse.json({ ok: false, error: "user_id required" }, { status: 400 });

    await supa.from("project_members").delete().eq("org_id", org_id).eq("user_id", user_id);
    await supa.from("time_entries").delete().eq("org_id", org_id).eq("user_id", user_id);
    await supa.from("profiles").delete().eq("org_id", org_id).eq("id", user_id);

    const { error } = await supa.auth.admin.deleteUser(user_id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
