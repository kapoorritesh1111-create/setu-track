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

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [blockers, setBlockers] = useState<any[] | null>(null);
  const [blockerTotals, setBlockerTotals] = useState<{ entries: number; hours: number; amount: number } | null>(null);
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
        const [selected, currentMonth, previousMonth] = await Promise.all([
          fetchSummary(startDate, endDate),
          fetchSummary(currentMonthRange.start, currentMonthRange.end),
          fetchSummary(previousMonthRange.start, previousMonthRange.end),
        ]);
        if (cancelled) return;
        setSummary(selected);
        setCurrentMonthSummary(currentMonth);
        setPreviousMonthSummary(previousMonth);
      } catch {
        if (cancelled) return;
        setSummary(null);
        setCurrentMonthSummary(null);
        setPreviousMonthSummary(null);
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
  const currentHours = Number(currentMonthSummary?.total_hours ?? 0);
  const previousHours = Number(previousMonthSummary?.total_hours ?? 0);
  const payrollChange = pctChange(currentPayroll, previousPayroll);
  const hoursChange = pctChange(currentHours, previousHours);

  async function closePayroll() {
    setClosing(true);
    setMsg("");
    try {
      const r = await apiJson<{ ok: boolean; run_id?: string; error?: string }>("/api/pay-period/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_start: startDate, period_end: endDate }),
      });
      if (!r.ok) throw new Error(r.error || "Unable to close payroll");
      router.push(`/reports/payroll?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&locked=1`);
    } catch (e: any) {
      setMsg(e?.message || "Failed to close payroll");
    } finally {
      setClosing(false);
    }
  }

  async function previewClose() {
    try {
      setPreviewBusy(true);
      setMsg("");
      const res = await apiJson<{ ok: true; blocked: boolean; totals: any; rows: any[] }>("/api/pay-period/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_start: startDate, period_end: endDate }),
      });
      setBlockers(res.rows || []);
      setBlockerTotals(res.totals || null);
      setMsg((res.rows || []).length === 0 ? "Ready to close. No blockers found." : `Blocked: ${(res.totals?.entries ?? 0)} entries need approval before closing.`);
    } catch (e: any) {
      setMsg(e?.message || "Failed to preview close");
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <>
      {msg ? (
        <div className="alert alertInfo">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg}</pre>
        </div>
      ) : null}

      <div className="setuCompareGrid">
        <div className="setuCompareCard setuCompareCardPrimary">
          <div className="setuCompareLabel">Current month payroll</div>
          <div className="setuCompareValue">${money(currentPayroll)}</div>
          <div className="setuCompareMeta">{monthLabel(currentMonthRange.start)} • {currentHours.toFixed(2)} hrs</div>
        </div>
        <div className="setuCompareCard">
          <div className="setuCompareLabel">Previous month payroll</div>
          <div className="setuCompareValue">${money(previousPayroll)}</div>
          <div className="setuCompareMeta">{monthLabel(previousMonthRange.start)} • {previousHours.toFixed(2)} hrs</div>
        </div>
        <div className="setuCompareCard">
          <div className="setuCompareLabel">Payroll change</div>
          <div className={`setuCompareValue ${payrollChange >= 0 ? "isPositive" : "isNegative"}`}>{payrollChange >= 0 ? "+" : ""}{payrollChange.toFixed(1)}%</div>
          <div className="setuCompareMeta">Month over month payroll movement</div>
        </div>
        <div className="setuCompareCard">
          <div className="setuCompareLabel">Hours change</div>
          <div className={`setuCompareValue ${hoursChange >= 0 ? "isPositive" : "isNegative"}`}>{hoursChange >= 0 ? "+" : ""}{hoursChange.toFixed(1)}%</div>
          <div className="setuCompareMeta">Current vs previous month hours</div>
        </div>
      </div>

      <MetricsRow>
        <StatCard
          label="Period"
          value={monthLabel(startDate)}
          hint={`${startDate} → ${endDate}`}
          right={
            <select className="pill" value={preset} onChange={(e) => setPreset(e.target.value as any)}>
              <option value="current_month">Current month</option>
              <option value="last_month">Last month</option>
            </select>
          }
        />
        <StatCard label="Approved cost" value={`$${money(Number(summary?.total_amount ?? approvedPay))}`} hint={`${Number(summary?.total_hours ?? approvedHours).toFixed(2)} hrs approved`} />
        <StatCard label="Pending approvals" value={Number(summary?.pending_entries ?? pendingCount)} hint="Submitted entries" />
        <StatCard label="Contractors" value={Number(summary?.active_contractors ?? contractors.length)} hint={busy ? "Loading…" : "Active in org"} />
      </MetricsRow>

      <CardPad className="dbPayCard" style={{ marginTop: 14 }}>
        <div className="dbPayHeader">
          <div>
            <div className="dbPayTitle">Monthly close</div>
            <div className="muted">Lock the period and generate a reproducible payroll snapshot.</div>
            {summary?.payroll_state && summary.payroll_state !== "open" ? (
              <div className="muted" style={{ marginTop: 6 }}>
                Current state: <b>{String(summary.payroll_state)}</b>{summary?.closed_at ? ` • ${new Date(summary.closed_at).toLocaleString()}` : ""}
              </div>
            ) : null}
          </div>
          {periodLocked ? (
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <StatusChip state="locked" />
              <div className="muted" style={{ fontSize: 12 }}>{lockedAt ? new Date(lockedAt).toLocaleString() : ""}</div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className="pill" disabled={previewBusy} onClick={previewClose}>{previewBusy ? "Checking…" : "Preview close"}</button>
              <button className="btnPrimary" disabled={closing} onClick={closePayroll}>{closing ? "Closing…" : "Close payroll"}</button>
            </div>
          )}
        </div>

        {periodLocked ? (
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="pill" onClick={() => router.push(`/reports/payroll?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&locked=1`)}>View payroll report</button>
            <button className="pill" onClick={() => router.push("/reports/payroll-runs")}>Open payroll runs</button>
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div className="muted">Tip: close only when all entries in this period are approved.</div>
            {blockers && blockers.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Blockers</div>
                <div className="muted" style={{ marginBottom: 10 }}>{blockerTotals ? `${blockerTotals.entries} entries • ${blockerTotals.hours.toFixed(2)} hrs • $${money(blockerTotals.amount)}` : ""}</div>
                <div style={{ overflowX: "auto" }}>
                  <table className="table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Contractor</th>
                        <th>Status</th>
                        <th>Entries</th>
                        <th>Hours</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockers.map((b, idx) => (
                        <tr key={idx}>
                          <td>{b.contractor_name}</td>
                          <td>{b.status}</td>
                          <td>{b.entries_count}</td>
                          <td>{Number(b.hours || 0).toFixed(2)}</td>
                          <td>${money(Number(b.amount || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardPad>

      <SectionHeader title="Contractors" subtitle="Approved hours and cost for this period" right={<button className="pill" onClick={() => router.push("/admin/users")}>Manage people</button>} />

      {contractorCards.length === 0 ? (
        <EmptyState title="No contractors yet" description="Invite contractors to start tracking time and running payroll." action={<button className="btnPrimary" onClick={() => router.push("/admin")}>Go to Admin</button>} />
      ) : (
        <div className="dbQuickGrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" } as any}>
          {contractorCards.map((c) => (
            <button key={c.id} className="dbQuickBtn" onClick={() => router.push(`/reports/payroll?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&contractor=${encodeURIComponent(c.id)}`)} style={{ textAlign: "left" } as any}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 950 }}>{c.name}</div>
                <div className={c.status === "Pending" ? "pill" : "muted"}>{c.status}</div>
              </div>
              <span className="muted">{c.hours.toFixed(2)} hrs • ${money(c.pay)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
