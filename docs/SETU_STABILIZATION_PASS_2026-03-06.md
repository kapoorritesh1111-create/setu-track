# SETU TRACK Stabilization Pass — 2026-03-06

## What was fixed

### 1. Payroll summary no longer depends only on `project_exports`
- `src/app/api/payroll/summary/route.ts` now builds project/period summaries from locked `payroll_runs` + `payroll_run_entries`.
- `project_exports` is used as an overlay for receipts and paid state instead of being the sole source of truth.
- Result: Payroll page can show historical payroll summaries even when no project export has been generated yet.

### 2. Project export persistence hardened
- `src/app/api/payroll/client-export/route.ts` now treats `project_exports` persistence as required for the client bundle path.
- `src/app/api/payroll/export-pdf/route.ts` now persists project-scoped PDF exports into `project_exports` and links export events back to the created `project_export_id`.
- `src/app/api/exports/list/route.ts` now enriches export receipts with linked `project_exports` paid state, totals, currency, and project export ids.

### 3. Paid controls surfaced in the main workflows
- `src/app/reports/payroll/page.tsx` now shows paid status and inline `Mark paid` / `Mark unpaid` actions when a project export exists.
- `src/app/admin/exports/page.tsx` now shows paid status directly in the exports table and opens the receipt drawer from a primary paid action.
- `src/components/ui/ExportReceiptDrawer.tsx` now supports `onUpdated` so pages refresh state immediately after a paid/unpaid change.

### 4. SETU shell upgraded
- `src/components/layout/AppShell.tsx` now uses a dedicated `AppShell.module.css` shell instead of relying on the older `mw*` global classes.
- Sidebar/header/profile menu now reflect the intended SETU visual direction more closely.

## What still needs testing
- Generate a new project-scoped client export bundle and confirm a row appears in `project_exports`.
- On Payroll page, confirm locked historical periods appear even before exports exist.
- On Exports page, confirm paid state reflects updates immediately.
- On Payroll page, confirm `Mark paid` only appears after a linked export exists.

## Recommended next steps
1. Add paid state directly into Payroll Runs detail card and project export detail cards.
2. Add project names to Exports table instead of raw ids.
3. Add diff/reconciliation logic to compare latest export payload hash with current locked run totals.
4. Continue SETU visual polish on cards, tables, and detail pages.


## 2026-03-06 Late Patch — payroll report load + exports naming

### Fixed in this repo package
- Payroll report endpoint now returns the exact payload the UI expects: `range`, `options`, `kpis`, `trend`, `project_summary`, `contractor_summary`, `register`, `recent_activity`.
- Resolved the runtime crash on `/reports/payroll` that surfaced as `Cannot read properties of undefined (reading 'preset')`.
- Removed invalid `export_events` field assumptions from payroll summary and aligned it to the real table shape (`actor_id`, `project_export_id`, `metadata`).
- Exports list now resolves project names from `projects` so the table shows business-readable project labels instead of UUIDs.
- App shell header now uses the SETU TRACK logo asset for stronger brand consistency.

### Verify after deploy
1. Open `/reports/payroll` and change presets between Current Week, Last Week, Current Month, Last Month.
2. Confirm By Project / By Contractor / Register all render without console errors.
3. Open `/admin/exports` and confirm the Project column shows project names.
4. Open `/reports/payroll-runs`, use Mark paid, then confirm paid state flows back into Payroll Report and Exports.
