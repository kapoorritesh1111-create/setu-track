"use client";

import { ReactNode, useMemo } from "react";
import { statusLabel, statusTone } from "../../lib/status";

export type StatusChipState =
  | "open"
  | "locked"
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "paid"
  | string;

/**
 * StatusChip
 * Deel-like calm pill used everywhere for workflow state.
 *
 * Back-compat: accepts either `status` or `state`.
 */
export function StatusChip({
  status,
  state,
  label,
  right,
  className = "",
}: {
  status?: StatusChipState;
  state?: StatusChipState;
  label?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  const s = (status ?? state ?? "open") as StatusChipState;

  const tone = useMemo(() => statusTone(String(s)), [s]);
  const text = label ?? statusLabel(String(s));

  return (
    <span className={`tsChip ${className}`.trim()} data-tone={tone}>
      <span className="tsChipDot" aria-hidden="true" />
      <span className="tsChipText">{text}</span>
      {right ? <span className="tsChipRight">{right}</span> : null}
    </span>
  );
}
