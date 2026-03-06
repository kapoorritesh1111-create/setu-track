"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";

// lucide icons
import {
  LayoutDashboard,
  Clock3,
  CheckCircle2,
  FolderKanban,
  Users,
  BadgeDollarSign,
  Menu,
  X,
  User,
  Palette,
  Shield,
  LogOut,
  FileText,
  CreditCard,
} from "lucide-react";

type Props = {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
};

function initials(name?: string) {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "U";
}

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  hideIf?: (role: string) => boolean;
};

export default function AppShell({ title, subtitle, right, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useProfile() as any;

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = profile?.role === "admin";
  const fullName = profile?.full_name || "User";
  const role = profile?.role || "user";

  const navItems: NavItem[] = useMemo(() => {
    // IMPORTANT: Payroll route fix — use /reports/payroll (not /payroll)
    return [
      { label: "Home", href: "/dashboard", icon: <LayoutDashboard size={16} /> },
      { label: "My work", href: "/timesheet", icon: <Clock3 size={16} /> },
      {
        label: "My Pay",
        href: "/pay/my-pay",
        icon: <BadgeDollarSign size={16} />,
        hideIf: (r: string) => r !== "contractor",
      },
      {
        label: "Approvals",
        href: "/approvals",
        icon: <CheckCircle2 size={16} />,
        hideIf: (r: string) => r === "contractor",
      },
      { label: "Projects", href: "/projects", icon: <FolderKanban size={16} /> },
      {
        label: "People",
        href: "/profiles",
        icon: <Users size={16} />,
        hideIf: (r: string) => r === "contractor",
      },
      {
        label: "Payroll",
        href: "/reports/payroll",
        icon: <BadgeDollarSign size={16} />,
        hideIf: (r: string) => r === "contractor",
      },
{
  label: "Payroll runs",
  href: "/reports/payroll-runs",
  icon: <FileText size={16} />,
  hideIf: (r: string) => r !== "admin",
},
      {
        label: "Exports",
        href: "/admin/exports",
        icon: <Shield size={16} />,
        hideIf: (r: string) => r !== "admin",
      },
      {
        label: "Org Settings",
        href: "/admin/org-settings",
        icon: <Palette size={16} />,
        hideIf: (r: string) => r !== "admin",
      },
      {
        label: "Billing",
        href: "/admin/billing",
        icon: <CreditCard size={16} />,
        hideIf: (r: string) => r !== "admin",
      },
    ].filter((i) => !i.hideIf?.(role));
  }, [role]);

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  function go(href: string) {
    setMobileOpen(false);
    setMenuOpen(false);
    router.push(href);
  }

  // close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!menuOpen) return;
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="mwShellTop appShell">
      {/* Top bar */}
      <div className="mwTopInner">
        <div className="mwBrand" onClick={() => go("/dashboard")} style={{ cursor: "pointer" }}>
          <img className="mwBrandLogo" src="/brand/setu-knot-icon.svg" alt="SETU" />
          <div className="mwBrandName">SETU TRACK</div>
        </div>

        <div className="mwTopRight" ref={menuRef}>
          {/* Mobile menu button */}
          <button
            className="mwHamburger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: 12,
            }}
          >
            <Menu size={18} />
          </button>

          {/* Profile */}
          <button className="mwProfileBtn" onClick={() => setMenuOpen((v) => !v)}>
            <span className="mwAvatar">{initials(fullName)}</span>
            <span className="mwProfileMeta">
              <span className="mwProfileName">{fullName}</span>
              <span className="mwProfileRole">{role}</span>
            </span>
            <span className="mwChevron">▾</span>
          </button>

          {menuOpen && (
            <div className="mwMenu">
              <div className="mwMenuSection">
                <div className="mwMenuTitle">Account</div>

                <div className="mwMenuItem" onClick={() => go("/settings/profile")}>
                  <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                    <User size={16} />
                    My profile
                  </span>
                </div>

                <div className="mwMenuItem" onClick={() => go("/settings/appearance")}>
                  <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                    <Palette size={16} />
                    Change theme
                  </span>
                </div>

                {isAdmin && (
                  <div className="mwMenuItem" onClick={() => go("/admin")}>
                    <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                      <Shield size={16} />
                      Admin
                    </span>
                  </div>
                )}

                <div className="mwMenuDivider" />

                <div className="mwMenuTitle">Navigate</div>
                {navItems.map((i) => (
                  <div
                    key={i.href}
                    className={`mwMenuItem ${isActive(i.href) ? "mwMenuItemActive" : ""}`}
                    onClick={() => go(i.href)}
                  >
                    <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                      {i.icon}
                      {i.label}
                    </span>
                  </div>
                ))}

                <div className="mwMenuDivider" />

                <div className="mwMenuItem mwDanger" onClick={signOut}>
                  <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                    <LogOut size={16} />
                    Log out
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="mwSidebar">
        <div className="mwSideSection">
          {navItems.map((i) => (
            <div
              key={i.href}
              className={`mwSideItem ${isActive(i.href) ? "mwSideItemActive" : ""}`}
              onClick={() => go(i.href)}
              role="button"
              tabIndex={0}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center" }}>{i.icon}</span>
              <span>{i.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="mwDrawerOverlay" onClick={() => setMobileOpen(false)}>
          <div className="mwDrawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="mwBrand" onClick={() => go("/dashboard")} style={{ cursor: "pointer" }}>
                <img className="mwBrandLogo" src="/brand/setu-knot-icon.svg" alt="SETU" />
                <div className="mwBrandName">SETU TRACK</div>
              </div>

              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40 }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mwMenuTitle">Navigate</div>
            <div className="mwSideSection">
              {navItems.map((i) => (
                <div
                  key={i.href}
                  className={`mwSideItem ${isActive(i.href) ? "mwSideItemActive" : ""}`}
                  onClick={() => go(i.href)}
                  role="button"
                  tabIndex={0}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center" }}>{i.icon}</span>
                  <span>{i.label}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="mwMenuTitle">Account</div>
              <div className="mwSideSection">
                <div className="mwSideItem" onClick={() => go("/settings/profile")} role="button" tabIndex={0}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <User size={16} /> My profile
                  </span>
                </div>

                <div className="mwSideItem" onClick={() => go("/settings/appearance")} role="button" tabIndex={0}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <Palette size={16} /> Change theme
                  </span>
                </div>

                {isAdmin && (
                  <div className="mwSideItem" onClick={() => go("/admin")} role="button" tabIndex={0}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                      <Shield size={16} /> Admin
                    </span>
                  </div>
                )}

                <div
                  className="mwSideItem"
                  onClick={signOut}
                  role="button"
                  tabIndex={0}
                  style={{ color: "var(--danger)" }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <LogOut size={16} /> Log out
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="container">
        {(title || subtitle || right) && (
          <div className="pageHeader">
            <div>
              {title && <h1 className="pageTitle">{title}</h1>}
              {subtitle && <div className="pageSubtitle">{subtitle}</div>}
            </div>
            {right ? <div>{right}</div> : null}
          </div>
        )}

        <div className="pageBody">{children}</div>
      </main>
    </div>
  );
}
