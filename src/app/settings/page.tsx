// src/app/settings/page.tsx
import Link from "next/link";
import RequireOnboarding from "../../components/auth/RequireOnboarding";
import AppShell from "../../components/layout/AppShell";

export default function SettingsHomePage() {
  return (
    <RequireOnboarding>
      <AppShell title="Settings" subtitle="Manage your account and workspace">
        <div className="tsGrid2" style={{ marginTop: 14 }}>
          <div className="card cardPad">
            <div style={{ fontWeight: 900, marginBottom: 6 }}>My profile</div>
            <div className="muted" style={{ marginBottom: 12 }}>
              Update your name, phone, address and avatar.
            </div>
            <Link className="btnPrimary" href="/settings/profile">
              Open
            </Link>
          </div>

          <div className="card cardPad">
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Appearance</div>
            <div className="muted" style={{ marginBottom: 12 }}>
              Choose accent color, radius, and spacing density.
            </div>
            <Link className="btnPrimary" href="/settings/appearance">
              Open
            </Link>
          </div>
        </div>
      </AppShell>
    </RequireOnboarding>
  );
}
