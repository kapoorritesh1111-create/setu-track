# Database Schema Reference

This is the Phase 2J reference for the tables currently touched most often by the UI.

## profiles
Core user directory and role information.

Common columns used by UI:
- `id`
- `org_id`
- `full_name`
- `role`
- `manager_id`
- `hourly_rate`
- `is_active`
- `created_at`

## projects
Project workspace and budget settings.

Common columns used by UI:
- `id`
- `org_id`
- `name`
- `is_active`
- `week_start`
- `budget_hours`
- `budget_amount`
- `budget_currency`

## time_entries / v_time_entries
Time capture and reporting view.

Common fields used by UI:
- `id`
- `org_id`
- `user_id`
- `entry_date`
- `status`
- `project_id`
- `project_name`
- `full_name`
- `hours_worked`
- `hourly_rate_snapshot`

## payroll_runs
Closed payroll snapshots.

Common columns used by UI:
- `id`
- `org_id`
- `period_start`
- `period_end`
- `status`
- `total_hours`
- `total_amount`
- `created_at`

## export_events
Operational export history.

Confirmed UI-facing columns:
- `id`
- `org_id`
- `export_type`
- `file_format`
- `scope`
- `period_start`
- `period_end`
- `metadata`
- `created_at`

## audit_log
Audit trail for approvals, payroll lifecycle, and entity changes.

Confirmed UI-facing columns:
- `id`
- `org_id`
- `action`
- `entity_type`
- `entity_id`
- `actor_id`
- `metadata`
- `created_at`

## Note
This file is a UI schema reference, not a substitute for the full database migration history.
