# SETU TRACK — Phase 3 Baseline Execution Plan

This document is the **authoritative Phase-3 build plan** for converting the current repo into a clean, deployment-ready baseline **without removing existing working features**.

## Goals
- Keep all existing working systems (Timesheet, Approvals, Payroll Runs, Exports, My Pay)
- Apply **SETU SaaS Blueprint UI kit** consistently (shell, cards, tables, reports, settings)
- Implement missing **Org Settings** + Admin foundations required for branding + invoices
- Maintain a Vercel-safe build (`npm run build`)

---

## Step 0 — Baseline audit lock-in
Deliverable: `docs/PHASE_3_BASELINE_AUDIT.md`
- Route map (role access)
- API map
- Schema map + known mismatches
- Known UI/Blueprint gaps
- Known build risks (env vars, server/client boundaries)

---

## Step 1 — Blueprint foundation (UI system)
**Why:** Establish the UI contract (tokens + shell + nav) before adding new product surfaces.

### 1.1 Tokens + theming
- Continue using `globals.css` token layer as the single source of truth.
- Support org-controlled accent via `org_settings.accent_color`:
  - preset keys: `blue | indigo | emerald | rose | slate`
  - OR custom hex: `#RRGGBB`
- Apply tokens client-side via `ThemeProvider`:
  - `theme`, `density`, `radius` remain user prefs (`profiles.ui_prefs`)
  - **accent becomes org-controlled**

### 1.2 AppShell + navigation
- Ensure sidebar + header match Blueprint prototypes.
- Add admin-only nav entries needed for Phase-3 surfaces:
  - `/admin/org-settings`
  - (Billing placeholder added later in Step 3)

**Status:** IMPLEMENTED in this repo update (Step 1 partial: branding token foundation + admin nav).

---

## Step 2 — Organization Settings system (schema + RLS + admin UI)
**Why:** Org settings unlock branding tokens and invoice defaults.

### 2.1 Schema + RLS
Migration: `supabase/migrations/0022_org_settings.sql`
- Table: `public.org_settings` (one row per org)
- Fields:
  - `company_name`, `legal_name`, `logo_url`
  - `accent_color`
  - `invoice_header_json`, `invoice_footer_text`
  - `default_currency`
- RLS:
  - org members can `SELECT` (branding + invoice rendering)
  - only admins can `INSERT/UPDATE`

### 2.2 API
- `GET /api/org-settings` (org members read)
- `GET/POST /api/admin/org-settings` (admin read/write)

### 2.3 Admin UI
Route: `/admin/org-settings`
- Company identity
- Branding + currency
- Invoice header JSON inputs
- Invoice footer text

**Status:** IMPLEMENTED in this repo update (Step 2 complete).

---

## Next (not yet implemented in this update)
### Step 3 — Admin completion

✅ **Implemented in Phase-3 baseline (this repo):** `/admin/billing` placeholder + Admin navigation consistency

- Members / user management polish
- Billing placeholder (`/admin/billing`)
- Exports management improvements

### Step 4 — Payroll “Paid” completion
- payroll run paid (already present)
- project export paid (schema + endpoints + UI)

✅ **Implemented in this repo update (Step 4):**
- Added `project_exports` table + RLS + paid lifecycle fields (`is_paid`, `paid_by`, `paid_at`, `paid_note`)
- Linked immutable `export_events` receipts to `project_exports` via `export_events.project_export_id`
- On client bundle generation, we upsert a `project_exports` record and attach `payload_hash` for diff tracking
- Added API to mark project exports paid/unpaid: `POST /api/projects/:projectId/exports/:exportId/paid`
- Updated Export Receipt Drawer to show paid status + allow marking paid (admin)

### Step 5 — Export system productization
- Export Center (`/exports`) for manager/admin
- Receipts, history, ZIP bundle, PDF summary, diff detection

### Step 6 — TypeScript + schema alignment pass
- fix nullability/type mismatches
- ensure display names for `locked_by` and similar IDs

### Step 7 — Docs + deployment checklist refresh
- Schema, API map, role matrix, env vars, release checklist updates

---

## Environment variables (Phase-3 baseline)
Required on Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Recommended:
- `NEXT_PUBLIC_APP_URL` (preferred)
- `NEXT_PUBLIC_SETUE_URL` (legacy fallback currently used in invite flow)


---

## March 6, 2026 cleanup pass

This cleanup pass focused on stabilizing the `src/app` codebase and removing regressions introduced by incompatible shared-component changes.

Completed in this pass:
- Rebuilt `src/components/ui/DataTable.tsx` to support both old and new table calling conventions used across Admin, Projects, Profiles, and Reports pages.
- Rebuilt `src/components/ui/ExportReceiptDrawer.tsx` so it has one canonical exported `ExportReceipt` type and a complete paid-status flow.
- Fixed `src/app/api/payroll/summary/route.ts` to use the role gate correctly via `gate.profile.org_id`.
- Added `src/styles/tokens.css` and `src/styles/components.css` and imported them globally from `src/app/globals.css`.
- Updated shell token sizing to the SETU target layout (`270px` sidebar, `84px` header).

Known next-day priorities:
1. Run a final build verification pass in the deployment repo and remove any stale duplicate route files that may still exist outside `src/app` in GitHub.
2. Refactor Payroll Runs and Payroll Detail to use shared `.setu-card`, `.btn`, `.pill*`, and `.table*` classes more consistently.
3. Add a small internal QA checklist to validate exports, paid status, and appearance modes after deployment.
