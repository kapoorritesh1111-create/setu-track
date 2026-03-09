"use client";

import { ReactNode } from "react";
import AppShell from "./AppShell";

export default function SetuPage({
  title,
  subtitle,
  right,
  toolbar,
  metrics,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  toolbar?: ReactNode;
  metrics?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppShell title={title} subtitle={subtitle} right={right}>
      <div className="setuPageStack">
        {toolbar ? <div className="setuPageToolbar">{toolbar}</div> : null}
        {metrics ? <div className="setuPageMetrics">{metrics}</div> : null}
        {children}
      </div>
    </AppShell>
  );
}
