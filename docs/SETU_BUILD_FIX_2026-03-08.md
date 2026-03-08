# SETU TRACK — Build + People/Dashboard Fix Pass (2026-03-08)

## Issues addressed
- Fixed the People page runtime crash caused by a hook-order violation in `PeopleDirectory`.
- Restored the dashboard period selector so admins can switch between current week, last week, current month, last month, and a custom date range.
- Added explicit start/end date inputs on the dashboard for custom comparisons.

## Files updated
- `src/components/people/PeopleDirectory.tsx`
- `src/components/dashboard/admin/AdminDashboard.tsx`

## Notes
- The People page error matched a React hook-order failure: a `useMemo` ran after early returns, which changed the hook count between renders.
- The dashboard now uses the selected reporting window as the active KPI period and automatically computes a comparable previous range.
