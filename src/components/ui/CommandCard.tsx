"use client";

import React from "react";

export function CommandCard({
  title,
  subtitle,
  right,
  footer,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card tsCommandCard ${className}`.trim()}>
      <div className="tsCommandHead">
        <div>
          <div className="tsCommandTitle">{title}</div>
          {subtitle ? <div className="tsCommandSub">{subtitle}</div> : null}
        </div>
        {right ? <div className="tsCommandRight">{right}</div> : null}
      </div>

      <div className="cardPad tsCommandBody">{children}</div>

      {footer ? <div className="tsCommandFoot">{footer}</div> : null}
    </div>
  );
}
