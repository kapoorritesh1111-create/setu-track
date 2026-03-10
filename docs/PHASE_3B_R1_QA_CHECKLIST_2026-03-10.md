# Phase 3B-R1 QA Checklist

## Build gate
- [ ] `npm run build` passes
- [ ] `npm run typecheck` passes

## Dashboard
- [ ] Admin dashboard loads with no runtime errors
- [ ] Action center renders shared signals when data exists
- [ ] Action center shows safe fallback when there are no signals

## Analytics
- [ ] Analytics page loads with no runtime errors
- [ ] Actionable signals render correctly
- [ ] Existing project/people/payroll sections still render

## Regression check
- [ ] No new routes were introduced
- [ ] No navigation changes were introduced
- [ ] Role-based access remains unchanged
