# SETU TRACK — Phase 3A Release

Date: 2026-03-09

## Release theme
Operations cockpit, data trust, and product polish.

## What changed

### Dashboard
- Expanded the Command Center into a more explicit operations cockpit.
- Added a shared signal row for approval backlog, missing timesheets, rate coverage, and budget coverage.
- Strengthened project health cards with budget-use progress bars and clearer cost context.
- Unified period messaging with shared formatting helpers.

### Projects
- Pushed Projects further toward a finance workspace.
- Added a risk summary row covering projects at risk, actual-vs-budget spend, hours-vs-plan, and no-budget projects.
- Added a top-projects-at-risk queue to support faster management review.
- Kept date controls aligned with Dashboard / Analytics / Payroll for one shared finance period.

### Approvals
- Tightened Approvals as an exception queue instead of a plain review list.
- Added signal cards for queue load, long-hour alerts, missing timesheets, and payroll blockers.
- Added stale / long-hours / missing-notes hints directly on queue groups.

### Analytics
- Added a shared signal row for payroll variance, contractor concentration, project risk, and budget coverage.
- Added a high-risk list under budget variance signals so managers can quickly spot where labor spend or pending approvals are concentrated.
- Standardized analytics money / date formatting with shared helpers.

### Activity
- Added a stronger top-level signal strip for timeline health, latest payroll status, latest export, and actor coverage.
- Replaced page-local timestamp / money formatting with shared utilities.
- Kept wording focused on audit, export, and payroll operations rather than raw dev-facing strings.

### Data trust and reliability
- Added `src/lib/format.ts` to reduce duplicate currency/date formatting logic across pages.
- Reduced page-to-page formatting drift for money, timestamps, and date ranges.
- Extended shared dark-mode surface treatment for newer command-center style cards.

## Files updated
- `src/lib/format.ts`
- `src/components/dashboard/admin/AdminDashboard.tsx`
- `src/app/projects/projects-client.tsx`
- `src/app/approvals/page.tsx`
- `src/app/analytics/page.tsx`
- `src/app/admin/activity/page.tsx`
- `src/app/globals.css`
- `docs/PHASE_3A_RELEASE_2026-03-09.md`
- `docs/PHASE_3A_QA_CHECKLIST_2026-03-09.md`

## Notes
- This pass intentionally focused on product maturity and trust signals without changing the underlying multi-role model.
- Because package installation is not available in this container, a full local `next build` could not be executed here. The repo should still be run through normal build + smoke QA before deployment.
