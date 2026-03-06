"use client";

import { ReactNode } from "react";
import { CardPad } from "./Card";

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <CardPad>
      <div style={{ fontWeight: 950 }}>{title}</div>
      {description ? <div className="muted" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{description}</div> : null}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </CardPad>
  );
}
