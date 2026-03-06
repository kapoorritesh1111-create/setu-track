"use client";

import { useEffect, useMemo, useState } from "react";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import { useProfile } from "../../../lib/useProfile";
import { supabase } from "../../../lib/supabaseBrowser";

// Keep types narrow so UI stays consistent.
type ThemeMode = "light" | "dark";
type Accent = "blue" | "indigo" | "emerald" | "rose" | "slate";
type Density = "comfortable" | "compact";
type Radius = "md" | "lg" | "xl";

type UiPrefs = {
  theme: ThemeMode;
  accent: Accent;
  density: Density;
  radius: Radius;
};

const DEFAULT_PREFS: UiPrefs = {
  theme: "light",
  accent: "blue",
  density: "comfortable",
  radius: "lg",
};

function isThemeMode(v: unknown): v is ThemeMode {
  return v === "light" || v === "dark";
}

function isAccent(v: unknown): v is Accent {
  return v === "blue" || v === "indigo" || v === "emerald" || v === "rose" || v === "slate";
}
function isDensity(v: unknown): v is Density {
  return v === "comfortable" || v === "compact";
}
function isRadius(v: unknown): v is Radius {
  return v === "md" || v === "lg" || v === "xl";
}

function readPrefs(raw: any): UiPrefs {
  const base: UiPrefs = { ...DEFAULT_PREFS };
  const p = raw?.ui_prefs;

  if (p && typeof p === "object") {
    if (isThemeMode(p.theme)) base.theme = p.theme;
    if (isAccent(p.accent)) base.accent = p.accent;
    if (isDensity(p.density)) base.density = p.density;
    if (isRadius(p.radius)) base.radius = p.radius;
    return base;
  }

  // fallback to localStorage if profile not ready yet
  try {
    const ls = localStorage.getItem("ts_theme_prefs");
    if (ls) {
      const parsed = JSON.parse(ls);
      if (isThemeMode(parsed.theme)) base.theme = parsed.theme;
      if (isAccent(parsed.accent)) base.accent = parsed.accent;
      if (isDensity(parsed.density)) base.density = parsed.density;
      if (isRadius(parsed.radius)) base.radius = parsed.radius;
    }
  } catch {}

  return base;
}

export default function AppearanceSettingsPage() {
  const { profile, refresh, loading: profLoading, error } = useProfile() as any;
  const profileAny = profile as any;

  const initialPrefs = useMemo(() => readPrefs(profileAny), [profileAny?.id, profileAny?.ui_prefs]);

  const [theme, setTheme] = useState<ThemeMode>(initialPrefs.theme);
  const [accent, setAccent] = useState<Accent>(initialPrefs.accent);
  const [density, setDensity] = useState<Density>(initialPrefs.density);
  const [radius, setRadius] = useState<Radius>(initialPrefs.radius);
  const [saving, setSaving] = useState(false);

  // IMPORTANT: when ui_prefs changes, update local state (refresh-safe)
  useEffect(() => {
    setTheme(initialPrefs.theme);
    setAccent(initialPrefs.accent);
    setDensity(initialPrefs.density);
    setRadius(initialPrefs.radius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileAny?.id, profileAny?.ui_prefs]);

  // Apply visual effects immediately (CSS hooks)
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
    document.documentElement.dataset.density = density;
    document.documentElement.dataset.radius = radius;

    try {
      localStorage.setItem("ts_theme_prefs", JSON.stringify({ theme, accent, density, radius }));
    } catch {}
  }, [theme, accent, density, radius]);

  async function save() {
    if (!profileAny?.id) return;
    setSaving(true);

    const ui_prefs: UiPrefs = { theme, accent, density, radius };

    const { error } = await supabase.from("profiles").update({ ui_prefs }).eq("id", profileAny.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    await refresh?.();
  }

  return (
    <RequireOnboarding>
      <AppShell title="Appearance" subtitle="Customize how SETU TRACK looks for you">
        <div className="card cardPad" style={{ maxWidth: 720 }}>
          {profLoading ? (
            <div className="alert alertInfo">Loading your profile…</div>
          ) : error ? (
            <div className="alert" style={{ borderColor: "rgba(220,38,38,0.35)" }}>
              {String(error)}
            </div>
          ) : null}

          <div className="muted" style={{ marginBottom: 10 }}>
            These settings are per-user.
          </div>

          <div style={{ marginBottom: 12 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
              Theme
            </div>
            <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeMode)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                Accent
              </div>
              <select value={accent} onChange={(e) => setAccent(e.target.value as Accent)}>
                <option value="blue">Blue</option>
                <option value="indigo">Indigo</option>
                <option value="emerald">Emerald</option>
                <option value="rose">Rose</option>
                <option value="slate">Slate</option>
              </select>
            </div>

            <div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                Density
              </div>
              <select value={density} onChange={(e) => setDensity(e.target.value as Density)}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
              Corner radius
            </div>
            <select value={radius} onChange={(e) => setRadius(e.target.value as Radius)}>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
              <option value="xl">Extra Large</option>
            </select>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <button className="btn btnPrimary" onClick={save} disabled={saving || profLoading}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </AppShell>
    </RequireOnboarding>
  );
}
