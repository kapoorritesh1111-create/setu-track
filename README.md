# SETU TRACK (by SETU GROUPS)

**Brand system active:** SETU_Rebuilt_Startup_Brand_System  
**Primary UI reference:** SETU_TRACK_SaaS_Interface_Blueprint_Pack

Brand assets live in:
- `public/brand/setu-groups-logo.svg`
- `public/brand/setu-track-logo.svg`
- `public/brand/setu-knot-icon.svg`
- `public/favicon.ico` (generated from `favicon_16/32.png`)



# SETU TRACK SaaS


## Product Goals
🚀 Product Direction (2026)

This platform is evolving into a:

**Contractor-First Payroll Command Platform**

Inspired by Deel’s UX clarity,
focused on financial authority and workflow transparency.

Primary objectives:

* Clear payroll summary surfaces

* Workflow-driven approval visibility

* Manager-level oversight

* Audit-ready design

* Calm enterprise UI

**See /docs/PRODUCT_GOALS.md for the full product charter.**

Key docs:
- `docs/PRODUCT_GOALS.md` — product charter + next phases
- `docs/DEEL_UX_GAPS.md` — what still feels below Deel-level UX
- `docs/RELEASE_CHECKLIST.md` — what’s completed + what to verify before release
- `docs/UI_STRATEGY.md` — UI rules + component hierarchy

## Current baseline status
Baseline is completed through **Phase 2.8 (Deel-level export polish + Export Center + client deliverable packaging)**.

What should work end-to-end in this baseline:
- Lock a pay period (“Monthly close”) → creates an immutable payroll run snapshot
- Payroll report shows locked state + trust/audit panel
- Payroll report shows **Diff vs previous locked period** (org + optional project scope)
- Locked/Closed/Approved status chips are consistent and read as “complete” (green)
- Exports:
  - CSV: Summary + Detail (official exports require locked period)
  - PDF: Summary + Detail generated server-side (no browser print)
  - Client bundle: Project-scoped ZIP (Summary+Detail CSV + Summary+Detail PDF + manifest)
- “Locked by” displays the user’s **full name** (not UUID)
- Official exports generate immutable **export receipts** (`export_events`) visible on Payroll + Payroll Run Detail pages
- Admin Export Center: `/admin/exports` (audit log + receipt drill-in)

See `docs/RELEASE_CHECKLIST.md` for the full completed list + verification steps.
## Run locally

```bash
npm install
npm run dev
```

## 🧱 Development Rule

All new UI changes must align with:

* PRODUCT_GOALS.md

* DEEL_UX_GAPS.md

No feature additions without alignment to product pillars.


## Phase 2.6 — Export-to-export variance + Stage timeline

- Export receipts already logged in `export_events` (Phase 2.4).
- Phase 2.6 adds snapshot-safe variance vs the most recent official export for the period/project via `GET /api/exports/since-last`.
- Adds a Stage timeline: Preview → Approved → Locked → Exported → Paid.
- Adds admin 'Mark paid' workflow for payroll runs (DB + API).

## Next after deployment

### Phase 2.9 — Client deliverables (brand + handoff)
- Add org branding (logo, legal name, currency) to PDF headers + cover
- Export email handoff: generate “client-ready email” text + attach bundle
- Optional: invoice-style PDF + PO/reference fields

### Phase 3 — Multi-tenant readiness
- Org settings page (branding + compliance + export defaults)
- Enterprise audit log expansion (lock/unlock/pay/export events)


## 2026-03-06 Cleanup + Stabilization

Completed today:
- removed stale duplicate payroll runs client file so only the active src/app route tree remains
- added migration `0024_project_exports_totals.sql` to persist `total_hours`, `total_amount`, and `currency` on `project_exports`
- fixed payroll summary API to read real persisted totals with metadata fallback
- updated client export flow to save project export totals when generating payroll client bundles
- updated payroll run detail API to return normalized `run.is_paid`, `lines`, and `receipts`
- added visible Mark Paid / Mark Unpaid controls on payroll runs list and payroll run detail
- strengthened SETU sidebar and nav styling so the indigo + saffron shell is consistently applied

Current working areas:
- Dashboard
- Timesheet
- Payroll summary
- Payroll runs list
- Payroll run detail
- Project exports / receipts
- Admin pages

Before deploy:
1. run Supabase migration `0024_project_exports_totals.sql`
2. run `npm install`
3. run `npm run build`
4. deploy to Vercel

