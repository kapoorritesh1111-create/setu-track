# Payroll Report V3 — Implemented 2026-03-06

## What changed
- Payroll Report now supports three reporting lenses:
  - By Project
  - By Contractor
  - Register
- Date filters now support:
  - Current Week
  - Last Week
  - Current Month
  - Last Month
  - Custom Range
- Period scope now supports:
  - Closed only
  - Open + Closed
- Contractor summaries include **anyone with active time entries in scope**, including admins or managers who logged time.
- Access scope is role-aware:
  - Admin: full org view
  - Manager: self + direct reports + related project access (best-effort using `project_members`)
- Payroll summary endpoint now returns:
  - `kpis`
  - `trend`
  - `project_summary`
  - `contractor_summary`
  - `register`
  - `recent_activity`
  - `filter options`

## Product intent
Payroll Report is now the **finance-facing workspace**.

Payroll Runs remains the **operations/control** screen for:
- run history
- lock/close state
- mark paid / unpaid
- run exports

Exports remains the **audit/archive** screen for:
- receipts
- artifact history
- linked export activity

## Data behavior
### Closed only
- Uses `payroll_runs` + `payroll_run_entries`
- Preserves immutable locked payroll totals

### Open + Closed
- Includes locked payroll rows from runs
- Adds in-range `time_entries` not already captured in locked runs
- Uses current time-entry snapshots for open-period calculations

## Key UI outcomes
- KPI cards summarize cost, hours, paid amount, and rows needing export
- Trend card shows payroll cost by period
- Project summary and contractor summary now share the same filter set
- Register rows expose:
  - export state
  - payment state
  - receipts
  - mark paid / mark unpaid
  - export-first workflow

## Remaining follow-up items
- Tighten manager access logic if project-membership rules expand
- Reduce `Not linked` receipts in Exports by enforcing project-export linkage in every export path
- Consider adding one compact chart to Payroll Runs if more periods accumulate
