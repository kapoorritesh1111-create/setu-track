"use client";

import { MoreHorizontal } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

export type ActionMenuItem = {
  label: string;
  href?: string;
  onSelect?: () => void | Promise<void>;
  danger?: boolean;
  disabled?: boolean;
};

function stop(e: React.SyntheticEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/**
 * Lightweight kebab menu aligned with DataTable menu styles.
 * Use this to reduce button noise and match Deel-like progressive disclosure.
 */
export default function ActionMenu({
  items,
  ariaLabel = "Actions",
  trigger = "icon",
  triggerLabel = "",
}: {
  items: ActionMenuItem[];
  ariaLabel?: string;
  trigger?: "icon" | "pill";
  triggerLabel?: string;
}) {
  const hasAnyEnabled = useMemo(() => items.some((i) => !i.disabled), [items]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  if (!hasAnyEnabled) return null;

  return (
    <div ref={ref} className="mwActionsWrap" onClick={(e) => stop(e as any)}>
      {trigger === "pill" ? (
        <button className="pill" type="button" aria-label={ariaLabel} onClick={() => setOpen((v) => !v)}>
          {triggerLabel || "Actions"}
          <span style={{ display: "inline-flex", marginLeft: 8, opacity: 0.8 }}>
            <MoreHorizontal size={16} />
          </span>
        </button>
      ) : (
        <button className="iconBtn" type="button" aria-label={ariaLabel} onClick={() => setOpen((v) => !v)}>
          <MoreHorizontal size={18} />
        </button>
      )}

      {open ? (
        <div className="mwMenu" role="menu">
          {items.map((it) => {
            const cls = "mwMenuItem" + (it.danger ? " mwMenuItemDanger" : "");
            if (it.href) {
              if (it.disabled) {
                return (
                  <span key={it.label} className={cls} style={{ opacity: 0.5, cursor: "not-allowed" }}>
                    {it.label}
                  </span>
                );
              }
              return (
                <a
                  key={it.label}
                  className={cls}
                  href={it.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  {it.label}
                </a>
              );
            }

            return (
              <button
                key={it.label}
                type="button"
                className={cls}
                disabled={it.disabled}
                onClick={async () => {
                  try {
                    setOpen(false);
                    await it.onSelect?.();
                  } catch {
                    // callers handle errors
                  }
                }}
                role="menuitem"
              >
                {it.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
