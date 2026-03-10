# SETU TRACK — Phase 3B QA Checklist

## Smoke test
- open Dashboard as admin
- confirm Action center renders without runtime errors
- confirm Notifications button routes to `/admin/notifications`
- confirm recent signals open the correct destination pages

## Notifications workspace
- open `/admin/notifications`
- confirm KPI row loads
- confirm priority queue renders
- confirm reminder-ready people list loads
- confirm budget risk list loads
- confirm export readiness card loads
- verify empty-state behavior when no alerts exist

## Analytics
- confirm forecast movement card renders
- confirm management signals section renders
- confirm notifications shortcut works

## Projects
- confirm Forecast burn signal card renders
- confirm Top projects at risk header button routes to Notifications

## Approvals
- confirm Notifications button appears in focus row
- confirm Reminder readiness card renders

## Role behavior
- admin: notifications visible in nav and page accessible
- manager: notifications visible in nav and page accessible
- contractor: notifications hidden from nav

## Regression checks
- Dashboard still loads current metrics
- Projects filters still work
- Approvals actions still approve/reject correctly
- Analytics still loads historical bars and tables
- Export pages still load
- dark mode styling looks correct on notification cards

## Deployment check
- run `npm install`
- run `npm run typecheck`
- run `npm run build`
- verify Vercel preview before production promotion
