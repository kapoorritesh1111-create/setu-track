# SETU TRACK — Phase 2J Platform Alignment + Data Reliability

## Purpose
Phase 2J is a platform hardening pass. The goal is to make the product safer to extend by aligning data-loading patterns, page structure, and shared UI states before moving to the next major feature phase.

## What changed
- Added a shared `SetuPage` layout wrapper so pages can follow a consistent header → controls → content rhythm.
- Added reusable state components:
  - `LoadingState`
  - `ErrorState`
  - `PageSkeleton`
  - `TableSkeleton`
- Added `src/lib/data/activityData.ts` to centralize Activity page queries and reduce schema-drift risk.
- Refactored `/admin/activity` to use the shared data helper and standardized state handling.
- Refactored `/analytics` to use shared loading and error treatment.
- Added platform documentation for schema assumptions, query patterns, page structure, and table usage.

## Why this matters
Recent releases introduced more finance and operations surfaces. That increased the risk of page-to-page drift and schema mismatch regressions. Phase 2J reduces that risk by moving repeated logic into safer shared patterns.

## Files added
- `src/components/layout/SetuPage.tsx`
- `src/components/ui/LoadingState.tsx`
- `src/components/ui/ErrorState.tsx`
- `src/components/ui/PageSkeleton.tsx`
- `src/components/ui/TableSkeleton.tsx`
- `src/lib/data/activityData.ts`
- `docs/QUERY_PATTERNS.md`
- `docs/PAGE_LAYOUT_STANDARD.md`
- `docs/TABLE_COMPONENT_GUIDE.md`
- `docs/DATABASE_SCHEMA.md`

## Pages aligned in this pass
- `/admin/activity`
- `/analytics`

## Follow-on recommendation
Use the same shared state components and data-layer pattern on:
- `/dashboard`
- `/projects`
- `/reports/payroll`
- `/approvals`
- `/profiles`
