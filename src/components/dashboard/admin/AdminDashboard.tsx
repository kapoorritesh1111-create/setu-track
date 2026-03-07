"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseBrowser";
import { apiJson } from "../../../lib/api/client";
import { presetToRange } from "../../../lib/dateRanges";
import { CardPad } from "../../ui/Card";
import { StatCard } from "../../ui/StatCard";
import { SectionHeader } from "../../ui/SectionHeader";
import { EmptyState } from "../../ui/EmptyState";
import { MetricsRow } from "../../ui/MetricsRow";
import { StatusChip } from "../../ui/StatusChip";

type Contractor = { id: string; full_name: string | null; hourly_rate: number | null };
type VRow = {
  user_id: string;
  full_name?: string | null;
  hours_worked: number | null;
  hourly_rate_snapshot?: number | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  entry_date: string;
};

type AdminSummary = {
  total_hours: number;
  total_amount: number;
  pending_entries: number;
  active_contractors: number;
  payroll_state?: string;
  payroll_run_id?: string | null;
  closed_at?: string | null;
  paid_at?: string | null;
  currency?: string;
};

type FinancialPayload = {
  ok: true;
  analytics: {
    total_payroll: number;
    total_hours: number;
    budget_used: number;
    budget_remaining: number;
    budget_risk_alerts: number;
    incomplete_profiles: number;
    payroll_variance: { delta: number; pct: number };
    export_history_count: number;
  };
  project_budgets: Array<{
    project_id: string;
    project_name: string;
    budget_amount: number;
    payroll_cost: number;
    remaining_budget: number;
    billing_rate: number;
    risk: string;
    currency: string;
  }>;
  profile_completeness: Array<{
    contractor_id: string;
    contractor_name: string;
    score: number;
    missing: string[];
    payroll_missing: string[];
  }>;
};

function money(x: number) {
  return x.toFixed(2);
}

