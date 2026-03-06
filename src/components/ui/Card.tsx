"use client";

import type { ReactNode, HTMLAttributes } from "react";

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const clickable = typeof onClick === "function";
  return (
    <div
      className={`card ${clickable ? "cardClickable" : ""} ${className}`.trim()}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {children}
    </div>
  );
}

export function CardPad(
  {
    children,
    className = "",
    style,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }
) {
  return (
    <div className={`card cardPad ${className}`.trim()} style={style} {...rest}>
      {children}
    </div>
  );
}
