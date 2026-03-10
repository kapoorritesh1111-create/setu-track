export type OpsSeverity = "critical" | "high" | "medium" | "low" | "info";

export type ContractorLite = {
  id: string;
  full_name?: string | null;
  hourly_rate?: number | null;
  is_active?: boolean | null;
};

export type EntryLite = {
  user_id: string;
  full_name?: string | null;
  entry_date: string;
  status?: string | null;
  hours_worked?: number | null;
  hourly_rate_snapshot?: number | null;
  project_id?: string | null;
  project_name?: string | null;
};

export type ProjectBudgetLite = {
  id: string;
  name?: string | null;
  budget_amount?: number | null;
  budget_hours?: number | null;
  budget_currency?: string | null;
};

export type OpsNotification = {
  id: string;
  area: "payroll" | "approvals" | "projects" | "people" | "exports" | "rates";
  severity: OpsSeverity;
  title: string;
  body: string;
  href: string;
  metric: string;
};

export function getMissingTimesheetUsers(contractors: ContractorLite[], rows: EntryLite[]) {
  const present = new Set(rows.map((row) => row.user_id).filter(Boolean));
  return contractors.filter((contractor) => (contractor.is_active ?? true) && contractor.id && !present.has(contractor.id));
}

export function getMissingRateUsers(contractors: ContractorLite[], rows: EntryLite[]) {
  const rowMap = new Map<string, boolean>();
  for (const row of rows) {
    if (!row.user_id) continue;
    const hasRate = Number(row.hourly_rate_snapshot || 0) > 0;
    rowMap.set(row.user_id, (rowMap.get(row.user_id) || false) || hasRate);
  }
  return contractors.filter((contractor) => {
    const hasDefaultRate = Number(contractor.hourly_rate || 0) > 0;
    const hasRowRate = rowMap.get(contractor.id) || false;
    return !hasDefaultRate && !hasRowRate;
  });
}

export function getPendingForecast(rows: EntryLite[]) {
  return rows
    .filter((row) => row.status === "submitted")
    .reduce((sum, row) => sum + Number(row.hours_worked || 0) * Number(row.hourly_rate_snapshot || 0), 0);
}

export function getSubmittedHours(rows: EntryLite[]) {
  return rows.filter((row) => row.status === "submitted").reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
}

export function getStaleApprovals(rows: EntryLite[], staleDays = 2) {
  const now = Date.now();
  return rows.filter((row) => row.status === "submitted" && ((now - new Date(`${row.entry_date}T00:00:00`).getTime()) / 86400000) > staleDays);
}

export function getOvertimeRows(rows: EntryLite[], hoursThreshold = 10) {
  const byDay = new Map<string, { user_id: string; full_name: string; entry_date: string; hours: number }>();
  for (const row of rows) {
    const key = `${row.user_id}__${row.entry_date}`;
    const current = byDay.get(key) || { user_id: row.user_id, full_name: row.full_name || "Contractor", entry_date: row.entry_date, hours: 0 };
    current.hours += Number(row.hours_worked || 0);
    byDay.set(key, current);
  }
  return Array.from(byDay.values()).filter((item) => item.hours > hoursThreshold);
}

export function getProjectRiskSummary(rows: EntryLite[], budgets: ProjectBudgetLite[]) {
  const budgetMap = new Map(budgets.map((project) => [project.id, project]));
  const projectMap = new Map<string, {
    id: string;
    name: string;
    cost: number;
    hours: number;
    pending: number;
    budgetAmount: number;
    budgetHours: number;
    currency: string;
    state: "no_budget" | "within" | "near" | "over";
  }>();

  for (const row of rows) {
    const key = row.project_id || row.project_name || "unassigned";
    const budget = row.project_id ? budgetMap.get(row.project_id) : null;
    const current = projectMap.get(key) || {
      id: key,
      name: row.project_name || budget?.name || "Unassigned",
      cost: 0,
      hours: 0,
      pending: 0,
      budgetAmount: Number(budget?.budget_amount || 0),
      budgetHours: Number(budget?.budget_hours || 0),
      currency: budget?.budget_currency || "USD",
      state: "no_budget" as const,
    };
    current.cost += Number(row.hours_worked || 0) * Number(row.hourly_rate_snapshot || 0);
    current.hours += Number(row.hours_worked || 0);
    if (row.status === "submitted") current.pending += 1;
    const amountRatio = current.budgetAmount > 0 ? current.cost / current.budgetAmount : 0;
    const hoursRatio = current.budgetHours > 0 ? current.hours / current.budgetHours : 0;
    const ratio = Math.max(amountRatio, hoursRatio);
    current.state = current.budgetAmount <= 0 && current.budgetHours <= 0 ? "no_budget" : ratio >= 1 ? "over" : ratio >= 0.8 ? "near" : "within";
    projectMap.set(key, current);
  }

  const projects = Array.from(projectMap.values()).sort((a, b) => b.cost - a.cost);
  return {
    projects,
    over: projects.filter((project) => project.state === "over"),
    near: projects.filter((project) => project.state === "near"),
    noBudget: projects.filter((project) => project.state === "no_budget"),
  };
}

