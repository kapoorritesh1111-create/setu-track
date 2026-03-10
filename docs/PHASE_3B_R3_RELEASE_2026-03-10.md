# SETU TRACK — Phase 3B-R3 Release

Date: 2026-03-10

## Scope

This release adds the dedicated notifications workspace on top of the narrower R1 and R2 signal foundation.

## Included

- new notifications page at `/admin/notifications`
- manager/admin-only access model
- shared ops signal rendering using the existing `opsNotifications` helper
- dashboard quick handoff to notifications
- approvals quick access to notifications
- projects quick access to notifications
- navigation entry for notifications

## Safety notes

- no schema changes
- no new backend routes required
- builds on the already introduced shared signal helper
- keeps data loading limited to existing tables/views already used elsewhere in the app

## Primary QA focus

- admin can open notifications page
- manager can open notifications page and sees team-scoped signals
- contractor does not see nav entry and cannot use the page
- dashboard notifications handoff works
- approvals notifications handoff works
- projects notifications handoff works
