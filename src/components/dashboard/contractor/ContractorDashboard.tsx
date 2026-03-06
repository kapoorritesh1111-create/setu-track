"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CardPad } from "../../ui/Card";
import { StatCard } from "../../ui/StatCard";
import { apiJson } from "../../../lib/api/client";
import { toISODate } from "../../../lib/date";
import { MetricsRow } from "../../ui/MetricsRow";
import { StatusChip } from "../../ui/StatusChip";

function monthStartISO(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

function monthEndISO(startISO: string) {
  const [y, m] = startISO.split("-").map((x) => Number(x));
  const end = new Date(Date.UTC(y, m, 0));
  const yyyy = end.getUTCFullYear();
  const mm = String(end.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(end.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function money(x: number) {
  return Number(x || 0).toFixed(2);
}

export default function ContractorDashboard({ userId, hourlyRate }: { userId: string; hourlyRate: number }) {
  const router = useRouter();

  const periodStart = useMemo(() => monthStartISO(new Date()), []);
  const periodEnd = useMemo(() => monthEndISO(periodStart), [periodStart]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBusy(true);
      setMsg("");
      try {
        const res = await apiJson<any>("/api/contractor/my-pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }),
        });
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message || "Failed to load contractor dashboard");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [periodStart, periodEnd]);

  const approvedHours = Number(data?.totals?.approved_hours || 0);
  const approvedPay = Number(data?.totals?.approved_amount || 0);
  const pendingCount = Number(data?.totals?.pending_count || 0);
  const lastClosedPay = Number(data?.last_closed?.total_amount || 0);

  return (
    <>
      {msg ? (
        <div className="alert alertInfo">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg}</pre>
        </div>
      ) : null}

      <MetricsRow>
        <StatCard label="This month hours" value={`${approvedHours.toFixed(2)} hrs`} hint={`${periodStart} → ${periodEnd}`} />
        <StatCard label="Estimated pay" value={`$${money(approvedPay)}`} hint="Approved hours × snapshot rate" />
        <StatCard label="Last closed payout" value={data?.last_closed ? `$${money(lastClosedPay)}` : "—"} hint={data?.last_closed ? `${data.last_closed.period_start} → ${data.last_closed.period_end}` : "No closed payroll yet"} />
        <StatCard label="Pending entries" value={`${pendingCount}`} hint="Needs approval" />
      </MetricsRow>

      <CardPad className="dbPayCard" style={{ marginTop: 14 }}>
        <div className="dbPayHeader">
          <div>
            <div className="dbPayTitle">Your pay this month</div>
            <div className="muted">This is what’s approved so far — pending entries don’t count yet.</div>
          </div>
          <div className="dbPayValue">${money(approvedPay)}</div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="pill" onClick={() => router.push("/timesheet")}>Enter time</button>
          <button className="pill" onClick={() => router.push("/pay/my-pay")}>Open My Pay</button>
        </div>
      </CardPad>

      <CardPad style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Pending entries</div>
            <div className="muted">Fix drafts, resubmit rejected, and wait for approvals.</div>
          </div>
          <div className="muted">{pendingCount ? `${pendingCount} pending` : "All clear ✅"}</div>
        </div>

        {busy ? (
          <div className="muted" style={{ marginTop: 10 }}>Loading…</div>
        ) : data?.pending_entries?.length ? (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.pending_entries.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.entry_date}</td>
                    <td>{r.project_name || r.project_id}</td>
                    <td>{Number(r.hours_worked || 0).toFixed(2)}</td>
                    <td>
                      <StatusChip
                        state={
                          r.status === "approved"
                            ? "approved"
                            : r.status === "submitted"
                              ? "submitted"
                              : r.status === "rejected"
                                ? "rejected"
                                : "draft"
                        }
                        label={String(r.status || "draft")}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 10 }}>No pending entries for this month.</div>
        )}
      </CardPad>

      <CardPad style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900 }}>Payout history</div>
            <div className="muted">Closed payroll runs that included you.</div>
          </div>
          <button className="pill" onClick={() => router.push("/reports/payroll")}>View payroll report</button>
        </div>

        {busy ? (
          <div className="muted" style={{ marginTop: 10 }}>Loading…</div>
        ) : data?.payout_history?.length ? (
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Hours</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.payout_history.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.period_start} → {r.period_end}</td>
                    <td>{Number(r.total_hours || 0).toFixed(2)}</td>
                    <td>{r.currency} ${money(r.total_amount || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 10 }}>No payouts yet.</div>
        )}
      </CardPad>
    </>
  );
}
