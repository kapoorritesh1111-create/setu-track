"use client";

import { ReactNode } from "react";

export function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, margin: "18px 0 10px" }}>
      <div>
        <div style={{ fontWeight: 950, fontSize: 16 }}>{title}</div>
        {subtitle ? <div className="muted" style={{ marginTop: 2 }}>{subtitle}</div> : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}
