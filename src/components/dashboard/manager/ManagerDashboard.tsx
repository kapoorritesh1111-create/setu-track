"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseBrowser";
import { CardPad } from "../../ui/Card";
import { StatCard } from "../../ui/StatCard";
import { presetToRange } from "../../../lib/dateRanges";
import { MetricsRow } from "../../ui/MetricsRow";

export default function ManagerDashboard({ orgId, userId }: { orgId: string; userId: string }) {
  const router = useRouter();

  const range = useMemo(() => presetToRange("current_month", "sunday"), []);
  const [pending, setPending] = useState(0);
  const [approvedHours, setApprovedHours] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMsg("");
      try {
        const { data: p, error: pErr } = await supabase
          .from("v_time_entries")
          .select("id")
          .eq("org_id", orgId)
          .eq("status", "submitted");
        if (!cancelled) {
          if (pErr) throw pErr;
          setPending(((p as any) ?? [])?.length ?? 0);
        }

        const { data: a, error: aErr } = await supabase
          .from("v_time_entries")
          .select("hours_worked")
          .eq("org_id", orgId)
          .gte("entry_date", range.start)
          .lte("entry_date", range.end)
          .eq("status", "approved");
        if (!cancelled) {
          if (aErr) throw aErr;
          const sum = (((a as any) ?? []) as any[]).reduce((acc, r) => acc + Number(r.hours_worked ?? 0), 0);
          setApprovedHours(sum);
        }
      } catch (e: any) {
        if (!cancelled) setMsg(e?.message || "Failed to load manager dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, range.start, range.end]);

  return (
    <>
      {msg ? (
        <div className="alert alertInfo">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg}</pre>
        </div>
      ) : null}

      <MetricsRow>
        <StatCard label="Pending approvals" value={pending} hint="Submitted entries" />
        <StatCard label="Approved hours" value={`${approvedHours.toFixed(2)} hrs`} hint={`${range.start} → ${range.end}`} />
      </MetricsRow>

      <CardPad className="dbPayCard" style={{ marginTop: 14 } as any}>
        <div className="dbPayHeader">
          <div>
            <div className="dbPayTitle">Quick actions</div>
            <div className="muted">Approve time and run payroll reports</div>
          </div>
          <div className="dbPayValue">Ready</div>
        </div>

        <div className="dbQuickGrid">
          <button className="dbQuickBtn" onClick={() => router.push("/approvals")}>Approvals<span className="muted">Review submissions</span></button>
          <button className="dbQuickBtn" onClick={() => router.push("/reports/payroll")}>Payroll<span className="muted">View reports</span></button>
          <button className="dbQuickBtn" onClick={() => router.push("/projects")}>Projects<span className="muted">Workstreams</span></button>
        </div>
      </CardPad>
    </>
  );
}
