# SETU TRACK — UI System Refresh (2026-03-07)

This pass applies the locked SETU TRACK brand direction and starts the full product-shell redesign.

## What changed

- introduced the blue/teal SETU token system in `src/styles/tokens.css`
- upgraded primary action styling to use the new gradient system
- refreshed the global shell background and elevated surface styling in `src/app/globals.css`
- updated `AppShell` navigation language from **Home** to **Dashboard**
- added **Analytics** as a first-class navigation destination
- updated sidebar brand copy to align with the locked direction:
  - Connect • Track • Grow
  - contractor operations, payroll intelligence, and analytics
- added the brand icon pack under `public/brand-system/icons`
- introduced reusable UI blocks:
  - `CommandCenterHero`
  - `WorkspaceKpiStrip`
- redesigned the top of the Dashboard into a command-center hero section
- added KPI strips to Projects and People so page hierarchy starts to follow the new system
- created a new `/analytics` route to establish the analytics surface for the platform

## Why this matters

This begins the transition from a module-based internal tool toward a finance-grade SaaS platform shell.
The product now starts to reflect the intended positioning:

**workforce + projects + payroll + analytics**

instead of a collection of disconnected pages.

## What remains for the next implementation pass

1. move remaining pages to the new shared header → KPI → workspace → insight anatomy
2. replace demo KPI content with consolidated dashboard / analytics services
3. redesign Payroll Runs and Exports with the same visual hierarchy
4. normalize status pills and table presentation across every operational view
5. complete mobile/tablet behavior review once the shared system is fully migrated


## Pass 2 — Brand + Finance Workflow Normalization
- applied the new locked logo pack to public brand assets, favicons, app icons, and manifest-facing icons
- extended the SETU UI system into Payroll Runs, Exports, Approvals, and Admin Settings
- replaced demo analytics/dashboard hero values with live dashboard aggregation routes
- normalized status presentation toward shared StatusChip language and improved responsive shell behavior
