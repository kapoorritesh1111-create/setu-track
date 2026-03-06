"use client";

import { ReactNode } from "react";
import { MetricsRow } from "./MetricsRow";

/**
 * SummaryBar
 * Standard executive metrics row placed directly under AppShell's page header.
 * Wrap your <StatCard/> components inside.
 */
export function SummaryBar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`tsSummaryBar ${className}`.trim()}>
      <MetricsRow className="tsSummaryBarRow">{children}</MetricsRow>
    </div>
  );
}
