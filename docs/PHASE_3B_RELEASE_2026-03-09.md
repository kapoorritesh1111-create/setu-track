# SETU TRACK — Phase 3B Release

Date: 2026-03-09

## Release theme
Automation groundwork, notification readiness, and payroll forecast actionability.

## What changed

### 1. Notification center groundwork
- Added `/admin/notifications` as a dedicated operations alert surface.
- Centralized reminder/blocker/risk/export alert generation in `src/lib/opsNotifications.ts`.
- Notifications now classify:
  - approval blockers
  - missing timesheet reminders
  - contractor rate audit gaps
  - project budget risk
  - export readiness
  - forecast movement

### 2. Dashboard actionability
- Added an **Action center** panel to the command center.
- Surfaced the same shared notifications directly on Dashboard so admins/managers can move from signal → action faster.
- Added direct navigation into the notifications workspace.

### 3. Analytics intelligence
- Added forecast movement visibility.
- Added shared management signals so Analytics now reflects the same operational alert model used across the platform.

### 4. Projects finance signals
- Added forecast burn visibility to the Projects signal row.
- Added direct handoff from project risk to the notification center groundwork.

### 5. Approvals queue readiness
- Added reminder-readiness visibility so missing submissions + stale queues can evolve into future automated nudges.
- Added direct access from Approvals to the new notifications workspace.

### 6. Navigation + UI consistency
- Added Notifications to app navigation for admin/manager roles.
- Added shared notification card styles in `src/app/globals.css`.

## Design intent
Phase 3A made SETU TRACK feel more like an operations cockpit.
Phase 3B starts turning that cockpit into a system that knows what should happen next.

This is still groundwork, not full automation orchestration. The release is meant to make:
- future reminder jobs easier to wire
- future notification center features easier to extend
- payroll forecast drift easier to spot before close
- export readiness more visible after lock

## Recommended next branch after this
- scheduled reminder jobs
- notification delivery preferences
- in-app inbox persistence table
- forecast vs locked-run variance history
- budget alert rules by project owner / manager