function monthLabel(startISO: string) {
  const d = new Date(`${startISO}T00:00:00`);
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function pctChange(current: number, previous: number) {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return ((current - previous) / previous) * 100;
}

function riskState(risk: string): "approved" | "open" | "submitted" | "rejected" | "draft" {
  if (risk === "healthy") return "approved";
  if (risk === "watch") return "open";
  if (risk === "high") return "submitted";
  if (risk === "over") return "rejected";
  return "draft";
}

export default function AdminDashboard({ orgId }: { orgId: string; userId: string }) {
  const router = useRouter();
  const [preset, setPreset] = useState<"current_month" | "last_month">("current_month");
  const range = useMemo(() => presetToRange(preset, "sunday"), [preset]);
  const currentMonthRange = useMemo(() => presetToRange("current_month", "sunday"), []);
  const previousMonthRange = useMemo(() => presetToRange("last_month", "sunday"), []);
  const [startDate, setStartDate] = useState(range.start);
  const [endDate, setEndDate] = useState(range.end);

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [rows, setRows] = useState<VRow[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [currentMonthSummary, setCurrentMonthSummary] = useState<AdminSummary | null>(null);
  const [previousMonthSummary, setPreviousMonthSummary] = useState<AdminSummary | null>(null);
  const [financials, setFinancials] = useState<FinancialPayload | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [blockers, setBlockers] = useState<any[] | null>(null);
  const [blockerTotals, setBlockerTotals] = useState<{ entries: number; hours: number; amount: number } | null>(null);
  const [closeChecklist, setCloseChecklist] = useState<Array<{ key: string; label: string; status: "pass" | "warn"; count: number; detail?: string }>>([]);
  const [periodLocked, setPeriodLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setStartDate(range.start);
    setEndDate(range.end);
  }, [range.start, range.end]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ period_start: startDate, period_end: endDate });
        const r = await apiJson<{ ok: boolean; locked: boolean; locked_at: string | null }>(`/api/pay-period/status?${qs.toString()}`);
        if (cancelled) return;
        setPeriodLocked(!!r.locked);
        setLockedAt(r.locked_at);
      } catch {
        if (cancelled) return;
        setPeriodLocked(false);
        setLockedAt(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setMsg("");
      try {
        const [{ data: cons, error: consErr }, { data: r, error: rErr }] = await Promise.all([
          supabase
            .from("profiles")
            .select("id,full_name,hourly_rate")
            .eq("org_id", orgId)
            .eq("role", "contractor")
            .eq("is_active", true)
            .order("full_name", { ascending: true }),
          supabase
            .from("v_time_entries")
            .select("user_id,full_name,hours_worked,hourly_rate_snapshot,status,entry_date")
            .eq("org_id", orgId)
            .gte("entry_date", startDate)
            .lte("entry_date", endDate),
        ]);

        if (cancelled) return;
        if (consErr) throw consErr;
        if (rErr) throw rErr;

        setContractors(((cons as any) ?? []) as Contractor[]);
        setRows(((r as any) ?? []) as VRow[]);
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message || "Failed to load dashboard");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgId, startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    async function fetchSummary(period_start: string, period_end: string) {
      const res = await apiJson<{ ok: true; summary: AdminSummary }>("/api/dashboard/admin-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_start, period_end }),
      });
      return res.summary || null;
    }

    (async () => {
      try {
        const [selected, currentMonth, previousMonth, financial] = await Promise.all([
          fetchSummary(startDate, endDate),
          fetchSummary(currentMonthRange.start, currentMonthRange.end),
          fetchSummary(previousMonthRange.start, previousMonthRange.end),
          apiJson<FinancialPayload>(`/api/dashboard/financial-intelligence?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`),
        ]);
        if (cancelled) return;
        setSummary(selected);
        setCurrentMonthSummary(currentMonth);
        setPreviousMonthSummary(previousMonth);
        setFinancials(financial);
      } catch {
        if (cancelled) return;
        setSummary(null);
        setCurrentMonthSummary(null);
        setPreviousMonthSummary(null);
        setFinancials(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, currentMonthRange.start, currentMonthRange.end, previousMonthRange.start, previousMonthRange.end]);

  const { approvedHours, approvedPay, pendingCount } = useMemo(() => {
    let ah = 0;
    let ap = 0;
    let pc = 0;
    for (const r of rows) {
      const h = Number(r.hours_worked ?? 0);
      const rate = Number(r.hourly_rate_snapshot ?? 0);
      if (r.status === "approved") {
        ah += h;
        ap += h * rate;
      }
      if (r.status === "submitted") pc += 1;
    }
    return { approvedHours: ah, approvedPay: ap, pendingCount: pc };
  }, [rows]);

  const contractorCards = useMemo(() => {
    const map = new Map<string, { id: string; name: string; hours: number; rate: number; pay: number; status: "Ready" | "Pending" }>();
    for (const c of contractors) {
      map.set(c.id, {
        id: c.id,
        name: c.full_name || "(no name)",
        hours: 0,
        rate: Number(c.hourly_rate ?? 0),
        pay: 0,
        status: "Ready",
      });
    }
    for (const r of rows) {
      if (!map.has(r.user_id)) continue;
      const item = map.get(r.user_id)!;
      const h = Number(r.hours_worked ?? 0);
      const rate = Number(r.hourly_rate_snapshot ?? item.rate);
      if (r.status === "approved") {
        item.hours += h;
        item.pay += h * rate;
        item.rate = rate;
      }
      if (r.status === "submitted") item.status = "Pending";
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [contractors, rows]);

  const currentPayroll = Number(currentMonthSummary?.total_amount ?? 0);
  const previousPayroll = Number(previousMonthSummary?.total_amount ?? 0);
  const payrollDeltaPct = pctChange(currentPayroll, previousPayroll);
  const currency = summary?.currency || currentMonthSummary?.currency || "USD";

  async function previewClose() {
    setPreviewBusy(true);
    setMsg("");
    try {
      const json = await apiJson<any>("/api/pay-period/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_start: startDate, period_end: endDate }),
      });
      setBlockers(json.blockers || []);
      setBlockerTotals(json.totals || null);
      setCloseChecklist(json.checklist?.items || []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to preview payroll close.");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function closePayroll() {
    const yes = window.confirm(`Lock payroll for ${startDate} → ${endDate}? This snapshots approved entries for payroll.`);
    if (!yes) return;
    setClosing(true);
    setMsg("");
    try {
      await apiJson("/api/pay-period/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_start: startDate, period_end: endDate }),
      });
      setMsg("Payroll locked ✅");
      setPeriodLocked(true);
      await previewClose();
    } catch (e: any) {
      setMsg(e?.message || "Failed to lock payroll.");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {msg ? (
        <div className="alert alertInfo">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg}</pre>
        </div>
      ) : null}

      <MetricsRow>
        <StatCard label="Approved hours" value={`${approvedHours.toFixed(2)} hrs`} hint={`${startDate} → ${endDate}`} />
        <StatCard label="Approved payroll" value={`${currency} ${money(approvedPay)}`} hint={`${pendingCount} pending entries`} />
        <StatCard label="Current month" value={`${currency} ${money(currentPayroll)}`} hint={`${monthLabel(currentMonthRange.start)}`} />
        <StatCard label="vs last month" value={`${payrollDeltaPct >= 0 ? "+" : ""}${payrollDeltaPct.toFixed(1)}%`} hint={`${monthLabel(previousMonthRange.start)}`} />
      </MetricsRow>

      <MetricsRow>
        <StatCard label="Budget used" value={`${currency} ${money(Number(financials?.analytics.budget_used || 0))}`} hint={`${financials?.analytics.budget_risk_alerts || 0} project alerts`} />
        <StatCard label="Budget remaining" value={`${currency} ${money(Number(financials?.analytics.budget_remaining || 0))}`} hint="Across tracked projects" />
        <StatCard label="Incomplete profiles" value={`${financials?.analytics.incomplete_profiles || 0}`} hint="Payroll-required fields missing" />
        <StatCard label="Export ledger" value={`${financials?.analytics.export_history_count || 0}`} hint="Tracked payroll exports" />
      </MetricsRow>

      <CardPad className="dbPayCard">
        <div className="dbPayHeader">
          <div>
            <div className="dbPayTitle">Financial operations</div>
            <div className="muted">Budget exposure, contractor readiness, and payroll intelligence for the selected period.</div>
          </div>
          <div className="dbPayValue">{currency} {money(Number(financials?.analytics.total_payroll || summary?.total_amount || 0))}</div>
        </div>

        <div className="dbQuickGrid" style={{ marginTop: 14 }}>
          <button className="dbQuickBtn" onClick={() => router.push("/reports/payroll")}>Payroll analytics<span className="muted">Project and contractor breakdowns</span></button>
          <button className="dbQuickBtn" onClick={() => router.push("/projects")}>Project budgets<span className="muted">Budget, billing, remaining</span></button>
          <button className="dbQuickBtn" onClick={() => router.push("/reports/payroll-runs")}>Payroll runs<span className="muted">Financial register and audit trail</span></button>
        </div>
      </CardPad>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 14 }}>
        <CardPad>
          <SectionHeader title="Project budget watchlist" subtitle="Current payroll cost against tracked budgets" />
          {financials?.project_budgets?.length ? (
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {financials.project_budgets.slice(0, 6).map((row) => (
                <div key={row.project_id} className="row" style={{ justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{row.project_name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Budget {row.currency} {money(row.budget_amount)} • Used {row.currency} {money(row.payroll_cost)} • Remaining {row.currency} {money(row.remaining_budget)}
                    </div>
                  </div>
                  <StatusChip state={riskState(row.risk)} label={row.risk === "untracked" ? "Untracked" : row.risk} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No tracked budgets yet" description="Add a budget and billing rate on the Projects page to activate budget intelligence." />
          )}
        </CardPad>

        <CardPad>
          <SectionHeader title="Contractor profile readiness" subtitle="Payroll completeness score for active contractors" />
          {financials?.profile_completeness?.length ? (
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {financials.profile_completeness.slice(0, 6).map((row) => (
                <div key={row.contractor_id} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{row.contractor_name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{row.payroll_missing.length ? `Missing: ${row.payroll_missing.join(", ")}` : "Payroll-ready"}</div>
                  </div>
                  <StatusChip state={row.score === 100 ? "approved" : row.score >= 70 ? "submitted" : "rejected"} label={`${row.score}%`} />
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 12 }}>No contractor profiles found.</div>
          )}
        </CardPad>
      </div>

      <CardPad>
        <SectionHeader title="Payroll close control" subtitle="Preview blockers before locking a pay period" />
        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <select className="select" value={preset} onChange={(e) => setPreset(e.target.value as any)}>
            <option value="current_month">Current month</option>
            <option value="last_month">Last month</option>
          </select>
          <button className="pill" onClick={previewClose} disabled={previewBusy}>{previewBusy ? "Checking…" : "Preview close"}</button>
          <button className="btnPrimary" onClick={closePayroll} disabled={closing || periodLocked}>{periodLocked ? "Locked" : closing ? "Locking…" : "Lock payroll"}</button>
          {periodLocked ? <StatusChip state="approved" label={lockedAt ? `Locked ${new Date(lockedAt).toLocaleString()}` : "Locked"} /> : null}
        </div>

        {closeChecklist.length ? (
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {closeChecklist.map((item) => (
              <div key={item.key} className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{item.label}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{item.detail || ""}</div>
                </div>
                <StatusChip state={item.status === "pass" ? "approved" : "rejected"} label={`${item.count}`} />
              </div>
            ))}
          </div>
        ) : null}
      </CardPad>

      <CardPad>
        <SectionHeader title="Contractor payroll view" subtitle="Approved pay by contractor for the selected range" />
        {busy ? (
          <div className="muted" style={{ marginTop: 12 }}>Loading…</div>
        ) : contractorCards.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 12 }}>
            {contractorCards.map((item) => (
              <div key={item.id} className="card cardPad" style={{ boxShadow: "none" }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{item.hours.toFixed(2)} hrs • Rate {currency} {money(item.rate)}</div>
                  </div>
                  <StatusChip state={item.status === "Ready" ? "approved" : "submitted"} label={item.status} />
                </div>
                <div style={{ fontWeight: 900, marginTop: 8 }}>{currency} {money(item.pay)}</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No contractor payroll in range" description="Approved payroll will appear here once time is ready for the selected period." />
        )}
      </CardPad>
    </div>
  );
}
