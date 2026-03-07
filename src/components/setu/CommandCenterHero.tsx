"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "../../lib/api/client";
import { useProfile } from "../../lib/useProfile";

type OverviewPayload = {
  ok: true;
  metrics: {
    active_contractors: number;
    hours_logged: number;
    approved_hours: number;
    approvals_pending: number;
    payroll_ready: number;
    current_payroll_total: number;
    currency: string;
  };
  watchlist: Array<{
    project_id: string;
    project_name: string;
    payroll_cost: number;
    budget_amount: number;
    remaining_budget: number;
    risk: string;
    currency: string;
  }>;
};

type MetricTone = "teal" | "blue" | "violet" | "amber";

function toneClass(tone?: MetricTone) {
  return tone ? `setu-tone-${tone}` : "setu-tone-blue";
}

function watchToneClass(risk?: string) {
  if (risk === "healthy") return "pill ok";
  if (risk === "watch") return "pill";
  if (risk === "high") return "pill warn";
  if (risk === "over") return "pill pillError";
  return "pill";
}

function money(amount: number, currency = "USD") {
  return `${currency} ${Number(amount || 0).toFixed(0)}`;
}

export default function CommandCenterHero() {
  const router = useRouter();
  const { profile } = useProfile() as any;
  const [data, setData] = useState<OverviewPayload | null>(null);

  const role = profile?.role || "contractor";
  const canLoadOverview = role === "admin" || role === "manager";

  useEffect(() => {
    let cancelled = false;
    if (!canLoadOverview) return;
    (async () => {
      try {
        const json = await apiJson<OverviewPayload>("/api/dashboard/overview");
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canLoadOverview]);

  const metrics = useMemo(() => {
    if (!data) {
      return [
        { label: "Active contractors", value: "—", hint: "Loading live org metrics", tone: "blue" as MetricTone },
        { label: "Hours logged", value: "—", hint: "Current operational window", tone: "teal" as MetricTone },
        { label: "Payroll ready", value: "—", hint: "Approved and exportable", tone: "teal" as MetricTone },
        { label: "Approvals pending", value: "—", hint: "Needs manager attention", tone: "violet" as MetricTone },
      ];
    }

    return [
      { label: "Active contractors", value: String(data.metrics.active_contractors), hint: `${data.metrics.approved_hours.toFixed(2)} approved hours`, tone: "blue" as MetricTone },
      { label: "Hours logged", value: `${data.metrics.hours_logged.toFixed(2)}h`, hint: "Current month operational window", tone: "teal" as MetricTone },
      { label: "Payroll ready", value: money(data.metrics.payroll_ready, data.metrics.currency), hint: "Approved and exportable", tone: "teal" as MetricTone },
      { label: "Approvals pending", value: String(data.metrics.approvals_pending), hint: "Manager action queue", tone: "violet" as MetricTone },
    ];
  }, [data]);

  const watchlist = data?.watchlist?.length
    ? data.watchlist.map((item) => ({
        title: item.project_name,
        meta: item.budget_amount ? `${Math.max(0, Math.round((item.payroll_cost / item.budget_amount) * 100))}% budget used` : "Budget not tracked",
        status: item.risk === "healthy" ? "Healthy" : item.risk === "watch" ? "Watching" : item.risk === "high" ? "At risk" : item.risk === "over" ? "Over budget" : "Untracked",
        tone: item.risk,
      }))
    : [
        { title: "Project watchlist", meta: "Budget and payroll watchlist will populate here", status: "Monitoring", tone: "watch" },
      ];

  return (
    <section className="setuCommandCenter">
      <div className="setuHeroPanel">
        <div className="setuHeroHeader">
          <div>
            <div className="setuEyebrow">SETU command center</div>
            <h2 className="setuHeroTitle">Connect work, payroll, and growth in one finance-grade workspace.</h2>
            <p className="setuHeroCopy">
              Operational status, payroll readiness, project budget health, and next actions now sit in one command surface.
            </p>
          </div>

          <div className="setuHeroActions">
            <button className="btn btnPrimary" onClick={() => router.push("/reports/payroll")}>Open payroll</button>
            <button className="btn btnSecondary" onClick={() => router.push("/projects")}>Review projects</button>
          </div>
        </div>

        <div className="setuHeroMetrics">
          {metrics.map((metric) => (
            <article key={metric.label} className={`setuHeroMetric ${toneClass(metric.tone)}`}>
              <div className="setuHeroMetricLabel">{metric.label}</div>
              <div className="setuHeroMetricValue">{metric.value}</div>
              <div className="setuHeroMetricHint">{metric.hint}</div>
            </article>
          ))}
        </div>
      </div>

      <aside className="setuWatchPanel">
        <div className="setuWatchHeader">
          <div>
            <div className="setuEyebrow">Executive watchlist</div>
            <h3 className="setuWatchTitle">Budget and workflow attention areas</h3>
          </div>
          <button className="btn btnGhost btnSm" onClick={() => router.push("/analytics")}>Open analytics</button>
        </div>

        <div className="setuWatchList">
          {watchlist.map((item) => (
            <div key={item.title} className="setuWatchItem">
              <div>
                <div className="setuWatchItemTitle">{item.title}</div>
                <div className="setuWatchItemMeta">{item.meta}</div>
              </div>
              <span className={watchToneClass(item.tone)}>{item.status}</span>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}