Tomorrow next:
- payroll PDF polish
- exports reconciliation UX
- admin org/billing refinements
- settings appearance enforcement across remaining pages


## 2026-03-06 Payroll Report V3

Implemented today:
- Payroll Report upgraded to a finance-facing workspace with three lenses:
  - By Project
  - By Contractor
  - Register
- Filters now support:
  - Current Week / Last Week
  - Current Month / Last Month
  - Custom Range
  - Closed only / Open + Closed
- Contractor summaries now include anyone with active time entries in scope, including admins and managers when they logged time.
- Payroll summary API now returns KPI cards, trend data, project summary, contractor summary, register rows, recent activity, and filter options in one payload.

Files touched in this pass:
- `src/app/api/payroll/summary/route.ts`
- `src/app/reports/payroll/page.tsx`
- `src/app/globals.css`
- `docs/PAYROLL_REPORT_V3.md`

Next recommended polish:
- tighten export-link consistency so Exports shows fewer `Not linked` rows
- add optional run-action export menu polish on Payroll Runs
- tighten manager/project access rules if visibility logic changes


## 2026-03-06 Payroll + Export Stability Patch

Latest repo corrections in this package:
- fixed the Payroll Report API/UI payload mismatch that caused `Cannot read properties of undefined (reading "preset")`
- corrected payroll summary to use `entry_date` semantics and locked payroll snapshots from `payroll_runs` + `payroll_run_entries`
- removed invalid `export_events` column assumptions in payroll summary (`created_by`, `payload_hash`) and aligned the endpoint to real schema fields
- kept paid state + receipts driven from `project_exports` / `export_events`
- Exports table now resolves **Project Name** instead of showing only raw project ids
- AppShell branding strengthened with the SETU TRACK logo and warmer active-nav treatment

Primary files updated in this patch:
- `src/app/api/payroll/summary/route.ts`
- `src/app/api/exports/list/route.ts`
- `src/app/admin/exports/page.tsx`
- `src/components/layout/AppShell.tsx`
- `src/app/globals.css`
- `docs/SETU_STABILIZATION_PASS_2026-03-06.md`


## 2026-03-06 stabilization pass

Included in this repo update:
- Restored global SETU UI tokens + shared component styles through `src/app/globals.css` imports.
- Fixed shell/layout styling regressions across dashboard, payroll, payroll runs, and exports.
- Fixed payroll summary user-name resolution so visible active users do not fall back to `Unknown User` unless no profile name exists.
- Improved project-name fallback logic in payroll summary and recent export activity.
- Enriched `/api/exports/list` so receipts carry project name, period label, and paid-state metadata cleanly.
- Updated dashboard admin summary to use live payroll run + current-period entry aggregation rather than depending on a single RPC.


## 2026-03-06 Brand Integration + Reporting Polish

Included in this repo package:
- brand asset integration refreshed from the SETU brand system zip
- favicon, app icon, manifest, Apple touch icon, and OG assets added to `public/`
- metadata updated for branded icons + social cards
- login page redesigned into a full SETU branded authentication experience
- admin dashboard upgraded with current month vs previous month payroll comparison cards and hours deltas
- export center upgraded with clearer receipt status, diff labeling, project/period context, and paid-state summaries
- receipt drawer upgraded with stronger project-period hierarchy and paid-state controls
- payroll report actions refined so linked exports surface receipt history and export tracking more clearly

Recommended deployment check:
1. `npm install`
2. `npm run build`
3. verify `/login`, `/dashboard`, `/reports/payroll`, `/reports/payroll-runs`, and `/admin/exports`


## 2026-03-07 UI / UX stabilization sprint

Included in this replacement repo:
- rebuilt the shell branding hierarchy so the product shows as **SETU TRACK** with **SETU GROUP** as the parent brand
- replaced the oversized sidebar/header logo treatment with a compact icon + product identity block
- removed deprecated mobile web app metadata that was generating browser console warnings
- added dedicated approvals dashboard styling so submitted weeks render as real approval cards instead of raw dev tables
- tightened payroll report narrative panels and payroll runs trust/audit summary presentation
- improved people directory toolbar styling and filter consistency
- retained the prior runtime fix for the admin dashboard payroll summary API path

Recommended verification after deploy:
1. `/dashboard`
2. `/timesheet`
3. `/approvals`
4. `/projects`
5. `/profiles`
6. `/reports/payroll`
7. `/reports/payroll-runs`
8. `/admin/org-settings`
