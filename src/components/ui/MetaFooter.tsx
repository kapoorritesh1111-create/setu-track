"use client";

import React from "react";

export type MetaItem = {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
};

export default function MetaFooter({
  left,
  right,
}: {
  left?: MetaItem[];
  right?: React.ReactNode;
}) {
  return (
    <div className="tsMetaLine">
      {(left ?? []).map((it) => (
        <span key={it.label} className="tsMetaItem">
          <span className="tsMetaLabel">{it.label}</span>
          <span className={"tsMetaValue" + (it.mono ? " tsMetaMono" : "")}>{it.value}</span>
        </span>
      ))}
      {right ? <span style={{ marginLeft: "auto" }}>{right}</span> : null}
    </div>
  );
}
