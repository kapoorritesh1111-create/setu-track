"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useProfile } from "../../lib/useProfile";
import { supabase } from "../../lib/supabaseBrowser";
import { darkenHex, isHexColor } from "../../lib/color";

/**
 * Theme prefs schema stored in profiles.ui_prefs (jsonb)
 * NOTE (Phase-3): Brand accent comes from org_settings (admin-managed).
 */
type Mode = "light" | "dark";
type Density = "comfortable" | "compact";
type Radius = "md" | "lg" | "xl";

// Accent presets supported by globals.css
type AccentPreset = "blue" | "indigo" | "emerald" | "rose" | "slate" | "custom";

export type UiPrefs = {
  theme: Mode;
  density: Density;
  radius: Radius;
  // legacy; kept for backward compatibility, but ignored for brand consistency
  accent?: string;
};

type OrgSettings = {
  org_id: string;
  company_name: string;
  legal_name: string;
  logo_url: string | null;
  accent_color: string; // preset key or hex
  invoice_header_json: any;
  invoice_footer_text: string;
  default_currency: string;
};

const DEFAULT_PREFS: UiPrefs = {
  theme: "light",
  density: "comfortable",
  radius: "lg",
};

function isMode(v: unknown): v is Mode {
  return v === "light" || v === "dark";
}
function isDensity(v: unknown): v is Density {
  return v === "comfortable" || v === "compact";
}
function isRadius(v: unknown): v is Radius {
  return v === "md" || v === "lg" || v === "xl";
}

function normalizePrefs(v: any): UiPrefs {
  const out: UiPrefs = { ...DEFAULT_PREFS };
  if (v && typeof v === "object") {
    if (isMode(v.theme)) out.theme = v.theme;
    if (isDensity(v.density)) out.density = v.density;
    if (isRadius(v.radius)) out.radius = v.radius;
    if (typeof v.accent === "string") out.accent = v.accent;
  }
  return out;
}

function normalizeOrgAccent(accentColor: string): { kind: AccentPreset; hex?: string } {
  const v = (accentColor || "").trim().toLowerCase();
  if (v === "blue" || v === "indigo" || v === "emerald" || v === "rose" || v === "slate") {
    return { kind: v };
  }
  if (isHexColor(v)) return { kind: "custom", hex: v };
  return { kind: "blue" };
}

async function fetchOrgSettings(accessToken: string): Promise<OrgSettings | null> {
  const res = await fetch("/api/org-settings", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return json?.settings ?? null;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const [org, setOrg] = useState<OrgSettings | null>(null);

  // pull org settings (branding tokens) once authenticated
  useEffect(() => {
    let alive = true;

    (async () => {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) return;

      const settings = await fetchOrgSettings(session.access_token);
      if (!alive) return;
      setOrg(settings);
    })();

    return () => {
      alive = false;
    };
  }, [profile?.org_id]);

  const prefs = useMemo(() => normalizePrefs(profile?.ui_prefs), [profile?.ui_prefs]);

  useEffect(() => {
    const root = document.documentElement;

    // Theme + density + radius remain user prefs
    root.dataset.theme = prefs.theme;
    root.dataset.density = prefs.density;
    root.dataset.radius = prefs.radius;

    // Accent is org-controlled
    const orgAccent = normalizeOrgAccent(org?.accent_color || "blue");
    root.dataset.accent = orgAccent.kind;

    // Apply custom brand color when needed
    if (orgAccent.kind === "custom" && orgAccent.hex) {
      root.style.setProperty("--primary", orgAccent.hex);
      root.style.setProperty("--primary-600", darkenHex(orgAccent.hex, 0.12));
      root.style.setProperty("--primary-soft", `${orgAccent.hex}1A`); // ~10% alpha
      root.style.setProperty("--primary-ring", `${orgAccent.hex}29`); // ~16% alpha
    } else {
      // clear any prior custom overrides
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-600");
      root.style.removeProperty("--primary-soft");
      root.style.removeProperty("--primary-ring");
    }

    // org metadata for UI (optional; safe)
    if (org?.company_name) root.style.setProperty("--org-company", JSON.stringify(org.company_name));
  }, [prefs.theme, prefs.density, prefs.radius, org?.accent_color, org?.company_name]);

  return <>{children}</>;
}
