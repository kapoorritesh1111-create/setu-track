// src/components/layout/TopNav.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function initials(name?: string) {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
}

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile() as any;

  const role = (profile?.role || "contractor") as string;
  const fullName = (profile?.full_name || "") as string;

  const isAdmin = role === "admin";

  const links = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/timesheet", label: "SETU TRACK" },
      { href: "/approvals", label: "Approvals" },
      // Keep this pointing to the REAL route (we also add /payroll redirect separately)
      { href: "/reports/payroll", label: "Payroll" },
      { href: "/projects", label: "Projects" },
      { href: "/profiles", label: "People" },
    ],
    []
  );

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="topNav">
      <div className="topNavInner">
        <Link href="/dashboard" className="brand">
          <span className="brandDot" />
          <span>SETU TRACK</span>
        </Link>

        <div className="navLinks">
          {links.map((l) => {
            const active = pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn("pill", active && "pillActive")}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* Profile dropdown */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            className="pill"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            style={{ gap: 10 }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 950,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "rgba(255,255,255,0.9)",
              }}
              title={fullName || "Account"}
            >
              {initials(fullName)}
            </span>
            <span style={{ fontWeight: 900 }}>
              {fullName ? fullName.split(" ")[0] : "Account"}
            </span>
          </button>

          {open && (
            <div
              className="card"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 8px)",
                width: 260,
                padding: 10,
                zIndex: 60,
              }}
              role="menu"
            >
              <div className="muted" style={{ fontSize: 12, fontWeight: 900, marginBottom: 8 }}>
                ACCOUNT
              </div>

              <Link
                className="pill"
                style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}
                href="/settings/profile"
                onClick={() => setOpen(false)}
              >
                My profile <span className="muted">→</span>
              </Link>

              <Link
                className="pill"
                style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}
                href="/settings/appearance"
                onClick={() => setOpen(false)}
              >
                Change theme <span className="muted">→</span>
              </Link>

              {isAdmin && (
                <Link
                  className="pill"
                  style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}
                  href="/admin"
                  onClick={() => setOpen(false)}
                >
                  Admin <span className="muted">→</span>
                </Link>
              )}

              <button
                className="pill"
                style={{
                  width: "100%",
                  justifyContent: "space-between",
                  borderColor: "rgba(220,38,38,0.25)",
                  background: "rgba(220,38,38,0.06)",
                }}
                onClick={logout}
              >
                Log out <span className="muted">↩</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
