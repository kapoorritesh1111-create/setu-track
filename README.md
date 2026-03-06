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
