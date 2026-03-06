"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import AppShell from "../../../../../components/layout/AppShell";
import { supabase } from "../../../../../lib/supabaseBrowser";
import { StatusChip } from "../../../../../components/ui/StatusChip";

type Row = {
  entry_date: string;
  project_id: string | null;
  project_name: string | null;
  notes: string | null;
  status: string | null;
  hours_worked: number | null;
  hourly_rate_snapshot: number | null;
};

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDateShort(iso: string) {
  // iso: YYYY-MM-DD
  const s = String(iso || "");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

function fmtMoney(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function PrintClient() {
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();

  const contractorId = String(params?.id || "");
  const start = sp.get("start") || sp.get("period_start") || "";
  const end = sp.get("end") || sp.get("period_end") || "";
  const projectId = sp.get("project_id") || "";
  const status = sp.get("status") || "approved";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [contractorName, setContractorName] = useState<string>("(contractor)");
  const [projectName, setProjectName] = useState<string>(projectId ? "(project)" : "All");
  const [viewerName, setViewerName] = useState<string | null>(null);
  const [didAutoPrint, setDidAutoPrint] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // Contractor name
        const p = await supabase.from("profiles").select("full_name").eq("id", contractorId).maybeSingle();
        if (!p.error && p.data?.full_name) setContractorName(p.data.full_name);

        // Viewer (who is exporting)
        const u = await supabase.auth.getUser();
        const uid = u.data?.user?.id;
        if (uid) {
          const vp = await supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle();
          if (!vp.error && vp.data?.full_name) setViewerName(vp.data.full_name);
        }

        if (projectId) {
          const proj = await supabase.from("projects").select("name").eq("id", projectId).maybeSingle();
          if (!proj.error && proj.data?.name) setProjectName(proj.data.name);
        }

        let q = supabase
          .from("v_time_entries")
          .select("entry_date,project_id,project_name,notes,status,hours_worked,hourly_rate_snapshot")
          .eq("user_id", contractorId);

        if (start) q = q.gte("entry_date", start);
        if (end) q = q.lte("entry_date", end);
        if (projectId) q = q.eq("project_id", projectId);
        if (status) q = q.eq("status", status);

        const r = await q.order("entry_date", { ascending: true });
        if (r.error) throw new Error(r.error.message);

        if (!alive) return;
        setRows((r.data as any) || []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load report");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [contractorId, start, end, projectId, status]);

  const totals = useMemo(() => {
    let hours = 0;
    let pay = 0;
    const rates = new Set<number>();
    for (const r of rows) {
      const h = safeNum(r.hours_worked);
      const rate = safeNum(r.hourly_rate_snapshot);
      hours += h;
      pay += h * rate;
      if (rate > 0) rates.add(Math.round(rate * 100) / 100);
    }
    const uniqueRates = Array.from(rates.values()).sort((a, b) => a - b);
    const rateLabel = uniqueRates.length === 1 ? fmtMoney(uniqueRates[0]) : uniqueRates.length > 1 ? "Snapshot rates" : "—";
    return {
      hours: Math.round(hours * 100) / 100,
      pay: Math.round(pay * 100) / 100,
      rateLabel,
    };
  }, [rows]);

  const metaLeft = useMemo(
    () => [
      { label: "Project", value: projectName || "All" },
      { label: "Contractor", value: contractorName },
      { label: "Month start", value: start ? fmtDateShort(start) : "—", mono: true },
      { label: "End date", value: end ? fmtDateShort(end) : "—", mono: true },
      { label: "Pay rate", value: totals.rateLabel, mono: true },
      { label: "Total pay", value: fmtMoney(totals.pay), mono: true },
    ],
    [projectName, contractorName, start, end, totals.rateLabel, totals.pay]
  );

  return (
    <AppShell
      title="Payroll report"
      subtitle="Contractor-facing, client-grade export view"
      right={
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => window.print()}>
            Export PDF
          </button>
        </div>
      }
    >
      <div className="card" style={{ padding: 16 }}>
        <div className="tsMetaLine">
          {metaLeft.map((m) => (
            <div key={m.label} className="tsMetaItem">
              <div className="tsMetaLabel">{m.label}</div>
              <div className={m.mono ? "tsMetaValue tsMetaMono" : "tsMetaValue"}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="tableWrap">
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 140 }}>Date</th>
                <th>Project</th>
                <th style={{ width: 110, textAlign: "right" }}>Total hours</th>
                <th style={{ width: 110, textAlign: "right" }}>Rate</th>
                <th style={{ width: 120, textAlign: "right" }}>Total pay</th>
                <th>Notes</th>
                <th style={{ width: 120 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 16 }}>
                    Loading…
                  </td>
                </tr>
              ) : err ? (
                <tr>
                  <td colSpan={7} style={{ padding: 16, color: "var(--danger)" }}>
                    {err}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 16 }}>
                    No rows for this range.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const hours = safeNum(r.hours_worked);
                  const rate = safeNum(r.hourly_rate_snapshot);
                  const pay = Math.round(hours * rate * 100) / 100;
                  return (
                    <tr key={`${r.entry_date}-${i}`}>
                      <td className="mono">{fmtDateShort(r.entry_date)}</td>
                      <td>{r.project_name || "—"}</td>
                      <td className="mono" style={{ textAlign: "right" }}>
                        {hours.toFixed(2)}
                      </td>
                      <td className="mono" style={{ textAlign: "right" }}>
                        {fmtMoney(rate)}
                      </td>
                      <td className="mono" style={{ textAlign: "right" }}>
                        {fmtMoney(pay)}
                      </td>
                      <td>{r.notes || ""}</td>
                      <td>
                        <StatusChip status={r.status || ""} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print-only footer */}
      <div className="printOnly" style={{ marginTop: 16, color: "var(--muted)" }}>
        Generated by {viewerName || "SETU TRACK"} • Contractor-first Payroll Command Platform
      </div>
    </AppShell>
  );
}
