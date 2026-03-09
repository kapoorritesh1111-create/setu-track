# SETU TRACK — Phase 2F Project Finance Layer

## What was added

This pass turns the earlier budget schema groundwork into visible product behavior.

### Projects workspace
- Project budgets are now loaded from `projects.budget_hours`, `projects.budget_amount`, and `projects.budget_currency`.
- The Projects page now shows:
  - budget coverage
  - actual labor this month
  - budget vs actual totals
  - hours vs plan
- Each project row now includes:
  - budget target
  - current-month actual labor
  - variance / health state
- The project drawer now supports budget editing for admins.
- Project creation now supports optional budget fields.

### Payroll report
- Payroll project summary is now budget-aware.
- Project rows surface budget and variance alongside payroll totals.
- Side insight panel now shows budget-vs-actual status instead of only cost concentration.

### Analytics
- Analytics now loads project budgets.
- Project labor mix indicates whether each project is within budget or over budget.
- Coverage KPI now references over-budget projects.

## Why this matters

This moves SETU TRACK beyond time/payroll administration and into project labor finance:

Work logged → Approved → Payroll visible → Budget vs actual visible

That gives managers and admins a better answer to:
- which projects are consuming the most labor
- which projects are running over labor plan
- whether budget tracking exists across the visible project set

## Next recommended step

Phase 2G should add:
- budget filtering on Projects and Payroll Report
- budget-aware dashboard project health cards
- project month selector / shared period state for Projects finance
- over-budget alerts in command center and analytics
