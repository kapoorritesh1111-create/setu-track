# SETU TRACK — Next Phase Sprint (2026-03-08)

## What was reviewed
- Current People page runtime failure on `/profiles`
- Current dashboard/payroll/admin maturity from existing repo structure
- Existing docs and recent stabilization notes

## Immediate fix included in this pass
1. Rebuilt `PeopleDirectory` into a simpler, safer render path with no memo-driven hook complexity.
2. Removed redundant `useProfile()` usage from `src/app/profiles/page.tsx` to reduce page-level auth/profile hydration churn.
3. Kept inline profile editing, bulk activation, filtering, and selection workflows intact.
4. Upgraded the People page to a clearer SaaS-style directory surface with metric cards and a cleaner table footer summary.

## Product review summary
SETU TRACK is now beyond raw MVP, but still in the stabilization-to-productization band. The next highest-value milestone is not adding random modules. It is tightening the operational core so the app feels trustworthy for managers and finance users.

## Recommended next release
## Release: Approvals + Workforce Finance UX

### Product goals
- Turn approvals into a true review queue
- Surface payroll-risk anomalies earlier
- Make people/project/payroll views feel like one connected operating system

### Scope
- Approvals queue with grouped cards by person and project
- Exception badges for missing rates, rejected rows, unapproved hours, and stale entries
- Better dashboard period selector with shared range control primitive
- Project labor finance groundwork: approved cost vs budget and utilization placeholders
- People page cleanup and rate-completion prompts

### Engineering goals
- Consolidate shared filter-bar and metric-strip primitives
- Reduce page-local duplication in data loading
- Move more report math into typed helper functions or API summaries
- Add page-level smoke QA checklist for dashboard, people, approvals, payroll, exports

### UX goals
- Faster manager review flow
- Stronger financial hierarchy
- Cleaner empty, loading, and warning states
- Consistent layout between dashboard, people, approvals, and payroll

## Next recommended implementation order
1. Approvals redesign
2. Shared date-range / filter primitives
3. Dashboard financial-intelligence cards
4. Project budget-vs-actual groundwork
5. Export-to-invoice linkage improvements
