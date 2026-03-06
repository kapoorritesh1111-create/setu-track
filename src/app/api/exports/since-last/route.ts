import { NextResponse } from "next/server";
import { requireManagerOrAdmin } from "../../../../lib/api/gates";

type AggRow = {
  contractor_id: string;
  contractor_name: string;
  hours: number;
  pay: number;
};

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function key(id: string) {
  return String(id || "");
}

function buildAggMap(rows: AggRow[]) {
  const m = new Map<string, AggRow>();
  for (const r of rows) {
    m.set(key(r.contractor_id), r);
  }
  return m;
}

function diffAgg(current: AggRow[], previous: AggRow[]) {
  const cm = buildAggMap(current);
  const pm = buildAggMap(previous);
  const ids = new Set<string>([...cm.keys(), ...pm.keys()]);

  const out = [];
  let totalCurrH = 0, totalCurrP = 0, totalPrevH = 0, totalPrevP = 0;

  for (const id of ids) {
    const c = cm.get(id);
    const p = pm.get(id);
    const currH = num(c?.hours);
    const currP = num(c?.pay);
    const prevH = num(p?.hours);
    const prevP = num(p?.pay);

    totalCurrH += currH; totalCurrP += currP;
    totalPrevH += prevH; totalPrevP += prevP;

    out.push({
      contractor_id: id,
      contractor_name: (c?.contractor_name || p?.contractor_name || "Unknown"),
      current: { hours: currH, pay: currP },
      previous: { hours: prevH, pay: prevP },
      delta: { hours: currH - prevH, pay: currP - prevP },
    });
  }

  out.sort((a, b) => Math.abs(b.delta.pay) - Math.abs(a.delta.pay));

  return {
    rows: out,
    totals: {
      current: { hours: totalCurrH, pay: totalCurrP },
      previous: { hours: totalPrevH, pay: totalPrevP },
      delta: { hours: totalCurrH - totalPrevH, pay: totalCurrP - totalPrevP },
    },
  };
}

async function latestRunForPeriod(supa: any, orgId: string, periodStart: string, periodEnd: string) {
  const { data, error } = await supa
    .from("payroll_runs")
    .select("id, org_id, period_start, period_end, status, created_at, total_hours, total_amount, currency, paid_at, paid_by, paid_note")
    .eq("org_id", orgId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

async function resolveName(supa: any, orgId: string, userId?: string | null) {
  if (!userId) return null;
  const { data } = await supa
    .from("profiles")
    .select("full_name")
    .eq("org_id", orgId)
    .eq("id", userId)
    .maybeSingle();
  return (data as any)?.full_name || null;
}

async function aggOrgRunLines(supa: any, orgId: string, runId: string): Promise<AggRow[]> {
  const { data, error } = await supa
    .from("payroll_run_lines")
    .select("contractor_id, contractor_name_snapshot, hours, amount")
    .eq("org_id", orgId)
    .eq("payroll_run_id", runId)
    .limit(5000);

  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    contractor_id: r.contractor_id,
    contractor_name: r.contractor_name_snapshot || "Unknown",
    hours: num(r.hours),
    pay: num(r.amount),
  }));
}

async function aggProjectEntries(supa: any, orgId: string, runId: string, projectId: string): Promise<AggRow[]> {
  const { data, error } = await supa
    .from("payroll_run_entries")
    .select("contractor_id, contractor_name_snapshot, hours, amount")
    .eq("org_id", orgId)
    .eq("payroll_run_id", runId)
    .eq("project_id", projectId)
    .limit(20000);

  if (error) throw new Error(error.message);

  // Aggregate by contractor
  const m = new Map<string, AggRow>();
  for (const r of data || []) {
    const id = key(r.contractor_id);
    const prev = m.get(id) || {
      contractor_id: id,
      contractor_name: r.contractor_name_snapshot || "Unknown",
      hours: 0,
      pay: 0,
    };
    prev.hours += num(r.hours);
    prev.pay += num(r.amount);
    m.set(id, prev);
  }
  return [...m.values()];
}

