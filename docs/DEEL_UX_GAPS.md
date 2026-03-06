**Baseline:** Phase 2.9 feature set (2.7 receipts + 2.8 export center + 2.9 client deliverables), branded for **SETU GROUPS / SETU TRACK**.  
**Last update:** 2026-03-05.

# DEEL_UX_GAPS (Audit vs Deel-level UX)

This file tracks **what still feels “not SaaS enough”** and what we’ve already closed.

## Closed gaps (done through Phase 1.9)
- ✅ **Structured page header pattern** (premium PageHeader)
- ✅ **Consistent status chip system** (StatusChip)
- ✅ **Payroll leads with financial summary** (SummaryBar + TrustBlock + CommandCard)
- ✅ **Unified secondary actions** (ActionMenu / Exports dropdown)
- ✅ **Global theme + density** (Settings → Appearance drives tokens)
- ✅ **Table feel** (sticky header, row hover, density tokens)
- ✅ **Primary action consistency** (one top-right CTA per page)
- ✅ **Command surface consistency** (CommandBar standard)
- ✅ **Saved Views (scaffolding)** (localStorage)

## Remaining gaps (priority order)
1) **Export polish: receipts + guardrails**
   - receipts are logged (Phase 2.4) and visible as a table
   - remaining to feel “Deel-grade”:
     - receipt drawer (click receipt → scope/filters/actor/run link)
     - “No changes since last export” badge
     - guardrail confirm before re-exporting when no_changes
     - paid confirmation modal + paid note UI

2) **Activity log / audit trail (system-wide)**
   - at minimum for payroll runs + approvals

3) **Manager impact dashboard**
   - pending approvals, pay-period risk, team totals, “what blocks closing”

4) **Saved Views productization**
   - persist per-user in DB (`profiles.ui_prefs`)
   - default view + sorting

5) **Empty states with intent + education**
   - add light iconography + crisp CTAs on more pages

6) **Copy + micro-interactions**
   - consistent verbs, loading states, success toasts, error banners

9. Admin pages feel operational, not strategic

10. Empty states lack guidance

### Definition of “Deel-Ready”

A page must include:

* Page Header

* Executive Metrics Row

* Primary Command Card

* Workflow Status Visibility

* Trust Metadata Block

If any of the above is missing, the page is incomplete.


## Phase 2.6 closed gaps
- Export-to-export variance (changes since last official export)
- Payroll stage narrative surfaced (Preview → Approved → Locked → Exported → Paid)
- Admin Mark Paid action (baseline payout acknowledgement)

## Phase 2.7 target gaps
- Receipt drill-down drawer
- No-changes badge + export guardrails
- Paid confirmation + paid note + “Paid on/by” display
