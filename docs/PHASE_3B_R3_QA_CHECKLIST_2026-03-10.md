# Phase 3B-R3 QA Checklist

## Build gate

- npm install
- npm run build

## Route checks

- /dashboard
- /analytics
- /approvals
- /projects
- /admin/notifications

## Role checks

- admin sees Notifications in nav and page loads
- manager sees Notifications in nav and page loads
- contractor does not see Notifications in nav
- direct URL for contractor shows restricted access state

## Behavior checks

- filters by severity work
- filters by area work
- notifications link into payroll / approvals / projects / exports destinations
- refresh button reloads the signal list
- dashboard action center button opens notifications page
- approvals notifications button opens notifications page
- projects notifications button opens notifications page
