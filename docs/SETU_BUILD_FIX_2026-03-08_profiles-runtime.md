# SETU TRACK — Profiles Runtime Fix (2026-03-08)

## Issue addressed
The deployed `/profiles` page was still crashing behind the app error state with a production React hook error.

## What changed
- Replaced the People page directory rendering with a simpler, deterministic render path.
- Removed memo-heavy derived state from `src/components/people/PeopleDirectory.tsx`.
- Removed redundant `useProfile()` usage from `src/app/profiles/page.tsx`.
- Preserved inline editing, bulk activation, manager assignment, and filtering.

## Why this should be more stable
The page now relies on plain derived values during render instead of multiple memo branches layered around visibility and table generation. This makes the render path much easier to reason about and much less likely to drift into hook-order issues during auth/profile hydration.
