"use client";

import RequireOnboarding from "../../../components/auth/RequireOnboarding";
import AppShell from "../../../components/layout/AppShell";
import AdminTabs from "../../../components/admin/AdminTabs";
import { useProfile } from "../../../lib/useProfile";
import { Card } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { CreditCard, ShieldCheck, ExternalLink } from "lucide-react";

export default function AdminBillingPage() {
  return (
    <RequireOnboarding>
      <AdminBillingInner />
    </RequireOnboarding>
  );
}

function AdminBillingInner() {
  const { profile, loading } = useProfile();
  const isAdmin = profile?.role === "admin";

  if (loading) return null;

  if (!isAdmin) {
    return (
      <AppShell title="Billing" subtitle="Admin only">
        <div className="card cardPad" style={{ maxWidth: 980 }}>
          <div className="muted">You do not have access to billing settings.</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Billing"
      subtitle="Stripe-ready placeholder (Phase 3 baseline)"
      right={
        <a className="pill" href="/docs" style={{ textDecoration: "none" }}>
          Docs <ExternalLink size={14} style={{ marginLeft: 6 }} />
        </a>
      }
    >
      <div style={{ maxWidth: 980 }}>
        <AdminTabs active="billing" />

        <div className="grid2" style={{ marginTop: 12 }}>
          <Card>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 650, marginBottom: 4 }}>Current plan</div>
                <div className="muted">Trial (placeholder)</div>
              </div>
              <div className="pill">
                <CreditCard size={14} style={{ marginRight: 6 }} />
                Billing
              </div>
            </div>

            <div className="muted" style={{ marginTop: 10 }}>
              This screen is intentionally a placeholder so we can connect Stripe without reworking the Admin UX later.
            </div>

            <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <Button disabled title="Stripe not connected yet">
                Manage subscription (coming soon)
              </Button>
              <Button variant="secondary" disabled title="Stripe not connected yet">
                Update payment method (coming soon)
              </Button>
            </div>
          </Card>

          <Card>
            <div style={{ fontWeight: 650, marginBottom: 8 }}>
              <ShieldCheck size={16} style={{ marginRight: 8, verticalAlign: "text-bottom" }} />
              Stripe integration readiness
            </div>

            <div className="muted">
              Planned fields (not persisted yet in this baseline):
              <ul style={{ marginTop: 8, marginBottom: 0 }}>
                <li>stripe_customer_id</li>
                <li>stripe_subscription_id</li>
                <li>subscription_status</li>
                <li>current_period_end</li>
              </ul>
            </div>

            <div className="muted" style={{ marginTop: 12 }}>
              Next step: add an <code>org_billing</code> table + webhook handlers, then wire “Manage subscription” to Stripe
              Customer Portal.
            </div>
          </Card>
        </div>

        <div className="card cardPad" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 650, marginBottom: 6 }}>Invoices</div>
          <div className="muted">
            Invoices are generated from <b>Org Settings</b> (invoice header + footer + currency) and <b>Export Center</b>{" "}
            receipts.
          </div>
          <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <a className="pill" href="/admin/org-settings" style={{ textDecoration: "none" }}>
              Configure invoice header/footer
            </a>
            <a className="pill" href="/admin/exports" style={{ textDecoration: "none" }}>
              View export receipts
            </a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
