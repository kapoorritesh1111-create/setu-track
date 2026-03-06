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

type EntryStatus = "draft" | "submitted" | "approved" | "rejected";

type Contractor = { id: string; full_name: string | null; hourly_rate: number | null };

type VRow = {
  user_id: string;
  full_name?: string | null;
  hours_worked: number | null;
  hourly_rate_snapshot?: number | null;
  status: EntryStatus;
  entry_date: string;
};

function money(x: number) {
  return x.toFixed(2);
}

function monthLabel(startISO: string) {
  const d = new Date(startISO + "T00:00:00");
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

export default function AdminDashboard({ orgId, userId }: { orgId: string; userId: string }) {
  const router = useRouter();

  const [preset, setPreset] = useState<"current_month" | "last_month">("current_month");
  const range = useMemo(() => presetToRange(preset, "sunday"), [preset]);
  const [startDate, setStartDate] = useState(range.start);
  const [endDate, setEndDate] = useState(range.end);

  useEffect(() => {
    setStartDate(range.start);
    setEndDate(range.end);
  }, [range.start, range.end]);

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [rows, setRows] = useState<VRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [summary, setSummary] = useState<{ total_hours: number; total_amount: number; pending_entries: number; active_contractors: number } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [blockers, setBlockers] = useState<any[] | null>(null);
  const [blockerTotals, setBlockerTotals] = useState<{ entries: number; hours: number; amount: number } | null>(null);

  const [periodLocked, setPeriodLocked] = useState(false);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  // Lock status
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ period_start: startDate, period_end: endDate });
        const r = await apiJson<{ ok: boolean; locked: boolean; locked_at: string | null; locked_by: string | null }>(
          `/api/pay-period/status?${qs.toString()}`
        );
        if (cancelled) return;
        setPeriodLocked(!!r.locked);
        setLockedAt(r.locked_at);
        setLockedBy(r.locked_by);
      } catch (e: any) {
        if (cancelled) return;
        // Non-blocking
        setPeriodLocked(false);
        setLockedAt(null);
        setLockedBy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  // Load contractors + entries
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setBusy(true);
      setMsg("");

      try {
        const { data: cons, error: consErr } = await supabase
          .from("profiles")
          .select("id,full_name,hourly_rate")
          .eq("org_id", orgId)
          .eq("role", "contractor")
          .eq("is_active", true)
          .order("full_name", { ascending: true });

        if (cancelled) return;
        if (consErr) throw consErr;
        setContractors(((cons as any) ?? []) as Contractor[]);

        const { data: r, error: rErr } = await supabase
          .from("v_time_entries")
          .select("user_id,full_name,hours_worked,hourly_rate_snapshot,status,entry_date")
          .eq("org_id", orgId)
          .gte("entry_date", startDate)
          .lte("entry_date", endDate);

        if (cancelled) return;
        if (rErr) throw rErr;
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
      // Refresh lock status
      const qs = new URLSearchParams({ period_start: startDate, period_end: endDate });
      const st = await apiJson<{ ok: boolean; locked: boolean; locked_at: string | null; locked_by: string | null }>(
        `/api/pay-period/status?${qs.toString()}`
      );
      setPeriodLocked(!!st.locked);
      setLockedAt(st.locked_at);
      setLockedBy(st.locked_by);
      // Route to payroll report for this period
      router.push(`/reports/payroll?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&locked=1`);
    } catch (e: any) {
      setMsg(e?.message || "Failed to close payroll");
    } finally {
      setClosing(false);
    }
  }

  return (
    <>
      {msg ? (
        <div className="alert alertInfo">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg}</pre>
        </div>
      ) : null}

      <MetricsRow>
        <StatCard label="Period" value={monthLabel(startDate)} hint={`${startDate} → ${endDate}`} right={
          <select className="pill" value={preset} onChange={(e) => setPreset(e.target.value as any)}>
            <option value="current_month">Current month</option>
            <option value="last_month">Last month</option>
          </select>
        } />
        <StatCard label="Approved cost" value={`$${money(Number(summary?.total_amount ?? approvedPay))}`} hint={`${Number(summary?.total_hours ?? approvedHours).toFixed(2)} hrs approved`} />
        <StatCard label="Pending approvals" value={Number(summary?.pending_entries ?? pendingCount)} hint="Submitted entries" />
        <StatCard label="Contractors" value={Number(summary?.active_contractors ?? contractors.length)} hint={busy ? "Loading…" : "Active in org"} />
      </MetricsRow>

      <CardPad className="dbPayCard" style={{ marginTop: 14 }}>
        <div className="dbPayHeader">
          <div>
            <div className="dbPayTitle">Monthly close</div>
            <div className="muted">Lock the period and generate a reproducible payroll snapshot.</div>
          </div>
          {periodLocked ? (
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <StatusChip state="locked" />
              <div className="muted" style={{ fontSize: 12 }}>{lockedAt ? new Date(lockedAt).toLocaleString() : ""}</div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className="pill" disabled={previewBusy} onClick={previewClose}>
                {previewBusy ? "Checking…" : "Preview close"}
              </button>
              <button className="btnPrimary" disabled={closing} onClick={closePayroll}>
                {closing ? "Closing…" : "Close payroll"}
              </button>
            </div>
          )}
        </div>
        {periodLocked ? (
          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="pill" onClick={() => router.push(`/reports/payroll?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&locked=1`)}>
              View payroll report
            </button>
            <button className="pill" onClick={() => router.push("/approvals")}>Review approvals</button>
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div className="muted">Tip: close only when all entries in this period are approved.</div>

            {blockers && blockers.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Blockers</div>
                <div className="muted" style={{ marginBottom: 10 }}>
                  {blockerTotals ? `${blockerTotals.entries} entries • ${blockerTotals.hours.toFixed(2)} hrs • $${money(blockerTotals.amount)}` : ""}
                </div>
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

                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="pill" onClick={() => router.push("/approvals")}>Review approvals</button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardPad>

      <SectionHeader
        title="Contractors"
        subtitle="Approved hours and cost for this period"
        right={<button className="pill" onClick={() => router.push("/admin/users")}>Manage people</button>}
      />

      {contractorCards.length === 0 ? (
        <EmptyState
          title="No contractors yet"
          description="Invite contractors to start tracking time and running payroll."
          action={<button className="btnPrimary" onClick={() => router.push("/admin")}>Go to Admin</button>}
        />
      ) : (
        <div className="dbQuickGrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" } as any}>
          {contractorCards.map((c) => (
            <button
              key={c.id}
              className="dbQuickBtn"
              onClick={() => router.push(`/reports/payroll?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&contractor=${encodeURIComponent(c.id)}`)}
              style={{ textAlign: "left" } as any}
            >
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

// KPI summary (server aggregated)
useEffect(() => {
  let cancelled = false;
  async function loadSummary() {
    if (!orgId) return;
    try {
      const res = await apiJson<{ ok: true; summary: any }>("/api/dashboard/admin-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_start: startDate, period_end: endDate }),
      });
      if (!cancelled) setSummary(res.summary || null);
    } catch (e: any) {
      if (!cancelled) setSummary(null);
    }
  }
  loadSummary();
  return () => {
    cancelled = true;
  };
}, [orgId, startDate, endDate]);

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
    if ((res.rows || []).length === 0) {
      setMsg("Ready to close. No blockers found.");
    } else {
      setMsg(`Blocked: ${(res.totals?.entries ?? 0)} entries need approval before closing.`);
    }
  } catch (e: any) {
    setMsg(e?.message || "Failed to preview close");
  } finally {
    setPreviewBusy(false);
  }
}
}