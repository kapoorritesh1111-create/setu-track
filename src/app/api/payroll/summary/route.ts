import { NextResponse } from "next/server";
import { requireManagerOrAdmin } from "../../../../lib/api/gates";

type Preset = "current_week" | "last_week" | "current_month" | "last_month" | "custom";
type ScopeMode = "closed_only" | "open_and_closed";

type PaymentStatus = "awaiting_export" | "awaiting_payment" | "paid";
type ExportStatus = "not_generated" | "generated" | "linked";

type Receipt = {
  id: string;
  org_id: string;
  created_at: string;
  created_by: string | null;
  actor_name: string | null;
  type: string;
  label: string | null;
  project_id: string | null;
  payroll_run_id: string | null;
  project_export_id?: string | null;
  payload_hash: string | null;
  diff_status: "same" | "changed" | "unknown" | null;
  meta: Record<string, unknown>;
};

type RegisterRow = {
  id: string;
  project_id: string;
  project_name: string;
  period_start: string;
  period_end: string;
  period_state: "closed" | "open";
  contractor_count: number;
  contractors: Array<{ id: string; name: string; role: string | null }>;
  total_hours: number;
  total_amount: number;
  currency: string;
  export_status: ExportStatus;
  payment_status: PaymentStatus;
  is_paid: boolean;
  paid_at: string | null;
  paid_by: string | null;
  paid_note: string | null;
  receipt_count: number;
  latest_project_export_id: string | null;
  receipts: Receipt[];
};

type RegisterRowInternal = RegisterRow & {
  _personTotals: Record<string, { hours: number; amount: number }>;
};

type ProjectSummaryRow = {
  id: string;
  project_id: string;
  project_name: string;
  period_count: number;
  contractor_count: number;
  total_hours: number;
  total_amount: number;
  currency: string;
  export_status: ExportStatus;
  payment_status: PaymentStatus;
  paid_amount: number;
  receipt_count: number;
  budget_hours: number | null;
  budget_amount: number | null;
  budget_currency: string;
  hours_variance: number | null;
  amount_variance: number | null;
};

type ContractorSummaryRow = {
  id: string;
  person_id: string;
  person_name: string;
  role: string | null;
  project_count: number;
  total_hours: number;
  total_amount: number;
  currency: string;
  export_status: ExportStatus;
  payment_status: PaymentStatus;
  paid_amount: number;
  related_project_ids: string[];
};

type TrendPoint = { key: string; label: string; amount: number; hours: number };

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeek(d: Date) {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function presetToRange(preset: Exclude<Preset, "custom">) {
  const now = new Date();

  if (preset === "current_week") {
    return { start: fmtDate(startOfWeek(now)), end: fmtDate(endOfWeek(now)) };
  }

  if (preset === "last_week") {
    const ref = new Date(now);
    ref.setDate(ref.getDate() - 7);
    return { start: fmtDate(startOfWeek(ref)), end: fmtDate(endOfWeek(ref)) };
  }

  if (preset === "current_month") {
    return { start: fmtDate(startOfMonth(now)), end: fmtDate(endOfMonth(now)) };
  }

  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    start: fmtDate(startOfMonth(prev)),
    end: fmtDate(endOfMonth(prev)),
  };
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && aEnd >= bStart;
}

function uniq<T>(values: T[]) {
  return Array.from(new Set(values));
}

function computeExportStatus(hasExport: boolean, receiptCount: number): ExportStatus {
  if (hasExport && receiptCount > 0) return "linked";
  if (hasExport) return "generated";
  return "not_generated";
}

function computePaymentStatus(hasExport: boolean, isPaid: boolean): PaymentStatus {
  if (!hasExport) return "awaiting_export";
  if (isPaid) return "paid";
  return "awaiting_payment";
}

function projectPeriodKey(projectId: string, periodStart: string, periodEnd: string) {
  return `${projectId}|${periodStart}|${periodEnd}`;
}

