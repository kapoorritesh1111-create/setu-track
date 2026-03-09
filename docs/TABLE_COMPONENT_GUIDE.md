# Table Component Guide

## Standard
Use `src/components/ui/DataTable.tsx` for interactive list pages when possible.

## Principles
- Keep status rendering inside `Tag` / pill patterns.
- Right-align numeric and currency cells.
- Use consistent row actions.
- Prefer a dedicated empty state over blank tables.
- Keep sort behavior inside the table wrapper instead of ad-hoc page logic.

## Migration recommendation
Move the remaining hand-written tables toward the shared DataTable over time:
- Payroll Report tables
- Analytics recent runs
- Activity timelines where appropriate
