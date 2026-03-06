"use client";

import React from "react";

type Item = {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
};

export function TrustBlock({
  title = "Trust & audit",
  subtitle,
  items,
  tone = "neutral",
  right,
}: {
  title?: string;
  subtitle?: string;
  items: Item[];
  tone?: "neutral" | "warn";
  right?: React.ReactNode;
}) {
  return (
    <div className={`tsTrust ${tone === "warn" ? "tsTrustWarn" : ""}`.trim()}>
      <div className="tsTrustTop">
        <div>
          <div className="tsTrustTitle">{title}</div>
          {subtitle ? <div className="tsTrustSub">{subtitle}</div> : null}
        </div>
        {right ? <div className="tsTrustRight">{right}</div> : null}
      </div>

      <div className="tsTrustGrid">
        {items.map((it) => (
          <div key={it.label} className="tsTrustItem">
            <div className="tsTrustLabel">{it.label}</div>
            <div className={`tsTrustValue ${it.mono ? "mono" : ""}`.trim()}>{it.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
