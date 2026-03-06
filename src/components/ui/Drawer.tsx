"use client";

import { ReactNode, useEffect, useMemo, useRef } from "react";
import { X } from "lucide-react";

export type DrawerTab = { key: string; label: string; count?: number };

export default function Drawer(props: {
  open: boolean;
  onClose: () => void;

  title: string;
  subtitle?: string;

  tabs?: DrawerTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;

  headerRight?: ReactNode;

  children: ReactNode;

  footer?: ReactNode;

  width?: number | string; // default 560px / 92vw
}) {
  const w = props.width ?? "min(560px, 92vw)";
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Escape to close
  useEffect(() => {
    if (!props.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  // Focus trap-lite: focus overlay so screen readers announce dialog quickly
  useEffect(() => {
    if (!props.open) return;
    overlayRef.current?.focus?.();
  }, [props.open]);

  const hasTabs = (props.tabs?.length ?? 0) > 0 && !!props.onTabChange;

  const tabNodes = useMemo(() => {
    if (!hasTabs || !props.tabs) return null;
    return (
      <div className="mwDrawerTabs" role="tablist" aria-label="Drawer tabs">
        {props.tabs.map((t) => {
          const active = (props.activeTab ?? props.tabs?.[0]?.key) === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={"mwDrawerTab" + (active ? " mwDrawerTabActive" : "")}
              onClick={() => props.onTabChange?.(t.key)}
            >
              <span>{t.label}</span>
              {typeof t.count === "number" ? <span className="mwDrawerTabCount">{t.count}</span> : null}
            </button>
          );
        })}
      </div>
    );
  }, [hasTabs, props.tabs, props.activeTab, props.onTabChange]);

  if (!props.open) return null;

  return (
    <>
      <div
        ref={overlayRef}
        tabIndex={-1}
        className="mwPanelOverlay"
        onClick={props.onClose}
        aria-hidden="true"
      />

      <aside
        className="mwPanel"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        style={{ width: w }}
      >
        <div className="mwPanelHeader">
          <div style={{ minWidth: 0 }}>
            <div className="mwPanelTitle">{props.title}</div>
            {props.subtitle ? <div className="mwPanelSubtitle">{props.subtitle}</div> : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {props.headerRight}
            <button className="iconBtn" onClick={props.onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {tabNodes}

        <div className="mwPanelBody">{props.children}</div>

        {props.footer ? <div className="mwPanelFooter">{props.footer}</div> : null}
      </aside>
    </>
  );
}
