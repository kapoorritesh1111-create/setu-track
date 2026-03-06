"use client";

import { useEffect, useMemo, useState } from "react";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import { apiJson } from "../../../lib/api/client";
import { useProfile } from "../../../lib/useProfile";
import { CardPad } from "../../../components/ui/Card";

function toMonthStartISO(ym: string) {
  // ym: YYYY-MM
  if (!ym || !/^[0-9]{4}-[0-9]{2}$/.test(ym)) return "";
  return `${ym}-01`;
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

export default function MyPayPage() {
  const { loading, profile } = useProfile();
  const canView = profile?.role === "contractor";

  const now = new Date();
  const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [ym, setYm] = useState<string>(defaultYM);
  const startISO = useMemo(() => toMonthStartISO(ym), [ym]);
  const endISO = useMemo(() => (startISO ? monthEndISO(startISO) : ""), [startISO]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!canView || !startISO || !endISO) return;
      setBusy(true);
      setMsg("");
      try {
        const res = await apiJson<any>("/api/contractor/my-pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period_start: startISO, period_end: endISO }),
        });
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [canView, startISO, endISO]);

  return (
    <RequireOnboarding>
      <AppShell title="My Pay" subtitle="Clarity on earnings, approvals, and closed payouts">
        {loading ? <div className="card cardPad">Loading…</div> : null}
        {!loading && !canView ? (
          <div className="card cardPad">This page is for contractors.</div>
        ) : null}

        {!loading && canView ? (
          <>
            <div className="card cardPad" style={{ maxWidth: 1100 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800 }}>Month</div>
                <input
                  type="month"
                  value={ym}
                  onChange={(e) => setYm(e.target.value)}
                  className="input"
                  style={{ width: 180 }}
                />
                <div className="muted">
                  {startISO} → {endISO}
                </div>
              </div>
            </div>

            {msg ? (
              <div className="alert alertWarn" style={{ maxWidth: 1100 }}>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg}</pre>
              </div>
            ) : null}

            {busy ? (
              <div className="card cardPad" style={{ maxWidth: 1100 }}>
                Loading…
              </div>
            ) : null}

            {!busy && data?.ok ? (
              <div style={{ display: "grid", gap: 14, maxWidth: 1100 }}>
                <div className="dbKpis">
                  <div className="statCard">
                    <div className="statLabel">Approved hours</div>
                    <div className="statValue">{Number(data.totals?.approved_hours || 0).toFixed(2)} hrs</div>
                    <div className="statHint">Approved in this period</div>
                  </div>
                  <div className="statCard">
                    <div className="statLabel">Estimated pay</div>
                    <div className="statValue">${money(data.totals?.approved_amount || 0)}</div>
                    <div className="statHint">Approved hours × snapshot rate</div>
                  </div>
                  <div className="statCard">
                    <div className="statLabel">Pending entries</div>
                    <div className="statValue">{Number(data.totals?.pending_count || 0)}</div>
                    <div className="statHint">Submitted/draft/rejected</div>
                  </div>
                  <div className="statCard">
                    <div className="statLabel">Pending value</div>
                    <div className="statValue">${money(data.totals?.pending_amount || 0)}</div>
                    <div className="statHint">Not approved yet</div>
                  </div>
                </div>

                <CardPad>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 900 }}>Last closed payout</div>
                      <div className="muted">From latest closed payroll run</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 950 }}>
                      {data.last_closed ? `${data.last_closed.currency} $${money(data.last_closed.total_amount)}` : "—"}
                    </div>
                  </div>
                  {data.last_closed ? (
                    <div className="muted" style={{ marginTop: 8 }}>
                      {data.last_closed.period_start} → {data.last_closed.period_end} • {Number(data.last_closed.total_hours || 0).toFixed(2)} hrs
                    </div>
                  ) : (
                    <div className="muted" style={{ marginTop: 8 }}>No closed payroll yet.</div>
                  )}
                </CardPad>

                <CardPad>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>Pending entries</div>
                  {data.pending_entries?.length ? (
                    <div style={{ overflowX: "auto" }}>
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
                              <td>{r.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="muted">No pending entries for this period.</div>
                  )}
                </CardPad>

                <CardPad>
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>Payout history</div>
                  {data.payout_history?.length ? (
                    <div style={{ overflowX: "auto" }}>
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
                    <div className="muted">No payout history yet.</div>
                  )}
                </CardPad>
              </div>
            ) : null}
          </>
        ) : null}
      </AppShell>
    </RequireOnboarding>
  );
}
