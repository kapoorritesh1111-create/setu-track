import { NextResponse } from "next/server";
import { requireManagerOrAdmin } from "../../../../lib/api/gates";
import { budgetRiskLevel } from "../../../../lib/domain/financial/overview";

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentMonthRange() {
  const now = new Date();
  return {
    start: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export async function GET(req: Request) {
  try {
    const gate = await requireManagerOrAdmin(req);
    if (!gate.ok) return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });

    const { supa, profile } = gate;
    const url = new URL(req.url);
    const start = url.searchParams.get("start") || currentMonthRange().start;
    const end = url.searchParams.get("end") || currentMonthRange().end;

    const [
      { data: entries, error: entriesErr },
      { data: contractors, error: contractorsErr },
      { data: runs, error: runsErr },
      { data: runEntries, error: runEntriesErr },
      { data: budgets, error: budgetsErr },
      { data: projects, error: projectsErr },
      { data: exportsHistory, error: exportsErr },
    ] = await Promise.all([
      supa
        .from("v_time_entries")
        .select("user_id,status,hours_worked,hourly_rate_snapshot,project_id,project_name,entry_date")
        .eq("org_id", profile.org_id)
        .gte("entry_date", start)
        .lte("entry_date", end),
      supa
        .from("profiles")
        .select("id,full_name")
        .eq("org_id", profile.org_id)
        .eq("role", "contractor")
        .eq("is_active", true),
      supa
        .from("payroll_runs")
        .select("id,period_start,period_end,status,total_amount,total_hours,currency,created_at,paid_at")
        .eq("org_id", profile.org_id)
        .gte("period_start", start)
        .lte("period_end", end)
        .order("created_at", { ascending: false })
        .limit(12),
      supa
        .from("payroll_run_entries")
        .select("payroll_run_id,project_id,project_name_snapshot,contractor_id,contractor_name_snapshot,hours,amount")
        .eq("org_id", profile.org_id),
      supa
        .from("project_budgets")
        .select("project_id,budget_amount,billing_rate,currency,effective_from")
        .eq("org_id", profile.org_id)
        .order("effective_from", { ascending: false }),
      supa
        .from("projects")
        .select("id,name,is_active")
        .eq("org_id", profile.org_id)
        .order("name", { ascending: true }),
      supa
        .from("export_history")
        .select("id,export_type,exported_at,exported_by_name,file_format,label,project_name,payroll_run_status")
        .eq("org_id", profile.org_id)
        .order("exported_at", { ascending: false })
        .limit(8),
    ]);

    const firstErr = entriesErr || contractorsErr || runsErr || runEntriesErr || budgetsErr || projectsErr || exportsErr;
    if (firstErr) return NextResponse.json({ ok: false, error: firstErr.message }, { status: 400 });

    const contractorCount = (contractors || []).length;
    let hoursLogged = 0;
    let approvalsPending = 0;
    let approvedHours = 0;
    let payrollReady = 0;
    for (const row of (entries || []) as any[]) {
      const hours = Number(row.hours_worked || 0);
      const rate = Number(row.hourly_rate_snapshot || 0);
      hoursLogged += hours;
      if (row.status === "submitted") approvalsPending += 1;
      if (row.status === "approved") {
        approvedHours += hours;
        payrollReady += hours * rate;
      }
    }

    const latestBudgetByProject = new Map<string, any>();
    for (const budget of (budgets || []) as any[]) {
      if (!latestBudgetByProject.has(budget.project_id)) latestBudgetByProject.set(budget.project_id, budget);
    }

    const runIds = new Set(((runs || []) as any[]).map((run) => run.id));
    const projectMap = new Map<string, any>();
    for (const project of (projects || []) as any[]) projectMap.set(project.id, project);

    const byProject = new Map<string, { project_id: string; project_name: string; payroll_cost: number; hours: number; budget_amount: number; remaining_budget: number; currency: string; risk: string }>();
    const byContractor = new Map<string, { contractor_id: string; contractor_name: string; amount: number; hours: number }>();
    for (const row of ((runEntries || []) as any[]).filter((item) => item.payroll_run_id && runIds.has(item.payroll_run_id))) {
      const amount = Number(row.amount || 0);
      const hours = Number(row.hours || 0);
      const budget = latestBudgetByProject.get(row.project_id);
      const budgetAmount = Number(budget?.budget_amount || 0);
      const projectName = row.project_name_snapshot || projectMap.get(row.project_id)?.name || "Untitled project";
      const current = byProject.get(row.project_id) || {
        project_id: row.project_id,
        project_name: projectName,
        payroll_cost: 0,
        hours: 0,
        budget_amount: budgetAmount,
        remaining_budget: budgetAmount,
        currency: budget?.currency || "USD",
        risk: "untracked",
      };
      current.payroll_cost += amount;
      current.hours += hours;
      current.remaining_budget = current.budget_amount - current.payroll_cost;
      current.risk = budgetRiskLevel(current.remaining_budget, current.budget_amount);
      byProject.set(row.project_id, current);

      const contractor = byContractor.get(row.contractor_id) || {
        contractor_id: row.contractor_id,
        contractor_name: row.contractor_name_snapshot || "Unknown contractor",
        amount: 0,
        hours: 0,
      };
      contractor.amount += amount;
      contractor.hours += hours;
      byContractor.set(row.contractor_id, contractor);
    }

    const activity = [
      ...((runs || []) as any[]).slice(0, 4).map((run) => ({
        id: `run:${run.id}`,
        type: "payroll_run",
        title: `Payroll ${String(run.status || "locked").toLowerCase() === "paid" ? "paid" : "closed"}`,
        meta: `${run.period_start} → ${run.period_end}`,
        at: run.paid_at || run.created_at,
      })),
      ...((exportsHistory || []) as any[]).slice(0, 4).map((item) => ({
        id: `export:${item.id}`,
        type: "export",
        title: item.label || item.export_type || "Export created",
        meta: `${String(item.file_format || "file").toUpperCase()}${item.project_name ? ` • ${item.project_name}` : ""}`,
        at: item.exported_at,
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6);

    return NextResponse.json({
      ok: true,
      range: { start, end },
      metrics: {
        active_contractors: contractorCount,
        hours_logged: hoursLogged,
        approved_hours: approvedHours,
        approvals_pending: approvalsPending,
        payroll_ready: payrollReady,
        current_payroll_total: Number(((runs || []) as any[]).reduce((sum, run) => sum + Number(run.total_amount || 0), 0)),
        currency: ((runs || []) as any[])[0]?.currency || "USD",
      },
      watchlist: Array.from(byProject.values()).sort((a, b) => b.payroll_cost - a.payroll_cost).slice(0, 5),
      contractor_cost_distribution: Array.from(byContractor.values()).sort((a, b) => b.amount - a.amount).slice(0, 5),
      recent_activity: activity,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
