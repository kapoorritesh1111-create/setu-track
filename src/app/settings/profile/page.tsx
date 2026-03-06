// src/app/settings/profile/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import { useProfile } from "../../../lib/useProfile";
import { supabase } from "../../../lib/supabaseBrowser";
import FormField from "../../../components/ui/FormField";

// Icons (install if needed: npm i lucide-react)
import {
  User,
  Activity,
  Bell,
  Globe,
  KeyRound,
  History,
  Mail,
  Phone as PhoneIcon,
  MapPin,
  Upload,
  X,
} from "lucide-react";

type Section =
  | "personal"
  | "status"
  | "notifications"
  | "language"
  | "password"
  | "sessions";

type AddressParts = {
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

function parseAddress(value: any): AddressParts {
  const empty: AddressParts = {
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    country: "USA",
  };

  const raw = String(value || "").trim();
  if (!raw) return empty;

  // If stored as JSON, prefer structured fields
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") {
      return {
        address1: String(obj.address1 || ""),
        address2: String(obj.address2 || ""),
        city: String(obj.city || ""),
        state: String(obj.state || ""),
        zip: String(obj.zip || ""),
        country: String(obj.country || "USA"),
      };
    }
  } catch {
    // ignore
  }

  // Fallback: best-effort from a single-line freeform address
  return { ...empty, address1: raw };
}

function initialsFromName(name?: string) {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "U";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + last).toUpperCase();
}

