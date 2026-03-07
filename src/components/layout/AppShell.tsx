"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseBrowser";
import { useProfile } from "../../lib/useProfile";
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
  Building2,
} from "lucide-react";

type Props = {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
};

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  hideIf?: (role: string) => boolean;
};

function initials(name?: string) {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "U";
}

function roleLabel(role?: string) {
  if (!role) return "User";
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  if (role === "contractor") return "Contractor";
  return role;
}

export default function AppShell({ title, subtitle, right, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useProfile() as any;

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const role = profile?.role || "user";
  const fullName = profile?.full_name || "User";
  const orgName = profile?.org_name || "SETU TRACK";
  const isAdmin = role === "admin";

  const navItems: NavItem[] = useMemo(
    () =>
      [
        { label: "Home", href: "/dashboard", icon: <LayoutDashboard size={16} /> },
        { label: "My work", href: "/timesheet", icon: <Clock3 size={16} /> },
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
          icon: <Building2 size={16} />,
          hideIf: (r: string) => r !== "admin",
        },
        {
          label: "Billing",
          href: "/admin/billing",
          icon: <CreditCard size={16} />,
          hideIf: (r: string) => r !== "admin",
        },
      ].filter((item) => !item.hideIf?.(role)),
    [role]
  );

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

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!menuOpen) return;
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="mwShellTop appShell">
      <header className="mwTopInner">
        <div className="mwTopLeft">
          <button
            className="mwHamburger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            type="button"
          >
            <Menu size={18} />
          </button>

          <button
            type="button"
            className="mwBrand mwBrandButton mwDesktopHidden"
            onClick={() => go("/dashboard")}
            aria-label="Go to dashboard"
          >
            <img
              className="mwBrandLogo mwBrandLogoFull"
              src="/brand/setu-track-logo.svg"
              alt="SETU TRACK"
            />
          </button>
        </div>

        <div className="mwTopRight" ref={menuRef}>
          <button type="button" className="mwProfileBtn" onClick={() => setMenuOpen((v) => !v)}>
            <span className="mwAvatar">{initials(fullName)}</span>

            <span className="mwProfileMeta">
              <span className="mwProfileName">{fullName}</span>
              <span className="mwProfileRole">{roleLabel(role)}</span>
            </span>

            <span className="mwChevron">▾</span>
          </button>

          {menuOpen && (
            <div className="mwMenu">
              <div className="mwMenuSection">
                <div className="mwMenuTitle">Account</div>

                <button type="button" className="mwMenuItem" onClick={() => go("/settings/profile")}>
                  <span className="mwInlineIconLabel">
                    <User size={16} />
                    My profile
                  </span>
                </button>

                <button
                  type="button"
                  className="mwMenuItem"
                  onClick={() => go("/settings/appearance")}
                >
                  <span className="mwInlineIconLabel">
                    <Palette size={16} />
                    Change theme
                  </span>
                </button>

                {isAdmin && (
                  <button type="button" className="mwMenuItem" onClick={() => go("/admin")}>
                    <span className="mwInlineIconLabel">
                      <Shield size={16} />
                      Admin
                    </span>
                  </button>
                )}

                <div className="mwMenuDivider" />
                <div className="mwMenuTitle">Navigate</div>

                {navItems.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    className={`mwMenuItem ${isActive(item.href) ? "mwMenuItemActive" : ""}`}
                    onClick={() => go(item.href)}
                  >
                    <span className="mwInlineIconLabel">
                      {item.icon}
                      {item.label}
                    </span>
                  </button>
                ))}

                <div className="mwMenuDivider" />

                <button type="button" className="mwMenuItem mwDanger" onClick={signOut}>
                  <span className="mwInlineIconLabel">
                    <LogOut size={16} />
                    Log out
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <aside className="mwSidebar">
        <div className="mwSidebarBrand">
          <button
            type="button"
            className="mwSidebarBrandBtn"
            onClick={() => go("/dashboard")}
            aria-label="Go to dashboard"
          >
            <img
              className="mwSidebarLogo"
              src="/brand/setu-track-logo-dark.png"
              alt="SETU TRACK"
            />
          </button>

          <div className="mwOrgBadge">
            <span className="mwOrgBadgeIcon">
              <Building2 size={14} />
            </span>
            <span className="mwOrgBadgeText">{orgName}</span>
          </div>
        </div>

        <div className="mwSideSection">
          {navItems.map((item) => (
            <button
              key={item.href}
              type="button"
              className={`mwSideItem ${isActive(item.href) ? "mwSideItemActive" : ""}`}
              onClick={() => go(item.href)}
            >
              <span className="mwSideItemIcon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </aside>

      {mobileOpen && (
        <div className="mwDrawerOverlay" onClick={() => setMobileOpen(false)}>
          <div className="mwDrawer" onClick={(e) => e.stopPropagation()}>
            <div className="mwDrawerHeader">
              <button
                type="button"
                className="mwSidebarBrandBtn"
                onClick={() => go("/dashboard")}
                aria-label="Go to dashboard"
              >
                <img
                  className="mwSidebarLogo"
                  src="/brand/setu-track-logo-dark.png"
                  alt="SETU TRACK"
                />
              </button>

              <button
                type="button"
                className="iconBtn"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mwMenuTitle">Navigate</div>

            <div className="mwSideSection">
              {navItems.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  className={`mwSideItem ${isActive(item.href) ? "mwSideItemActive" : ""}`}
                  onClick={() => go(item.href)}
                >
                  <span className="mwSideItemIcon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="mwDrawerAccount">
              <div className="mwMenuTitle">Account</div>

              <div className="mwDrawerProfileCard">
                <div className="mwAvatar">{initials(fullName)}</div>
                <div>
                  <div className="mwDrawerProfileName">{fullName}</div>
                  <div className="mwDrawerProfileRole">{roleLabel(role)}</div>
                </div>
              </div>

              <div className="mwSideSection">
                <button type="button" className="mwSideItem" onClick={() => go("/settings/profile")}>
                  <span className="mwInlineIconLabel">
                    <User size={16} />
                    My profile
                  </span>
                </button>

                <button
                  type="button"
                  className="mwSideItem"
                  onClick={() => go("/settings/appearance")}
                >
                  <span className="mwInlineIconLabel">
                    <Palette size={16} />
                    Change theme
                  </span>
                </button>

                {isAdmin && (
                  <button type="button" className="mwSideItem" onClick={() => go("/admin")}>
                    <span className="mwInlineIconLabel">
                      <Shield size={16} />
                      Admin
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  className="mwSideItem"
                  onClick={signOut}
                  style={{ color: "var(--danger)" }}
                >
                  <span className="mwInlineIconLabel">
                    <LogOut size={16} />
                    Log out
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="container">
        {(title || subtitle || right) && (
          <div className="pageHeader">
            <div>
              {title ? <h1 className="pageTitle">{title}</h1> : null}
              {subtitle ? <div className="pageSubtitle">{subtitle}</div> : null}
            </div>
            {right ? <div>{right}</div> : null}
          </div>
        )}

        <div className="pageBody">{children}</div>
      </main>
    </div>
  );
}
