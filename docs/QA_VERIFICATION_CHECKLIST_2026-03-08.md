# SETU TRACK — QA Verification Checklist (2026-03-08)

## Setup
1. Copy `.env.example` to `.env.local` and fill all Supabase values.
2. Install dependencies with `npm install`.
3. Run `npm run lint`, `npm run typecheck`, and `npm run build`.
4. Start local dev with `npm run dev`.

## Critical flow checks
### Login and auth
- Login page shows the transparent SETU TRACK logo with no grey box in light mode.
- Switch OS/browser theme to dark mode and confirm the logo remains crisp and legible.
- Reset password sends the user to `/auth/callback` and then `/reset`.
- Invite links generated from admin routes resolve to `NEXT_PUBLIC_APP_URL/auth/callback`.

### Dashboard
- `/dashboard` loads for admin without console/runtime errors.
- Current month, previous month, approvals, and budget cards render even when APIs return empty data.
- Global error boundary renders a recovery screen if a route throws.
- `/loading` fallback appears during slow route transitions.

### Approvals
- `/approvals` shows loading, empty, and populated states.
- Search, week navigation, and all-pending toggle work.
- Locked periods block approve/reject actions with a clear message.

### Navigation and routes
- Sidebar navigation works on desktop.
- Mobile drawer opens and closes correctly.
- `/dashboard`, `/approvals`, `/projects`, `/profiles`, `/reports/payroll`, `/reports/payroll-runs`, `/admin/org-settings`, `/admin/exports`, `/admin/billing` all render.
- Unknown routes render the custom 404 page.

### Brand assets and installability
- `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png`, and `maskable-icon-512x512.png` all load from `/public`.
- `site.webmanifest` uses root-relative icon paths.

## Vercel settings
- Build command: `npm run build`
- Output directory: `.next`
- Install command: `npm install`
- Node version: `20.x` recommended
- Required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_APP_URL`

## Known validation note
This repair pass was completed by static source audit and targeted patching. A full dependency-backed `npm install && npm run build` still needs to be executed in a network-enabled environment before production release.