export function buildOpsNotifications(args: {
  contractors: ContractorLite[];
  rows: EntryLite[];
  budgets: ProjectBudgetLite[];
  periodLocked?: boolean;
  exportsCount?: number;
}) {
  const { contractors, rows, budgets, periodLocked = false, exportsCount = 0 } = args;
  const missingTimesheets = getMissingTimesheetUsers(contractors, rows);
  const missingRates = getMissingRateUsers(contractors, rows);
  const staleApprovals = getStaleApprovals(rows);
  const overtimeRows = getOvertimeRows(rows);
  const pendingForecast = getPendingForecast(rows);
  const submittedHours = getSubmittedHours(rows);
  const projectRisk = getProjectRiskSummary(rows, budgets);

  const notifications: OpsNotification[] = [];

  if (staleApprovals.length) {
    notifications.push({
      id: "stale-approvals",
      area: "approvals",
      severity: staleApprovals.length >= 5 ? "critical" : "high",
      title: "Approval blocker queue needs attention",
      body: `${staleApprovals.length} submitted timesheet items are aging past SLA and can delay payroll close.`,
      href: "/approvals?scope=all",
      metric: `${staleApprovals.length} stale`,
    });
  }

  if (missingTimesheets.length) {
    notifications.push({
      id: "missing-timesheets",
      area: "people",
      severity: missingTimesheets.length >= 3 ? "high" : "medium",
      title: "Missing timesheet reminders are ready",
      body: `${missingTimesheets.length} active contractors have no entries in the current range.`,
      href: "/profiles",
      metric: `${missingTimesheets.length} missing`,
    });
  }

  if (missingRates.length) {
    notifications.push({
      id: "missing-rates",
      area: "rates",
      severity: missingRates.length >= 2 ? "high" : "medium",
      title: "Contractor rate audit found gaps",
      body: `${missingRates.length} contractors still have no usable rate baseline for payroll forecasting.`,
      href: "/profiles",
      metric: `${missingRates.length} gaps`,
    });
  }

  if (projectRisk.over.length || projectRisk.near.length) {
    notifications.push({
      id: "project-budget-risk",
      area: "projects",
      severity: projectRisk.over.length ? "critical" : "high",
      title: "Project budget risk alert",
      body: `${projectRisk.over.length} projects are over budget and ${projectRisk.near.length} are nearing budget thresholds.`,
      href: "/projects?healthFilter=over",
      metric: `${projectRisk.over.length + projectRisk.near.length} at risk`,
    });
  }

  if (overtimeRows.length) {
    notifications.push({
      id: "overtime-anomalies",
      area: "approvals",
      severity: "medium",
      title: "Long-hour anomalies detected",
      body: `${overtimeRows.length} day-level entries exceed the hours threshold and should be reviewed before payroll.`,
      href: "/approvals?scope=all",
      metric: `${overtimeRows.length} anomalies`,
    });
  }

  if (periodLocked && exportsCount === 0) {
    notifications.push({
      id: "export-readiness",
      area: "exports",
      severity: "high",
      title: "Locked payroll is waiting for export",
      body: "This pay period is locked, but no official export receipt exists yet for finance handoff.",
      href: "/admin/exports",
      metric: "Ready to export",
    });
  } else if (!periodLocked && (submittedHours > 0 || pendingForecast > 0)) {
    notifications.push({
      id: "forecast-open",
      area: "payroll",
      severity: "info",
      title: "Payroll forecast is still moving",
      body: `${submittedHours.toFixed(2)} submitted hours are still open, representing additional forecasted payroll exposure.`,
      href: "/reports/payroll",
      metric: `${pendingForecast.toFixed(2)} forecast`,
    });
  }

  return notifications.sort((a, b) => severityScore(b.severity) - severityScore(a.severity));
}

export function severityScore(severity: OpsSeverity) {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
}

export function severityLabel(severity: OpsSeverity) {
  if (severity === "critical") return "Critical";
  if (severity === "high") return "High";
  if (severity === "medium") return "Medium";
  if (severity === "low") return "Low";
  return "Info";
}


export function summarizeApprovalSignals(args: { contractors: ContractorLite[]; rows: EntryLite[]; missingNotesCount?: number; }) {
  const contractors = args.contractors || [];
  const rows = args.rows || [];
  const staleRows = getStaleApprovals(rows);
  const overtimeRows = getOvertimeRows(rows);
  const missingTimesheets = getMissingTimesheetUsers(contractors, rows);
  const submittedHours = rows.filter((row) => row.status === "submitted").reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
  const missingRates = getMissingRateUsers(contractors, rows);
  const missingNotesCount = Number(args.missingNotesCount || 0);
  return {
    staleRows,
    overtimeRows,
    missingTimesheets,
    missingRates,
    submittedHours,
    missingNotesCount,
    blockerCount: staleRows.length + overtimeRows.length + missingTimesheets.length,
  };
}
