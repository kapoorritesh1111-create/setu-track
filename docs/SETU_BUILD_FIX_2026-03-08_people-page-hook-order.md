# SETU BUILD FIX — 2026-03-08 — People page hook-order runtime fix

## Issue
The `/profiles` page was still crashing in production with minified React error `#310`.

## Root cause
`src/components/people/PeopleDirectory.tsx` still declared `stripItems` with `useMemo()` after conditional early returns for loading, auth, and admin-only access.

That changes hook execution order between renders and triggers the React hook-order runtime failure in production.

## Fix applied
- moved the `stripItems` `useMemo()` above all early returns
- kept the dashboard period-selector improvements from the prior pass intact

## Result
The People page now keeps a stable hook order across all render paths.
