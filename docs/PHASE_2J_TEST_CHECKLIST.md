# Phase 2J Test Checklist

## Global shell
- Open each top-level page from the sidebar.
- Confirm the active nav item is highlighted.
- Confirm the grouped navigation reads: Operations / Organization / Finance / Admin.

## Activity
- Open `/admin/activity`.
- Confirm audit events load.
- Confirm export events load.
- Confirm payroll runs load.
- Confirm there is no schema error banner.

## Analytics
- Open `/analytics`.
- Switch the date preset.
- Confirm loading state renders while data refreshes.
- Confirm any query failure shows a retryable error banner.
- Confirm empty state still renders for no-data ranges.

## Dashboard
- Open `/dashboard`.
- Confirm budget and operations cards still load.
- Confirm period switching still refreshes values.

## Projects
- Open `/projects`.
- Open a project drawer.
- Confirm actuals and budget values still render.

## Payroll Report
- Open `/reports/payroll`.
- Confirm the page opens with current filters.
- Confirm summary cards and tables still render.

## Time Entry
- Open `/timesheet`.
- Confirm templates, copy-last-week, and copy-across-week still work.