export async function GET(req: Request) {
  try {
    const gate = await requireManagerOrAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const { supa, profile } = gate;

    const url = new URL(req.url);
    const period_start = url.searchParams.get("period_start") || "";
    const period_end = url.searchParams.get("period_end") || "";
    const project_id = url.searchParams.get("project_id"); // optional

    if (!period_start || !period_end) {
      return NextResponse.json({ ok: false, error: "Missing period_start/period_end" }, { status: 400 });
    }

    const currentRun = await latestRunForPeriod(supa, profile.org_id, period_start, period_end);
    if (!currentRun) {
      return NextResponse.json({ ok: false, error: "No payroll run found for this period" }, { status: 404 });
    }

    const paid_by_name = await resolveName(supa, profile.org_id, (currentRun as any)?.paid_by);
    (currentRun as any).paid_by_name = paid_by_name;

    // Find the most recent official export for this period (+ optional project scope).
    // We intentionally allow receipts from prior runs so we can diff current run vs last exported run.
    let q = supa
      .from("export_events")
      .select("id, created_at, export_type, file_format, scope, project_id, actor_id, actor_name_snapshot, run_id, metadata")
      .eq("org_id", profile.org_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end);

    if (project_id) q = q.eq("project_id", project_id);

    const { data: lastExport, error: expErr } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (expErr) return NextResponse.json({ ok: false, error: expErr.message }, { status: 400 });

    if (!lastExport) {
      return NextResponse.json(
        {
        ok: true,
        has_export: false,
        no_changes: false,
        current_run: currentRun,
        last_export: null,
        diff: null,
      },
      { status: 200, headers: { "cache-control": "private, max-age=10" } }
      );
    }

    const exportedRunId = lastExport.run_id;
    if (!exportedRunId) {
      return NextResponse.json(
        {
        ok: true,
        has_export: true,
        no_changes: false,
        current_run: currentRun,
        last_export: lastExport,
        diff: null,
        note: "Last export receipt missing run_id; cannot compute diff.",
      },
      { status: 200, headers: { "cache-control": "private, max-age=10" } }
      );
    }

    if (exportedRunId === currentRun.id) {
      return NextResponse.json(
        {
        ok: true,
        has_export: true,
        no_changes: true,
        current_run: currentRun,
        last_export: lastExport,
        diff: {
          rows: [],
          totals: {
            current: { hours: num(currentRun.total_hours), pay: num(currentRun.total_amount) },
            previous: { hours: num(currentRun.total_hours), pay: num(currentRun.total_amount) },
            delta: { hours: 0, pay: 0 },
          },
        },
        note: "No changes since last official export (same payroll run snapshot).",
      },
      { status: 200, headers: { "cache-control": "private, max-age=10" } }
      );
    }

    // Compute snapshot diff between current run and exported run
    const [currAgg, prevAgg] = await Promise.all([
      project_id ? aggProjectEntries(supa, profile.org_id, currentRun.id, project_id) : aggOrgRunLines(supa, profile.org_id, currentRun.id),
      project_id ? aggProjectEntries(supa, profile.org_id, exportedRunId, project_id) : aggOrgRunLines(supa, profile.org_id, exportedRunId),
    ]);

    const diff = diffAgg(currAgg, prevAgg);

    const no_changes = num(diff?.totals?.delta?.hours) === 0 && num(diff?.totals?.delta?.pay) === 0;

    return NextResponse.json(
      {
      ok: true,
      has_export: true,
      no_changes,
      scope: project_id ? "project" : "period",
      project_id: project_id || null,
      current_run: currentRun,
      exported_run_id: exportedRunId,
      last_export: lastExport,
      diff,
    },
      { status: 200, headers: { "cache-control": "private, max-age=10" } }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
