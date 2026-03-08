# SETU TRACK Stabilization Pass — 2026-03-07

## What was addressed

### Product stabilization
- Replaced broken brand/logo assets with the aligned SETU brand pack assets.
- Removed the duplicate desktop top-bar logo treatment so the shell feels intentional instead of duplicated.
- Added missing drawer CSS so project, user, and payroll side-panels render above the app reliably.
- Fixed drawer accessibility/focus behavior that was creating the `aria-hidden` console warning and interfering with open state UX.

### Dashboard / runtime fixes
- Fixed `/api/dashboard/admin-summary` to query `v_time_entries.hours_worked` instead of a non-existent `time_entries.hours` column. This was the main reason the admin dashboard comparison cards were returning `400` responses in the browser console.
- Removed deprecated PWA metadata that was generating the `apple-mobile-web-app-capable` warning.

### My Work page productization
- Reworked the weekly timesheet command area and action buttons to use the shared SETU button system.
- Upgraded row inputs to use shared input styles for consistent SaaS-grade controls.
- Added missing layout classes for the weekly grid, daily cards, summary card, row actions, rejection states, and responsive behavior.

## Why the drawer issue happened
The reusable `Drawer` component was mounted, but the project relied on CSS classes (`mwPanelOverlay`, `mwPanel`, tab styles, footer styles) that were never defined in the global stylesheet. The drawer therefore existed in the DOM but had no production styling or reliable interaction layer.

## Why the admin dashboard failed
The API route for admin summary was selecting `hours` from `time_entries`, while the payroll math in this codebase is based on `v_time_entries.hours_worked`. In environments where `time_entries.hours` does not exist, Supabase returned a 400 error.

## Recommended next steps
1. Run a clean local/Vercel validation pass with environment variables present so TypeScript, lint, and route execution can be verified end to end.
2. Continue the same SaaS polish pass on Projects, People, Approvals, and Admin surfaces so all command bars use the same visual system.
3. Add a dedicated shell QA checklist for desktop/mobile, drawer interactions, and payroll/export flows before the next baseline freeze.


## Additional UI / UX correction pass

### Issues observed from screenshots
- Sidebar brand block was visually oversized and felt disconnected from the product shell.
- Approvals groups were rendering as plain text stacks with weak hierarchy.
- Payroll report insight content was too verbose and visually heavy.
- Payroll runs trust/audit section rendered as a long raw text block.
- People toolbar controls lacked consistent shell-level styling.
- Deprecated mobile web app metadata was still surfacing browser warnings.

### Fixes applied in this pass
- Reworked `AppShell` brand treatment to a compact SETU GROUP / SETU TRACK hierarchy using the knot icon and product text instead of the oversized raster lockup.
- Added dedicated approvals page styles for cards, totals, action clusters, daily mini summaries, and detail rows.
- Refined payroll report narrative content into a tighter SaaS summary card.
- Refactored payroll runs trust/audit information into structured metric cards.
- Added people toolbar search/filter styling so controls align with the rest of the SETU shell.
- Simplified root metadata to remove deprecated mobile-web-app-capable behavior.

### Files updated in this pass
- `src/components/layout/AppShell.tsx`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/app/approvals/page.tsx`
- `src/app/reports/payroll/page.tsx`
- `src/app/reports/payroll-runs/page.tsx`
- `README.md`
