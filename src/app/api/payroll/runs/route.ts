import { NextResponse } from "next/server";
import { requireManagerOrAdmin } from "../../../../lib/api/gates";

export async function GET(req: Request) {
  try {
    const gate = await requireManagerOrAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const { supa, profile } = gate;

    const { data, error } = await supa
      .from("payroll_runs")
      .select("id, period_start, period_end, status, created_at, total_hours, total_amount, currency, paid_at, paid_by, paid_note")
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const paidByIds = Array.from(
      new Set((data || []).map((r: any) => r.paid_by).filter(Boolean))
    ) as string[];

    let paidByMap = new Map<string, string>();
    if (paidByIds.length) {
      const { data: names } = await supa
        .from("profiles")
        .select("id, full_name")
        .eq("org_id", profile.org_id)
        .in("id", paidByIds);
      for (const n of (names || []) as any[]) paidByMap.set(n.id, n.full_name || n.id);
    }

    const runs = (data || []).map((r: any) => ({
      ...r,
      paid_by_name: r.paid_by ? (paidByMap.get(r.paid_by) || null) : null,
    }));

    return NextResponse.json({ ok: true, runs }, { status: 200, headers: { "cache-control": "private, max-age=10" } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
