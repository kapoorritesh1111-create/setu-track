# SETU TRACK — Phase 3A QA Checklist

## Dashboard
- [ ] Dashboard loads for Admin with no runtime error.
- [ ] KPI row renders in both light and dark mode.
- [ ] Signal row renders correctly and does not overflow on tablet/mobile widths.
- [ ] Project health cards show progress bars and navigate to detail/report destinations.
- [ ] Recent activity and payroll runs sections render with formatted timestamps.

## Projects
- [ ] Finance controls keep the selected date range stable.
- [ ] Risk summary cards render for budgeted and non-budgeted projects.
- [ ] Top projects at risk queue opens the drawer correctly.
- [ ] Table rows still support selection, activation/deactivation, and assignment workflows.

## Approvals
- [ ] Queue summary metrics match visible groups.
- [ ] Scope filters (`all`, `stale`, `overtime`, `locked`) still work.
- [ ] Group badges show stale / long-hours / missing-notes correctly.
- [ ] Approve / reject flows still work for unlocked groups.

## Analytics
- [ ] KPI row and signal row render for the selected date range.
- [ ] Recent payroll runs table formats amounts and timestamps correctly.
- [ ] Budget variance panel shows high-risk project list when relevant.

## Activity
- [ ] Audit timeline renders without raw internal wording.
- [ ] Operations timeline shows payroll runs and exports in readable hierarchy.
- [ ] Top signal strip renders correctly in both themes.

## Data trust
- [ ] Money formatting uses shared helper output across touched pages.
- [ ] Date ranges and timestamps render consistently.
- [ ] Empty states and error states remain readable in both themes.

## Release validation
- [ ] `npm install`
- [ ] `npm run build`
- [ ] Role-based smoke test: admin / manager / contractor
- [ ] Check Vercel preview before production promote