async function uploadAvatar(file: File, userId: string) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export default function MyProfilePage() {
  const { profile, refresh, loading, error } = useProfile() as any;

  const userId = profile?.id as string | undefined;

  const [section, setSection] = useState<Section>("personal");

  const [phone, setPhone] = useState("");
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState<"USA" | string>("USA");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fullName = profile?.full_name || "User";
  const role = profile?.role || "user";
  const email = profile?.email || profile?.user_email || ""; // depends on how you're storing it

  const initials = useMemo(() => initialsFromName(fullName), [fullName]);

  const locationLabel = useMemo(() => {
    const parts = [city, state].filter(Boolean).join(", ");
    const c = (country || "USA").trim();
    if (parts && c) return `${parts} • ${c}`;
    if (parts) return parts;
    if (zip) return `${zip} • ${c || "USA"}`;
    if (addr1) return c || "USA";
    return "Add a location";
  }, [addr1, city, state, zip, country]);

  useEffect(() => {
    setPhone(profile?.phone || "");
    const p = parseAddress(profile?.address);
    setAddr1(p.address1);
    setAddr2(p.address2);
    setCity(p.city);
    setState(p.state);
    setZip(p.zip);
    setCountry(p.country || "USA");
    setAvatarUrl(profile?.avatar_url || "");
    // clear local upload draft when profile changes
    setAvatarFile(null);
    setAvatarPreview("");
  }, [profile?.id]);

  // ZIP → City/State autofill (USA) using zippopotam.us (client-side)
  useEffect(() => {
    const z = (zip || "").trim();
    const isUsa = (country || "USA").toUpperCase().includes("US");
    if (!isUsa) return;
    if (!/^\d{5}$/.test(z)) return;

    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const res = await fetch(`https://api.zippopotam.us/us/${z}`);
          if (!res.ok) return;
          const data: any = await res.json();
          if (cancelled) return;
          const place = data?.places?.[0];
          const newCity = place?.["place name"] || "";
          const newState = place?.["state abbreviation"] || place?.state || "";
          if (newCity) setCity(newCity);
          if (newState) setState(newState);
        } catch {
          // ignore
        }
      })();
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [zip, country]);

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setAvatarFile(f);
    if (!f) {
      setAvatarPreview("");
      return;
    }
    try {
      const url = URL.createObjectURL(f);
      setAvatarPreview(url);
    } catch {
      setAvatarPreview("");
    }
  }

  async function onUploadAvatar() {
    if (!avatarFile || !userId) return;

    setUploading(true);
    try {
      const url = await uploadAvatar(avatarFile, userId);
      setAvatarUrl(url);
      setAvatarFile(null);

      // clear preview + input
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      alert(e?.message || "Upload failed. Check Storage bucket + policies.");
    } finally {
      setUploading(false);
    }
  }

  function cancelAvatarDraft() {
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function save() {
    if (!userId) return;
    setSaving(true);

    const addressJson = JSON.stringify({
      address1: addr1 || "",
      address2: addr2 || "",
      city: city || "",
      state: state || "",
      zip: zip || "",
      country: country || "USA",
    });

    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        phone: phone || null,
        address: addressJson,
        avatar_url: avatarUrl || null,
      })
      .eq("id", userId);

    setSaving(false);

    if (upErr) {
      alert(upErr.message);
      return;
    }

    await refresh?.();
    alert("Saved.");
  }

  const leftItems: Array<{
    id: Section;
    label: string;
    icon: any;
    enabled: boolean;
  }> = [
    { id: "personal", label: "Personal info", icon: User, enabled: true },
    { id: "status", label: "Working status", icon: Activity, enabled: true },
    { id: "notifications", label: "Notifications", icon: Bell, enabled: true },
    { id: "language", label: "Language & region", icon: Globe, enabled: true },
    { id: "password", label: "Password", icon: KeyRound, enabled: true },
    { id: "sessions", label: "Session history", icon: History, enabled: true },
  ];

  return (
    <RequireOnboarding>
      <AppShell title="My profile" subtitle="Update your personal details">
        <div className="card" style={{ maxWidth: 1100, overflow: "hidden" }}>
          {loading ? <div className="alert alertInfo">Loading…</div> : null}
          {error ? (
            <div className="alert" style={{ borderColor: "rgba(220,38,38,0.35)" }}>
              {String(error)}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "240px 1fr",
              minHeight: 520,
            }}
          >
            {/* Left menu */}
            <div
              style={{
                borderRight: "1px solid var(--border)",
                background: "rgba(255,255,255,0.65)",
                padding: 12,
              }}
            >
              <div className="muted" style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.08em" }}>
                PROFILE
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                {leftItems.map((it) => {
                  const Icon = it.icon;
                  const active = section === it.id;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => it.enabled && setSection(it.id)}
                      className={active ? "mwSideItem mwSideItemActive" : "mwSideItem"}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        justifyContent: "flex-start",
                        opacity: it.enabled ? 1 : 0.55,
                        cursor: it.enabled ? "pointer" : "not-allowed",
                      }}
                      disabled={!it.enabled}
                      title={!it.enabled ? "Coming soon" : undefined}
                    >
                      <Icon size={16} />
                      <span>{it.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right panel */}
            <div style={{ padding: 16 }}>
              {/* Header card */}
              <div className="card cardPad">
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div
                    className="mwAvatar"
                    style={{
                      width: 84,
                      height: 84,
                      overflow: "hidden",
                      background: "var(--primary-soft)",
                      borderColor: "rgba(37,99,235,0.22)",
                    }}
                  >
                    {avatarPreview || avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarPreview || avatarUrl}
                        alt="avatar"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: 26, fontWeight: 950 }}>{initials}</span>
                    )}
                  </div>

                  <div style={{ flex: "1 1 360px" }}>
                    <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: "-0.02em" }}>{fullName}</div>
                    <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span
                        className={
                          role === "admin"
                            ? "badge badgeAdmin"
                            : role === "manager"
                              ? "badge badgeManager"
                              : "badge badgeContractor"
                        }
                      >
                        {String(role)}
                      </span>
                      <span className="muted" style={{ fontSize: 12 }}>
                        You can update your phone, address, and photo.
                      </span>
                    </div>

                    {/* Upload controls */}
                    <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickAvatar} />
                      <button onClick={onUploadAvatar} disabled={!avatarFile || uploading}>
                        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                          <Upload size={16} />
                          {uploading ? "Uploading..." : "Upload photo"}
                        </span>
                      </button>
                      {avatarPreview ? (
                        <button onClick={cancelAvatarDraft} disabled={uploading}>
                          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                            <X size={16} />
                            Cancel
                          </span>
                        </button>
                      ) : null}
                      <span className="muted" style={{ fontSize: 12 }}>
                        JPG/PNG recommended. Square looks best.
                      </span>
                    </div>
                  </div>

                  {/* Contact summary (right) */}
                  <div style={{ flex: "0 0 280px", display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Mail size={16} style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 12 }}>Email</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {email || "—"}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <PhoneIcon size={16} style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 12 }}>Phone</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {phone || "Add a phone"}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <MapPin size={16} style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 12 }}>Location</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {locationLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Info section */}
              {section === "personal" ? (
                <div style={{ marginTop: 14 }} className="grid2">
                  <div className="card cardPad">
                    <div className="muted" style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.08em" }}>
                      CONTACT
                    </div>

                    <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                      <FormField label="Phone" helpText="Used for account and admin contact." helpMode="tooltip">
                        {({ id, describedBy }) => (
                          <input
                            id={id}
                            name="phone"
                            aria-describedby={describedBy}
                            className="input"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="(555) 555-5555"
                            autoComplete="tel"
                          />
                        )}
                      </FormField>

                      <FormField label="Address line 1" helpText="Street address." helpMode="tooltip">
                        {({ id, describedBy }) => (
                          <input
                            id={id}
                            name="address1"
                            aria-describedby={describedBy}
                            className="input"
                            value={addr1}
                            onChange={(e) => setAddr1(e.target.value)}
                            placeholder="123 Main St"
                            autoComplete="address-line1"
                          />
                        )}
                      </FormField>

                      <FormField label="Address line 2" helpText="Apt, suite, unit, etc." helpMode="tooltip">
                        {({ id, describedBy }) => (
                          <input
                            id={id}
                            name="address2"
                            aria-describedby={describedBy}
                            className="input"
                            value={addr2}
                            onChange={(e) => setAddr2(e.target.value)}
                            placeholder="Apt 4B"
                            autoComplete="address-line2"
                          />
                        )}
                      </FormField>

                      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <FormField label="ZIP" helpText="If entered, City & State will auto-fill (USA)." helpMode="tooltip">
                          {({ id, describedBy }) => (
                            <input
                              id={id}
                              name="zip"
                              aria-describedby={describedBy}
                              className="input"
                              value={zip}
                              onChange={(e) => setZip(e.target.value)}
                              placeholder="94105"
                              autoComplete="postal-code"
                            />
                          )}
                        </FormField>

                        <FormField label="Country" helpText="Default is USA." helpMode="tooltip">
                          {({ id, describedBy }) => (
                            <select
                              id={id}
                              name="country"
                              aria-describedby={describedBy}
                              className="select"
                              value={country}
                              onChange={(e) => setCountry(e.target.value)}
                              autoComplete="country-name"
                            >
                              <option value="USA">USA</option>
                              <option value="Canada">Canada</option>
                              <option value="UK">UK</option>
                              <option value="India">India</option>
                              <option value="Other">Other</option>
                            </select>
                          )}
                        </FormField>
                      </div>

                      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <FormField label="City" helpText="Auto-fills from ZIP in the USA." helpMode="tooltip">
                          {({ id, describedBy }) => (
                            <input
                              id={id}
                              name="city"
                              aria-describedby={describedBy}
                              className="input"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              placeholder="San Francisco"
                              autoComplete="address-level2"
                            />
                          )}
                        </FormField>

                        <FormField label="State" helpText="Auto-fills from ZIP in the USA." helpMode="tooltip">
                          {({ id, describedBy }) => (
                            <input
                              id={id}
                              name="state"
                              aria-describedby={describedBy}
                              className="input"
                              value={state}
                              onChange={(e) => setState(e.target.value)}
                              placeholder="CA"
                              autoComplete="address-level1"
                            />
                          )}
                        </FormField>
                      </div>
                    </div>

                    <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="btn btnPrimary" onClick={save} disabled={saving || loading}>
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                      <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>
                        Saves to your profile and will reflect across the app.
                      </span>
                    </div>
                  </div>

                  <div className="card cardPad">
                    <div className="muted" style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.08em" }}>
                      ABOUT
                    </div>

                    <div style={{ marginTop: 12 }} className="muted">
                      <div style={{ fontWeight: 950, color: "var(--text)" }}>Coming next</div>
                      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
                        We’ll expand this page to match the Monday-style profile experience:
                        <ul style={{ marginTop: 8 }}>
                          <li>Working status</li>
                          <li>Notifications</li>
                          <li>Language & region</li>
                          <li>Password + session history</li>
                        </ul>
                      </div>

                      <div className="alert alertInfo" style={{ marginTop: 12 }}>
                        If avatar upload fails: confirm Storage bucket <b>avatars</b> exists and policies allow uploads
                        to <code>{`avatars/${userId || "userId"}/...`}</code>.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 14 }} className="grid2">
                  {section === "status" ? (
                    <div className="card cardPad">
                      <div className="muted" style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.08em" }}>
                        WORKING STATUS
                      </div>
                      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                        <FormField label="Status" helpText="Displayed to admins/managers in People." helpMode="tooltip">
                          {({ id, describedBy }) => (
                            <select id={id} aria-describedby={describedBy} className="select" defaultValue="available">
                              <option value="available">Available</option>
                              <option value="busy">Busy</option>
                              <option value="offline">Offline</option>
                            </select>
                          )}
                        </FormField>
                        <div className="alert alertInfo">
                          Coming next: we’ll persist this setting per user and surface it in the People directory.
                        </div>
                      </div>
                    </div>
                  ) : section === "notifications" ? (
                    <div className="card cardPad">
                      <div className="muted" style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.08em" }}>
                        NOTIFICATIONS
                      </div>
                      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                        <label className="row" style={{ gap: 10, alignItems: "center" }}>
                          <input type="checkbox" defaultChecked />
                          <span>Weekly summary emails</span>
                        </label>
                        <label className="row" style={{ gap: 10, alignItems: "center" }}>
                          <input type="checkbox" defaultChecked />
                          <span>Approval reminders</span>
                        </label>
                        <label className="row" style={{ gap: 10, alignItems: "center" }}>
                          <input type="checkbox" />
                          <span>Project assignment updates</span>
                        </label>
                        <div className="alert alertInfo">Coming next: save preferences + connect to email/alerts.</div>
                      </div>
                    </div>
                  ) : section === "language" ? (
                    <div className="card cardPad">
                      <div className="muted" style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.08em" }}>
                        LANGUAGE & REGION
                      </div>
                      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                        <FormField label="Language" helpText="Affects labels and date formats." helpMode="tooltip">
                          {({ id, describedBy }) => (
                            <select id={id} aria-describedby={describedBy} className="select" defaultValue="en">
                              <option value="en">English</option>
                              <option value="es">Spanish</option>
                              <option value="hi">Hindi</option>
                            </select>
                          )}
                        </FormField>
                        <FormField label="Time zone" helpText="Used for timesheet weeks and approvals." helpMode="tooltip">
                          {({ id, describedBy }) => (
                            <select id={id} aria-describedby={describedBy} className="select" defaultValue="local">
                              <option value="local">Use device time zone</option>
                              <option value="America/New_York">America/New_York</option>
                              <option value="America/Chicago">America/Chicago</option>
                              <option value="America/Los_Angeles">America/Los_Angeles</option>
                            </select>
                          )}
                        </FormField>
                        <div className="alert alertInfo">Coming next: persist settings per user.</div>
                      </div>
                    </div>
                  ) : section === "password" ? (
                    <div className="card cardPad">
                      <div className="muted" style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.08em" }}>
                        PASSWORD
                      </div>
                      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                        <div className="muted">
                          Password changes are handled securely via the reset flow.
                        </div>
                        <button className="btnPrimary" type="button" onClick={() => (window.location.href = "/reset")}>
                          Reset password
                        </button>
                        <div className="alert alertInfo">Coming next: session history + device management.</div>
                      </div>
                    </div>
                  ) : (
                    <div className="card cardPad">
                      <div className="muted" style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.08em" }}>
                        SESSION HISTORY
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div className="muted">
                          We’ll show recent sign-ins, devices, and active sessions here.
                        </div>
                        <div className="alert alertInfo" style={{ marginTop: 12 }}>
                          Coming next: pull sessions from auth logs and allow sign-out of other sessions.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="card cardPad">
                    <div className="muted" style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.08em" }}>
                      NOTES
                    </div>
                    <div className="muted" style={{ marginTop: 12, fontSize: 13, lineHeight: 1.5 }}>
                      These sections match the Monday-style profile layout and are ready for persistence.
                      <ul style={{ marginTop: 10 }}>
                        <li>Working status</li>
                        <li>Notifications</li>
                        <li>Language & region</li>
                        <li>Password + session history</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    </RequireOnboarding>
  );
}
