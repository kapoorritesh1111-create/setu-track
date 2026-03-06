"use client";

import * as React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, disabled, icon, children, ...props },
  ref
) {
  const v =
    variant === "primary"
      ? "btn btnPrimary"
      : variant === "secondary"
        ? "btn btnSecondary"
        : variant === "danger"
          ? "btn btnDanger"
          : "btn btnGhost";

  const s = size === "sm" ? "btnSm" : "btnMd";

  return (
    <button
      ref={ref}
      className={cx(v, s, loading && "btnLoading", className)}
      disabled={disabled || loading}
      {...props}
    >
      {icon ? <span className="btnIcon">{icon}</span> : null}
      <span className="btnLabel">{children}</span>
    </button>
  );
});

export { Button };
export default Button;
