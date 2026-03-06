"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";

type Snapshot = {
  users_total: number;
  users_active: number;
  contractors_active: number;
  projects_total: number;
  projects_active: number;
  hours_month: number;
  pending_invites: number;
};

function startOfMonthDate(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfNextMonthDate(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

function isoDateOnly(dt: Date) {
  // YYYY-MM-DD
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseTimeToMinutes(t: string | null) {
  // Supabase returns TIME as "HH:MM:SS" typically
  if (!t) return null;
  const parts = t.split(":").map((x) => Number(x));
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  const hh = parts[0] ?? 0;
  const mm = parts[1] ?? 0;
  return hh * 60 + mm;
}

export default function OrgSnapshot() {
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [msg, setMsg] = useState("");

  const monthLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, []);

  useEffect(() => {
    if (!profile?.org_id || !isAdmin) return;

    let cancelled = false;

    (async () => {
      setMsg("");
      try {
        // 1) Users (profiles)
        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("id, role, is_active")
          .eq("org_id", profile.org_id);

        if (profErr) throw profErr;

        const users_total = (profs ?? []).length;
        const users_active = (profs ?? []).filter((p: any) => p.is_active).length;
        const contractors_active = (profs ?? []).filter(
          (p: any) => p.is_active && p.role === "contractor"
        ).length;

        // 2) Projects
        const { data: projs, error: projErr } = await supabase
          .from("projects")
          .select("id, is_active")
          .eq("org_id", profile.org_id);

        if (projErr) throw projErr;

        const projects_total = (projs ?? []).length;
        const projects_active = (projs ?? []).filter((p: any) => p.is_active).length;

        // 3) Hours this month (computed from time_in/time_out - lunch_hours)
        const fromD = startOfMonthDate();
        const toD = startOfNextMonthDate();
        const from = isoDateOnly(fromD);
        const to = isoDateOnly(toD);

        const { data: entries, error: teErr } = await supabase
          .from("time_entries")
          .select("entry_date, time_in, time_out, lunch_hours")
          .eq("org_id", profile.org_id)
          .gte("entry_date", from)
          .lt("entry_date", to);

        if (teErr) throw teErr;

        const hours_month =
          (entries ?? []).reduce((acc: number, r: any) => {
            const tin = parseTimeToMinutes(r.time_in ?? null);
            const tout = parseTimeToMinutes(r.time_out ?? null);
            if (tin == null || tout == null) return acc;

            // Handle overnight just in case
            let minutes = tout - tin;
            if (minutes < 0) minutes += 24 * 60;

            const lunch = Number(r.lunch_hours ?? 0);
            const computed = Math.max(0, minutes / 60 - lunch);

            return acc + computed;
          }, 0) || 0;

        // 4) Pending invites via admin API
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        let pending_invites = 0;
        if (token) {
          const res = await fetch("/api/admin/invitations", {
            headers: { authorization: `Bearer ${token}` },
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.ok) {
            pending_invites = (json.users ?? []).filter((u: any) => u.status === "pending").length;
          }
        }

        if (cancelled) return;

        setSnap({
          users_total,
          users_active,
          contractors_active,
          projects_total,
          projects_active,
          hours_month,
          pending_invites,
        });
      } catch (e: any) {
        if (cancelled) return;
        setMsg(e?.message || "Failed to load snapshot");
        setSnap(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.org_id, isAdmin]);

  if (!isAdmin) return null;

  return (
    <div className="card cardPad" style={{ maxWidth: 980, marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Org snapshot</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Quick health metrics • {monthLabel}
          </div>
        </div>
        {snap ? <span className="tag tagOk">Live</span> : <span className="tag tagMuted">—</span>}
      </div>

      {msg ? (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.06)",
            fontSize: 13,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <Kpi title="Users" value={snap?.users_total ?? "—"} sub={`${snap?.users_active ?? "—"} active`} />
        <Kpi title="Contractors" value={snap?.contractors_active ?? "—"} sub="active" />
        <Kpi title="Projects" value={snap?.projects_total ?? "—"} sub={`${snap?.projects_active ?? "—"} active`} />
        <Kpi title="Pending invites" value={snap?.pending_invites ?? "—"} sub="Auth invites" />
      </div>

      <div style={{ marginTop: 12 }}>
        <KpiWide title="Hours this month" value={snap ? snap.hours_month.toFixed(2) : "—"} sub="Computed from time_in/time_out minus lunch_hours" />
      </div>
    </div>
  );
}

function Kpi({ title, value, sub }: { title: string; value: any; sub: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div className="muted" style={{ fontSize: 12 }}>{title}</div>
      <div style={{ fontWeight: 950, fontSize: 22, marginTop: 6 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function KpiWide({ title, value, sub }: { title: string; value: any; sub: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>{title}</div>
          <div style={{ fontWeight: 950, fontSize: 26, marginTop: 6 }}>{value}</div>
        </div>
        <span className="tag tagMuted">This month</span>
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>{sub}</div>
    </div>
  );
}
