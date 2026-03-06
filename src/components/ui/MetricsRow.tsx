"use client";

import { ReactNode } from "react";

/**
 * MetricsRow
 * Responsive grid wrapper for KPI cards (StatCard).
 */
export function MetricsRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`tsMetricsRow ${className}`.trim()}>{children}</div>;
}
