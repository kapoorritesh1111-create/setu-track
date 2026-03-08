"use client";

import { useEffect, useMemo, useState } from "react";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import AdminTabs from "../../../components/admin/AdminTabs";
import { supabase } from "../../../lib/supabaseBrowser";
import { useProfile } from "../../../lib/useProfile";

type OrgSettings = {
  org_id: string;
  company_name: string;
  legal_name: string;
  logo_url: string | null;
  accent_color: string;
  invoice_header_json: Record<string, any>;
  invoice_footer_text: string;
  default_currency: string;
};

const DEFAULTS: OrgSettings = {
  org_id: "",
  company_name: "",
  legal_name: "",
  logo_url: null,
  accent_color: "blue",
  invoice_header_json: {},
  invoice_footer_text: "",
  default_currency: "USD",
};

function toStr(v: any) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

export default function AdminOrgSettingsPage() {
  const { profile } = useProfile() as any;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<OrgSettings>(DEFAULTS);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);

      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) {
        setError("Missing session. Please log in again.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/admin/org-settings", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });

      const json = await res.json().catch(() => ({}));
      if (!alive) return;

      if (!res.ok) {
        setError(json?.error || "Failed to load org settings.");
        setLoading(false);
        return;
      }

      setSettings((prev) => ({ ...prev, ...(json.settings || {}) }));
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const header = settings.invoice_header_json || {};
  const headerFields = useMemo(() => {
    return {
      address: toStr(header.address),
      tax_id: toStr(header.tax_id),
      phone: toStr(header.phone),
      email: toStr(header.email),
      website: toStr(header.website),
    };
  }, [settings.invoice_header_json]);

  async function save() {
    setSaving(true);
    setError(null);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) throw new Error("Missing session.");

      const res = await fetch("/api/admin/org-settings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ settings }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Save failed.");

      setSettings((prev) => ({ ...prev, ...(json.settings || {}) }));
    } catch (e: any) {
      setError(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <RequireOnboarding>
        <AppShell title="Org Settings" subtitle="Admin only">
          <div className="card cardPad" style={{ maxWidth: 980 }}>
            <div className="h2">Access denied</div>
            <div className="muted">Only admins can edit organization settings.</div>
          </div>
        </AppShell>
      </RequireOnboarding>
    );
  }

  return (
    <RequireOnboarding>
      <AppShell title="Organization Settings" subtitle="Branding + invoice defaults">
        <AdminTabs active="org-settings" />

        {error && (
          <div className="card cardPad" style={{ maxWidth: 980, borderColor: "rgba(220,38,38,0.35)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="h3">Error</div>
                <div className="muted">{error}</div>
              </div>
            </div>
          </div>
        )}

        <div className="card cardPad" style={{ maxWidth: 980 }}>
          <div className="h2">Company</div>
          <div className="muted" style={{ marginTop: 4 }}>
            Used for invoices and client-facing exports.
          </div>

          <div className="mwForm" style={{ marginTop: 14 }}>
            <div className="mwField">
              <div className="mwLabel">Company name</div>
              <input
                className="input"
                value={settings.company_name || ""}
                onChange={(e) => setSettings((s) => ({ ...s, company_name: e.target.value }))}
                placeholder="SETU GROUPS"
              />
            </div>

            <div className="mwField">
              <div className="mwLabel">Legal name</div>
              <input
                className="input"
                value={settings.legal_name || ""}
                onChange={(e) => setSettings((s) => ({ ...s, legal_name: e.target.value }))}
                placeholder="SETU GROUPS LLC"
              />
            </div>

            <div className="mwField">
              <div className="mwLabel">Logo URL</div>
              <input
                className="input"
                value={settings.logo_url || ""}
                onChange={(e) => setSettings((s) => ({ ...s, logo_url: e.target.value || null }))}
                placeholder="https://..."
              />
              {settings.logo_url && (
                <div style={{ marginTop: 10 }}>
                  <img
                    src={settings.logo_url}
                    alt="Logo preview"
                    style={{ maxHeight: 48, maxWidth: 240, objectFit: "contain" }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card cardPad" style={{ maxWidth: 980, marginTop: 12 }}>
          <div className="h2">Branding</div>
          <div className="muted" style={{ marginTop: 4 }}>
            Accent controls button + highlight color across the app.
          </div>

          <div className="mwForm" style={{ marginTop: 14 }}>
            <div className="mwField">
              <div className="mwLabel">Accent color</div>
              <select
                className="input"
                value={settings.accent_color || "blue"}
                onChange={(e) => setSettings((s) => ({ ...s, accent_color: e.target.value }))}
              >
                <option value="blue">Blue (SETU default)</option>
                <option value="indigo">Indigo</option>
                <option value="emerald">Emerald</option>
                <option value="rose">Rose</option>
                <option value="slate">Slate</option>
                <option value="#243B6B">Custom: #243B6B</option>
                <option value="#10B981">Custom: #10B981</option>
              </select>
              <div className="muted" style={{ marginTop: 6 }}>
                Tip: you can also paste any hex value like <code>#12B886</code> and save.
              </div>
            </div>

            <div className="mwField">
              <div className="mwLabel">Default currency</div>
              <select
                className="input"
                value={settings.default_currency || "USD"}
                onChange={(e) => setSettings((s) => ({ ...s, default_currency: e.target.value }))}
              >
                <option value="USD">USD ($)</option>
                <option value="CAD">CAD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card cardPad" style={{ maxWidth: 980, marginTop: 12 }}>
          <div className="h2">Invoice header fields</div>
          <div className="muted" style={{ marginTop: 4 }}>
            Stored as JSON for flexibility.
          </div>

          <div className="mwForm" style={{ marginTop: 14 }}>
            {(["address", "tax_id", "phone", "email", "website"] as const).map((k) => (
              <div key={k} className="mwField">
                <div className="mwLabel">{k.replace("_", " ").toUpperCase()}</div>
                <input
                  className="input"
                  value={headerFields[k]}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      invoice_header_json: { ...(s.invoice_header_json || {}), [k]: e.target.value },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card cardPad" style={{ maxWidth: 980, marginTop: 12 }}>
          <div className="h2">Invoice footer</div>
          <div className="mwForm" style={{ marginTop: 14 }}>
            <div className="mwField" style={{ gridColumn: "1 / -1" }}>
              <div className="mwLabel">Footer text</div>
              <textarea
                className="input"
                style={{ minHeight: 120, resize: "vertical" }}
                value={settings.invoice_footer_text || ""}
                onChange={(e) => setSettings((s) => ({ ...s, invoice_footer_text: e.target.value }))}
                placeholder="Thank you for your business..."
              />
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 10, maxWidth: 980, marginTop: 12 }}>
          <button className="btn" disabled={loading || saving} onClick={save}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          <div className="muted" style={{ alignSelf: "center" }}>
            Changes apply immediately to org branding tokens.
          </div>
        </div>
      </AppShell>
    </RequireOnboarding>
  );
}
