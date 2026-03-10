# SETU TRACK — Phase 3B-R1 Release

## Intent
Rebuild Phase 3B as a smaller, safer branch on top of the locked Phase 3A baseline.

## Scope in this release
- Added `src/lib/opsNotifications.ts` as a shared operations-signal helper
- Updated Dashboard action-center behavior to use shared blocker/risk/reminder signals
- Updated Analytics to surface the same shared signals without adding a new route
- Kept routing and navigation unchanged for safety

## Why this is safer
- no new page route
- no sidebar/nav changes
- no schema expansion
- additive logic only on existing pages

## Files changed
- `src/lib/opsNotifications.ts`
- `src/components/dashboard/admin/AdminDashboard.tsx`
- `src/app/analytics/page.tsx`
- `README.md`
- `docs/PHASE_3B_R1_RELEASE_2026-03-10.md`
- `docs/PHASE_3B_R1_QA_CHECKLIST_2026-03-10.md`
