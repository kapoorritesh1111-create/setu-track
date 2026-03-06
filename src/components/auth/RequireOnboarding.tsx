// src/components/auth/RequireOnboarding.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "../../lib/useProfile";
import { isProfileComplete } from "../../lib/profileCompletion";
import Button from "../ui/Button";

type Props = {
  children: React.ReactNode;
};

export default function RequireOnboarding({ children }: Props) {
  const router = useRouter();
  const { loading, userId, profile, error } = useProfile() as any;

  useEffect(() => {
    if (loading) return;

    if (!userId) {
      router.replace("/login");
      return;
    }

    if (!isProfileComplete(profile)) {
      router.replace("/onboarding");
      return;
    }
  }, [loading, userId, profile, router]);

  // ✅ Don’t render blank pages during hydration
  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="card cardPad" style={{ maxWidth: 520 }}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Loading…</div>
          <div className="muted">Getting your account ready.</div>
        </div>
      </div>
    );
  }

  // ✅ Don’t render blank pages on auth/profile errors
  if (error) {
    return (
      <div className="container" style={{ paddingTop: 40 }}>
        <div className="card cardPad" style={{ maxWidth: 720 }}>
          <div style={{ fontWeight: 950, marginBottom: 6 }}>Can’t load your profile</div>
          <div className="muted" style={{ marginBottom: 12 }}>
            {String(error)}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Retry
            </Button>
            <Button variant="ghost" onClick={() => (window.location.href = "/login")}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!userId) return null;
  if (!isProfileComplete(profile)) return null;

  return <>{children}</>;
}
