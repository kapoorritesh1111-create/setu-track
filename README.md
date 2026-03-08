# SETU TRACK — current baseline

SETU TRACK is the active SaaS baseline for contractor operations, approvals, payroll reporting, exports, and admin workflows.

## Product position
SETU TRACK is moving from a stitched-together internal tool into a contractor operations command platform. The near-term product edge is:
- cleaner operator workflow than generic timesheet tools
- stronger project-linked payroll visibility
- clearer approval and export readiness
- calmer, more premium SaaS UX

## Current repo scope
Main product areas in this baseline:
- Login / onboarding
- Dashboard
- Timesheet
- Approvals
- Projects
- Profiles / settings
- Payroll report
- Admin areas: exports, billing, org controls
- Supabase migrations for payroll, locks, exports, and analytics

## Local setup
Create `.env.local` from `.env.example` and set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## Commands
```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Vercel
Recommended settings:
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `.next`
- Node version: `20.x`

## Repo guidance
This repository is the single source of truth for the current SETU TRACK baseline. Older stabilization notes and duplicate release memos were intentionally removed to reduce drift.

Use these docs first:
- `docs/CURRENT_PRODUCT_STATE.md`
- `docs/COMPETITIVE_ASSESSMENT.md`
- `docs/ARCHITECTURE.md`
- `docs/DESIGN-SYSTEM.md`
- `docs/BRANDING.md`
- `docs/PRODUCT_GOALS.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/QA_VERIFICATION_CHECKLIST_2026-03-08.md`


## Active docs

- `docs/CURRENT_PRODUCT_STATE.md`
- `docs/CURRENT_EXECUTION_FOCUS.md`
- `docs/COMPETITIVE_ASSESSMENT.md`
- `docs/SETU_TRACK_PRODUCT_ARCHITECTURE.md`
- `docs/QA_VERIFICATION_CHECKLIST_2026-03-08.md`
