"use client";

import { ReactNode } from "react";
import { CardPad } from "./Card";

export function StatCard({
  label,
  value,
  hint,
  right,
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <CardPad className={`dbKpi ${className}`.trim()}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div className="dbKpiLabel">{label}</div>
          <div className="dbKpiValue">{value}</div>
          {hint ? <div className="muted dbKpiHint">{hint}</div> : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
    </CardPad>
  );
}