export async function GET(req: Request) {
  try {
    const gate = await requireManagerOrAdmin(req);
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
    }

    const { supa, profile } = gate;
    const url = new URL(req.url);

    const presetParam = url.searchParams.get("preset");
    const preset: Preset =
      presetParam === "current_week" ||
      presetParam === "last_week" ||
      presetParam === "current_month" ||
      presetParam === "last_month" ||
      presetParam === "custom"
        ? presetParam
        : "last_month";

    const scopeParam = url.searchParams.get("scope") || url.searchParams.get("period_scope");
    const scope: ScopeMode = scopeParam === "open_and_closed" ? "open_and_closed" : "closed_only";

    const projectFilter = (url.searchParams.get("project_id") || "").trim();
    const personFilter = (
      url.searchParams.get("person_id") ||
      url.searchParams.get("contractor_id") ||
      ""
    ).trim();
    const paymentFilter = (url.searchParams.get("payment_status") || "").trim();
    const exportFilter = (url.searchParams.get("export_status") || "").trim();
    const search = (url.searchParams.get("q") || "").trim().toLowerCase();

    let rangeStart = url.searchParams.get("start") || "";
    let rangeEnd = url.searchParams.get("end") || "";

    if (preset !== "custom") {
      const range = presetToRange(preset);
      rangeStart = range.start;
      rangeEnd = range.end;
    }

    if (!rangeStart || !rangeEnd) {
      const fallback = presetToRange("last_month");
      rangeStart = fallback.start;
      rangeEnd = fallback.end;
    }

    const isAdmin = profile.role === "admin";
    const isManager = profile.role === "manager";
    const actorId = profile.id;

    const { data: projectsRaw, error: projectsErr } = await supa
      .from("projects")
      .select("id,name,budget_hours,budget_amount,budget_currency")
      .eq("org_id", profile.org_id)
      .order("name", { ascending: true });

    if (projectsErr) {
      return NextResponse.json({ ok: false, error: projectsErr.message }, { status: 400 });
    }

    let visibleProjects = (projectsRaw || []) as Array<{ id: string; name: string | null }>;

    if (!isAdmin && isManager) {
      const { data: memberships, error: membershipsErr } = await supa
        .from("project_members")
        .select("project_id,user_id")
        .eq("org_id", profile.org_id)
        .eq("user_id", actorId);

      if (membershipsErr) {
        return NextResponse.json({ ok: false, error: membershipsErr.message }, { status: 400 });
      }

      const memberProjectIds = new Set(
        (memberships || []).map((m: any) => String(m.project_id || ""))
      );
      visibleProjects = visibleProjects.filter((project) => memberProjectIds.has(project.id));
    }

    const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));
    const projectNameMap = new Map(
      visibleProjects.map((project) => [project.id, project.name || "Untitled Project"])
    );
    const projectBudgetMap = new Map(
      visibleProjects.map((project: any) => [
        project.id,
        {
          budget_hours: project.budget_hours == null ? null : Number(project.budget_hours),
          budget_amount: project.budget_amount == null ? null : Number(project.budget_amount),
          budget_currency: project.budget_currency || "USD",
        },
      ])
    );

    const allowedPeople = new Set<string>();
    if (isAdmin) {
      // full org access
    } else if (isManager) {
      allowedPeople.add(actorId);

      const { data: visibleProfiles, error: visibleProfilesErr } = await supa
        .from("profiles")
        .select("id,manager_id")
        .eq("org_id", profile.org_id);

      if (visibleProfilesErr) {
        return NextResponse.json(
          { ok: false, error: visibleProfilesErr.message },
          { status: 400 }
        );
      }

      for (const item of visibleProfiles || []) {
        if ((item as any).manager_id === actorId) {
          allowedPeople.add((item as any).id);
        }
      }
    }

    const { data: runsRaw, error: runsErr } = await supa
      .from("payroll_runs")
      .select(
        "id,period_start,period_end,status,created_at,total_hours,total_amount,currency,paid_at,paid_by,paid_note"
      )
      .eq("org_id", profile.org_id)
      .neq("status", "voided")
      .order("period_start", { ascending: false });

    if (runsErr) {
      return NextResponse.json({ ok: false, error: runsErr.message }, { status: 400 });
    }

    let runs = ((runsRaw || []) as any[]).filter((run) =>
      overlaps(run.period_start, run.period_end, rangeStart, rangeEnd)
    );

    if (scope === "closed_only") {
      runs = runs.filter((run) => {
        const state = String(run.status || "").toLowerCase();
        return state.includes("lock") || state.includes("close") || state.includes("paid");
      });
    }

    const runIds = runs.map((run) => run.id);
    const runMap = new Map(runs.map((run) => [run.id, run]));

    const { data: runEntriesRaw, error: runEntriesErr } = await supa
      .from("payroll_run_entries")
      .select(
        "payroll_run_id,contractor_id,contractor_name_snapshot,project_id,project_name_snapshot,hours,amount,entry_date"
      )
      .in("payroll_run_id", runIds.length ? runIds : ["00000000-0000-0000-0000-000000000000"]);

    if (runEntriesErr) {
      return NextResponse.json({ ok: false, error: runEntriesErr.message }, { status: 400 });
    }

    let runEntries = (runEntriesRaw || []) as any[];
    runEntries = runEntries.filter((entry) => visibleProjectIds.has(entry.project_id));

    if (!isAdmin) {
      runEntries = runEntries.filter((entry) => allowedPeople.has(entry.contractor_id));
    }

    const { data: profilesRaw, error: profilesErr } = await supa
      .from("profiles")
      .select("id,full_name,role,manager_id,is_active")
      .eq("org_id", profile.org_id);

    if (profilesErr) {
      return NextResponse.json({ ok: false, error: profilesErr.message }, { status: 400 });
    }

    let visibleProfiles = (profilesRaw || []) as Array<{
      id: string;
      full_name: string | null;
      role: string | null;
      manager_id?: string | null;
      is_active?: boolean | null;
    }>;

    if (!isAdmin) {
      visibleProfiles = visibleProfiles.filter((person) => allowedPeople.has(person.id));
    }

    const profileMap = new Map(
      visibleProfiles.map((person) => [
        person.id,
        {
          full_name:
            (person.full_name || "").trim() ||
            `User ${String(person.id || "").slice(0, 8)}`,
          role: person.role || null,
          is_active: !!person.is_active,
        },
      ])
    );

    const { data: projectExportsRaw, error: projectExportsErr } = await supa
      .from("project_exports")
      .select(
        "id,created_at,project_id,export_type,period_start,period_end,total_hours,total_amount,currency,metadata,is_paid,paid_at,paid_by,paid_note"
      )
      .eq("org_id", profile.org_id)
      .not("project_id", "is", null)
      .order("created_at", { ascending: false });

    if (projectExportsErr) {
      return NextResponse.json({ ok: false, error: projectExportsErr.message }, { status: 400 });
    }

    let projectExports = (projectExportsRaw || []) as any[];
    projectExports = projectExports.filter(
      (item) =>
        visibleProjectIds.has(item.project_id) &&
        overlaps(item.period_start || rangeStart, item.period_end || rangeEnd, rangeStart, rangeEnd)
    );

    const { data: exportEventsRaw, error: exportEventsErr } = await supa
      .from("export_events")
      .select(
        "id,org_id,created_at,actor_id,actor_name_snapshot,export_type,file_format,scope,project_id,run_id,project_export_id,metadata"
      )
      .eq("org_id", profile.org_id)
      .order("created_at", { ascending: false })
      .limit(250);

    if (exportEventsErr) {
      return NextResponse.json({ ok: false, error: exportEventsErr.message }, { status: 400 });
    }

    const exportEvents = ((exportEventsRaw || []) as any[]).filter(
      (event) => !event.project_id || visibleProjectIds.has(event.project_id)
    );

    const receiptsByKey = new Map<string, Receipt[]>();
    for (const event of exportEvents) {
      const key = projectPeriodKey(
        String(event.project_id || ""),
        String(event.metadata?.period_start || ""),
        String(event.metadata?.period_end || "")
      );

      const receipt: Receipt = {
        id: event.id,
        org_id: event.org_id,
        created_at: event.created_at,
        created_by: event.actor_id || null,
        actor_name: event.actor_name_snapshot || null,
        type: event.export_type || "export",
        label: event.metadata?.label || event.export_type || "Export",
        project_id: event.project_id || null,
        payroll_run_id: event.run_id || null,
        project_export_id: event.project_export_id || null,
        payload_hash: null,
        diff_status: "unknown",
        meta: event.metadata || {},
      };

      const list = receiptsByKey.get(key) || [];
      list.push(receipt);
      receiptsByKey.set(key, list);
    }

    const exportByProjectPeriod = new Map<string, any>();
    for (const item of projectExports) {
      const key = projectPeriodKey(
        String(item.project_id || ""),
        String(item.period_start || ""),
        String(item.period_end || "")
      );
      if (!exportByProjectPeriod.has(key)) {
        exportByProjectPeriod.set(key, item);
      }
    }

    const registerMap = new Map<string, RegisterRowInternal>();

    for (const entry of runEntries) {
      const run = runMap.get(entry.payroll_run_id);
      if (!run) continue;

      const key = projectPeriodKey(entry.project_id, run.period_start, run.period_end);
      const linkedExport = exportByProjectPeriod.get(key) || null;
      const receipts = receiptsByKey.get(key) || [];
      const person = profileMap.get(entry.contractor_id) || {
        full_name: entry.contractor_name_snapshot || "Unknown User",
        role: null,
      };

      const existing: RegisterRowInternal = registerMap.get(key) || {
        id: linkedExport?.id || key,
        project_id: entry.project_id,
        project_name:
          entry.project_name_snapshot ||
          projectNameMap.get(entry.project_id) ||
          linkedExport?.metadata?.project_name ||
          `Project ${String(entry.project_id || "").slice(0, 8)}`,
        period_start: run.period_start,
        period_end: run.period_end,
        period_state: "closed",
        contractor_count: 0,
        contractors: [],
        total_hours: 0,
        total_amount: 0,
        currency: linkedExport?.currency || run.currency || "USD",
        export_status: "not_generated",
        payment_status: "awaiting_export",
        is_paid: false,
        paid_at: null,
        paid_by: null,
        paid_note: null,
        receipt_count: receipts.length,
        latest_project_export_id: linkedExport?.id || null,
        receipts,
        _personTotals: {},
      };

      existing.total_hours += asNumber(entry.hours);
      existing.total_amount += asNumber(entry.amount);
      existing._personTotals[entry.contractor_id] = {
        hours: asNumber(existing._personTotals[entry.contractor_id]?.hours) + asNumber(entry.hours),
        amount:
          asNumber(existing._personTotals[entry.contractor_id]?.amount) + asNumber(entry.amount),
      };

      if (!existing.contractors.some((personItem) => personItem.id === entry.contractor_id)) {
        existing.contractors.push({
          id: entry.contractor_id,
          name: person.full_name,
          role: person.role,
        });
      }

      registerMap.set(key, existing);
    }

    if (scope === "open_and_closed") {
      const { data: timeEntriesRaw, error: timeEntriesErr } = await supa
        .from("time_entries")
        .select("id,user_id,project_id,entry_date,status,lunch_hours,time_in,time_out,hourly_rate_snapshot")
        .eq("org_id", profile.org_id)
        .gte("entry_date", rangeStart)
        .lte("entry_date", rangeEnd);

      if (timeEntriesErr) {
        return NextResponse.json({ ok: false, error: timeEntriesErr.message }, { status: 400 });
      }

      let openEntries = (timeEntriesRaw || []) as any[];
      openEntries = openEntries.filter((entry) => visibleProjectIds.has(entry.project_id));

      if (!isAdmin) {
        openEntries = openEntries.filter((entry) => allowedPeople.has(entry.user_id));
      }

      const runCoveredEntries = new Set(
        runEntries
          .filter((entry) => !!entry.entry_date)
          .map((entry) => `${entry.project_id}|${entry.contractor_id}|${entry.entry_date}`)
      );

      for (const entry of openEntries) {
        const coverageKey = `${entry.project_id}|${entry.user_id}|${entry.entry_date}`;
        if (runCoveredEntries.has(coverageKey)) continue;

        const projectId = String(entry.project_id || "");
        const personId = String(entry.user_id || "");
        if (!projectId || !personId) continue;

        const person = profileMap.get(personId) || {
          full_name: "Unknown User",
          role: null,
        };

        const hours = Math.max(0, 8 - asNumber(entry.lunch_hours));
        const amount = hours * asNumber(entry.hourly_rate_snapshot);
        const key = projectPeriodKey(projectId, rangeStart, rangeEnd);
        const linkedExport = exportByProjectPeriod.get(key) || null;
        const receipts = receiptsByKey.get(key) || [];

        const existing: RegisterRowInternal = registerMap.get(key) || {
          id: linkedExport?.id || `${key}|open`,
          project_id: projectId,
          project_name:
            projectNameMap.get(projectId) ||
            linkedExport?.metadata?.project_name ||
            `Project ${String(projectId || "").slice(0, 8)}`,
          period_start: rangeStart,
          period_end: rangeEnd,
          period_state: "open",
          contractor_count: 0,
          contractors: [],
          total_hours: 0,
          total_amount: 0,
          currency: linkedExport?.currency || "USD",
          export_status: "not_generated",
          payment_status: "awaiting_export",
          is_paid: false,
          paid_at: null,
          paid_by: null,
          paid_note: null,
          receipt_count: receipts.length,
          latest_project_export_id: linkedExport?.id || null,
          receipts,
          _personTotals: {},
        };

        existing.total_hours += hours;
        existing.total_amount += amount;
        existing._personTotals[personId] = {
          hours: asNumber(existing._personTotals[personId]?.hours) + hours,
          amount: asNumber(existing._personTotals[personId]?.amount) + amount,
        };

        if (!existing.contractors.some((personItem) => personItem.id === personId)) {
          existing.contractors.push({
            id: personId,
            name: person.full_name,
            role: person.role,
          });
        }

        registerMap.set(key, existing);
      }
    }

    for (const [key, row] of registerMap.entries()) {
      const linkedExport = exportByProjectPeriod.get(key) || null;
      row.contractors = row.contractors.sort((a, b) => a.name.localeCompare(b.name));
      row.contractor_count = row.contractors.length;
      row.receipt_count = row.receipts.length;
      row.latest_project_export_id = linkedExport?.id || null;
      row.currency = linkedExport?.currency || row.currency || "USD";

      const isPaid = !!linkedExport?.is_paid || !!linkedExport?.paid_at;
      row.is_paid = isPaid;
      row.paid_at = linkedExport?.paid_at || null;
      row.paid_by = linkedExport?.paid_by || null;
      row.paid_note = linkedExport?.paid_note || null;
      row.export_status = computeExportStatus(!!linkedExport, row.receipt_count);
      row.payment_status = computePaymentStatus(!!linkedExport, isPaid);

      registerMap.set(key, row);
    }

    let registerRows = Array.from(registerMap.values()).sort((a, b) => {
      if (a.period_start !== b.period_start) return b.period_start.localeCompare(a.period_start);
      return a.project_name.localeCompare(b.project_name);
    });

    if (projectFilter) {
      registerRows = registerRows.filter((row) => row.project_id === projectFilter);
    }

    if (personFilter) {
      registerRows = registerRows.filter((row) =>
        row.contractors.some((person) => person.id === personFilter)
      );
    }

    if (paymentFilter) {
      registerRows = registerRows.filter((row) => row.payment_status === paymentFilter);
    }

    if (exportFilter) {
      registerRows = registerRows.filter((row) => row.export_status === exportFilter);
    }

    if (search) {
      registerRows = registerRows.filter((row) => {
        const contractorSearch = row.contractors
          .map((person) => `${person.name} ${person.role || ""}`.toLowerCase())
          .join(" ");

        return (
          row.project_name.toLowerCase().includes(search) ||
          row.project_id.toLowerCase().includes(search) ||
          contractorSearch.includes(search) ||
          `${row.period_start} ${row.period_end}`.toLowerCase().includes(search)
        );
      });
    }

    const projectSummaryMap = new Map<string, ProjectSummaryRow>();
    for (const row of registerRows) {
      const budget = projectBudgetMap.get(row.project_id) || { budget_hours: null, budget_amount: null, budget_currency: row.currency || "USD" };
      const existing = projectSummaryMap.get(row.project_id) || {
        id: row.project_id,
        project_id: row.project_id,
        project_name: row.project_name,
        period_count: 0,
        contractor_count: 0,
        total_hours: 0,
        total_amount: 0,
        currency: row.currency,
        export_status: "not_generated" as const,
        payment_status: "awaiting_export" as const,
        paid_amount: 0,
        receipt_count: 0,
        budget_hours: budget.budget_hours,
        budget_amount: budget.budget_amount,
        budget_currency: budget.budget_currency || row.currency || "USD",
        hours_variance: null,
        amount_variance: null,
      };

      existing.period_count += 1;
      existing.total_hours += row.total_hours;
      existing.total_amount += row.total_amount;
      existing.receipt_count += row.receipt_count;

      if (row.is_paid) existing.paid_amount += row.total_amount;

      const contractorIds = new Set<string>([
        ...(((existing as any)._contractorIds as string[] | undefined) || []),
        ...row.contractors.map((person) => person.id),
      ]);
      (existing as any)._contractorIds = Array.from(contractorIds);
      existing.contractor_count = contractorIds.size;

      if (row.export_status === "linked") existing.export_status = "linked";
      else if (row.export_status === "generated" && existing.export_status !== "linked") {
        existing.export_status = "generated";
      }

      if (row.payment_status === "paid") existing.payment_status = "paid";
      else if (
        row.payment_status === "awaiting_payment" &&
        existing.payment_status !== "paid"
      ) {
        existing.payment_status = "awaiting_payment";
      }

      projectSummaryMap.set(row.project_id, existing);
    }

    const projectSummary = Array.from(projectSummaryMap.values())
      .map((row) => {
        delete (row as any)._contractorIds;
        row.hours_variance = row.budget_hours != null ? row.total_hours - row.budget_hours : null;
        row.amount_variance = row.budget_amount != null ? row.total_amount - row.budget_amount : null;
        return row;
      })
      .sort((a, b) => b.total_amount - a.total_amount);

    const contractorSummaryMap = new Map<string, ContractorSummaryRow>();
    for (const row of registerRows) {
      for (const person of row.contractors) {
        const internalRow = row as RegisterRowInternal;
        const personTotals = internalRow._personTotals?.[person.id] || { hours: 0, amount: 0 };

        const existing = contractorSummaryMap.get(person.id) || {
          id: person.id,
          person_id: person.id,
          person_name: person.name,
          role: person.role,
          project_count: 0,
          total_hours: 0,
          total_amount: 0,
          currency: row.currency,
          export_status: "not_generated" as const,
          payment_status: "awaiting_export" as const,
          paid_amount: 0,
          related_project_ids: [],
        };

        existing.total_hours += asNumber(personTotals.hours);
        existing.total_amount += asNumber(personTotals.amount);

        const relatedProjects = new Set([...existing.related_project_ids, row.project_id]);
        existing.related_project_ids = Array.from(relatedProjects);
        existing.project_count = relatedProjects.size;

        if (row.export_status === "linked") existing.export_status = "linked";
        else if (row.export_status === "generated" && existing.export_status !== "linked") {
          existing.export_status = "generated";
        }

        if (row.payment_status === "paid") {
          existing.payment_status = "paid";
          existing.paid_amount += asNumber(personTotals.amount);
        } else if (
          row.payment_status === "awaiting_payment" &&
          existing.payment_status !== "paid"
        ) {
          existing.payment_status = "awaiting_payment";
        }

        contractorSummaryMap.set(person.id, existing);
      }
    }

    const contractorSummary = Array.from(contractorSummaryMap.values()).sort(
      (a, b) => b.total_amount - a.total_amount
    );

    const registerResponse = registerRows.map((row) => {
      const { _personTotals, ...cleanRow } = row as RegisterRowInternal;
      return cleanRow;
    });

    const totalPayrollCost = registerResponse.reduce((sum, row) => sum + row.total_amount, 0);
    const totalHours = registerResponse.reduce((sum, row) => sum + row.total_hours, 0);
    const paidAmount = registerResponse
      .filter((row) => row.is_paid)
      .reduce((sum, row) => sum + row.total_amount, 0);
    const needsExportCount = registerResponse.filter(
      (row) => row.export_status === "not_generated"
    ).length;
    const exportsLinked = registerResponse.filter((row) => row.export_status === "linked").length;
    const paidRows = registerResponse.filter((row) => row.is_paid).length;

    const trendMap = new Map<string, TrendPoint>();
    for (const row of registerResponse) {
      const key = `${row.period_start}:${row.period_end}`;
      const existing = trendMap.get(key) || {
        key,
        label: `${row.period_start} → ${row.period_end}`,
        amount: 0,
        hours: 0,
      };
      existing.amount += row.total_amount;
      existing.hours += row.total_hours;
      trendMap.set(key, existing);
    }

    const trend = Array.from(trendMap.values()).sort((a, b) => a.key.localeCompare(b.key));

    const recentActivity = exportEvents.slice(0, 8).map((event) => {
      const projectExport =
        projectExports.find((item) => item.id === event.project_export_id) || null;

      return {
        id: event.id,
        created_at: event.created_at,
        project_name: event.project_id
          ? projectNameMap.get(event.project_id) ||
            event.metadata?.project_name ||
            `Project ${String(event.project_id || "").slice(0, 8)}`
          : "—",
        export_type: event.export_type || "export",
        paid: !!projectExport?.is_paid || !!projectExport?.paid_at,
      };
    });

    const peopleOptionsSource = visibleProfiles
      .map((person) => ({
        id: person.id,
        name:
          (person.full_name || "").trim() ||
          `User ${String(person.id || "").slice(0, 8)}`,
        role: person.role || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(
      {
        ok: true,
        range: {
          start: rangeStart,
          end: rangeEnd,
          preset,
          period_scope: scope,
        },
        options: {
          projects: visibleProjects.map((project) => ({
            id: project.id,
            name: project.name || "Untitled Project",
          })),
          people: peopleOptionsSource,
        },
        kpis: {
          total_payroll_cost: totalPayrollCost,
          total_hours: totalHours,
          paid_amount: paidAmount,
          needs_export_count: needsExportCount,
          visible_projects: visibleProjects.length,
          periods_in_view: uniq(
            registerResponse.map((row) => `${row.period_start}|${row.period_end}`)
          ).length,
          exports_linked: exportsLinked,
          paid_rows: paidRows,
        },
        trend,
        project_summary: projectSummary,
        contractor_summary: contractorSummary,
        register: registerResponse,
        recent_activity: recentActivity,
      },
      { status: 200, headers: { "cache-control": "private, max-age=10" } }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
