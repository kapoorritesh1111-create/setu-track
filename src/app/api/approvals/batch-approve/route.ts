import { NextResponse } from "next/server";
import { supabaseService } from "../../../../lib/supabaseServer";

type Item = { user_id: string; week_start: string; week_end: string };

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
  if (!prof?.org_id) return { ok: false as const, status: 403, error: "Profile/org missing" };

  const role = String(prof.role || "");
  if (role !== "admin" && role !== "manager") return { ok: false as const, status: 403, error: "Admins/managers only" };

  return { ok: true as const, supa, profile: prof };
}

export async function POST(req: Request) {
  try {
    const gate = await requireManagerOrAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const { supa, profile } = gate;

    const body = await req.json().catch(() => ({}));
    const items = (body?.items || []) as Item[];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ ok: false, error: "items[] is required" }, { status: 400 });
    }
    if (items.length > 50) {
      return NextResponse.json({ ok: false, error: "Too many items (max 50)" }, { status: 400 });
    }

    // Validate manager scope
    if (profile.role === "manager") {
      const userIds = Array.from(new Set(items.map((i) => i.user_id)));
      const { data: reports, error: repErr } = await supa
        .from("profiles")
        .select("id, manager_id")
        .eq("org_id", profile.org_id)
        .in("id", userIds);

      if (repErr) return NextResponse.json({ ok: false, error: repErr.message }, { status: 400 });

      const allowed = new Set((reports || []).filter((r: any) => r.manager_id === profile.id).map((r: any) => r.id));
      for (const uid of userIds) {
        if (!allowed.has(uid)) {
          return NextResponse.json({ ok: false, error: "One or more users are not your direct reports" }, { status: 403 });
        }
      }
    }

    // Prevent approving locked pay periods
    const ranges = Array.from(new Set(items.map((i) => `${i.week_start}__${i.week_end}`)));
    if (ranges.length) {
      const { data: locks, error: lockErr } = await supa
        .from("pay_periods")
        .select("period_start, period_end, locked")
        .eq("org_id", profile.org_id)
        .in("period_start", ranges.map((r) => r.split("__")[0]))
        .in("period_end", ranges.map((r) => r.split("__")[1]));

      // If table exists but query fails, bubble it; if table doesn't exist, close flow still works (but Week 2 uses it)
      if (lockErr) {
        return NextResponse.json({ ok: false, error: lockErr.message }, { status: 400 });
      }
      const lockedSet = new Set((locks || []).filter((r: any) => r.locked).map((r: any) => `${r.period_start}__${r.period_end}`));
      for (const rk of ranges) {
        if (lockedSet.has(rk)) {
          return NextResponse.json({ ok: false, error: `Pay period locked: ${rk.replace("__", " → ")}` }, { status: 400 });
        }
      }
    }

    let totalApproved = 0;

    for (const it of items) {
      const { error, data } = await supa
        .from("time_entries")
        .update({ status: "approved" })
        .eq("org_id", profile.org_id)
        .eq("user_id", it.user_id)
        .gte("entry_date", it.week_start)
        .lte("entry_date", it.week_end)
        .eq("status", "submitted")
        .select("id");

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      totalApproved += (data?.length ?? 0);
    }

    return NextResponse.json({ ok: true, approved: totalApproved });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
