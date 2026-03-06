**Baseline:** Phase 2.9 feature set (2.7 receipts + 2.8 export center + 2.9 client deliverables), branded for **SETU GROUPS / SETU TRACK**.  
**Last update:** 2026-03-05.

# Architecture Overview (SETU TRACK)

## Core
- Next.js 14 (App Router) + Supabase (Auth + DB + RLS)
- Org-scoped data model (`org_id` everywhere)
- Roles: `admin`, `manager`, `contractor`

## UI system
- Global UI preferences (theme/accent/density/radius) are controlled from **Settings → Appearance**.
- Components are standardized around PageHeader / CommandBar / SummaryBar / TrustBlock / CommandCard.

## Payroll (Week 2)
### Reproducible payroll runs
Closing a period creates immutable snapshots:
- `payroll_runs` (one per org + period)
- `payroll_run_lines` (per contractor totals)
- `payroll_run_entries` (per time entry snapshot)

### Run detail (Phase 2.0)
- UI: `/reports/payroll-runs/[id]` renders directly from snapshot tables (audit view)
- API: `GET /api/payroll/runs/[id]` (admin)
- Export: `GET /api/payroll/run-export?run_id=...&mode=summary|detail` (admin)

### Export receipts (Phase 2.4)
Official exports create immutable receipts:
- `export_events` (org-scoped, optionally linked to `run_id` and/or `project_id`)
- API: `GET /api/exports/recent?period_start=...&period_end=...&project_id?` (admin/manager)
- UI: Payroll report + Payroll run detail show recent receipts for audit transparency

RPC:
- `close_payroll_period(p_period_start, p_period_end)` — validates approvals, locks pay period, snapshots payroll.

### Variance + lifecycle (Phase 2.5 → 2.6)
Snapshot-safe diffs never read from live `v_time_entries`.

- Diff vs previous locked period:
  - API: `GET /api/payroll/period-diff?period_start=...&period_end=...&project_id?`
  - API: `GET /api/payroll/run-diff?run_id=...&project_id?`
- Export-to-export variance (changes since last official export):
  - API: `GET /api/exports/since-last?period_start=...&period_end=...&project_id?`
- Paid lifecycle:
  - DB: `payroll_runs.paid_at/paid_by/paid_note`
  - RPC: `mark_payroll_run_paid(p_run_id, p_paid, p_note)`
  - API: `POST /api/payroll/runs/[id]/paid`

UI surfaces:
- Stage timeline: Preview → Approved → Locked → Exported → Paid
- Payroll report and Run detail both show variance + export receipts panels

### Close preview (UX hardening)
RPC:
- `payroll_close_blockers(p_period_start, p_period_end)` — returns unapproved entries grouped by contractor + status.

### Dashboard summary (performance)
RPC:
- `admin_dashboard_summary(p_period_start, p_period_end)` — returns KPI totals as JSON.

Indexes:
- `time_entries(org_id, entry_date)`
- `time_entries(org_id, entry_date, status)`
- `payroll_run_entries(payroll_run_id, contractor_id)`
- `payroll_runs(org_id, period_start, period_end)`


## Contractor Experience (Week 3)
- API: `POST /api/contractor/my-pay` returns period summary, pending entries, last closed payout, payout history (scoped to caller).
- Page: `/pay/my-pay` contractor earnings view.
- Contractor dashboard uses the same API for payout-first KPIs.

## Approvals Batch Actions (Week 3)
- API: `POST /api/approvals/batch-approve` (manager/admin) approves multiple weekly groups in one action.
