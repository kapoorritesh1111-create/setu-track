# SETU TRACK — Current Baseline

SETU TRACK is a contractor operations and payroll workspace built with Next.js, Supabase, and a branded SaaS UI shell.

## Run locally

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run build
npm run start
```

## Core stack

- Next.js App Router
- TypeScript
- Supabase Auth + Postgres
- Custom token-based UI system in `src/app/globals.css`, `src/styles/tokens.css`, and `src/styles/components.css`

## Branding system

Canonical brand constants live in:

The current canonical `logo.svg` was rebuilt from the user-provided official PNG asset so the app now uses the correct SETU TRACK logo everywhere without changing the existing layout.

- `src/config/brand.ts`

Canonical logo assets live in:

- `public/brand/logo.svg`
- `public/brand/logo-mark.svg`
- `public/brand/logo@2x.png`

Primary reusable brand lockup component:

- `src/components/brand/BrandLockup.tsx`

### How to update the logo

1. Replace `public/brand/logo.svg` with the new full lockup.
2. Replace `public/brand/logo-mark.svg` with the new symbol-only mark.
3. Optionally replace `public/brand/logo@2x.png` for legacy PNG fallback.
4. Update `src/config/brand.ts` if the name, tagline, description, or parent-company attribution changes.

### How tagline usage works

The tagline is centralized in `src/config/brand.ts` and rendered through `BrandLockup` so the login page and sidebar stay consistent.

Current tagline:

```txt
CONNECT . TRACK . GROW
```

## Main areas reviewed in this pass

- Login page
- Sidebar branding and mobile drawer branding
- Shared brand asset usage and canonical paths
- Auth form accessibility and focus states
- Footer attribution on login
- README + changelog updates

## 2026-03-07 brand, login, and shell cleanup release

Included in this pass:

- replaced broken/inconsistent main logo usage with a canonical SVG brand system
- added `BrandLockup` and centralized brand constants in `src/config/brand.ts`
- refreshed the login page with a responsive logo lockup, visible tagline, improved labels, better focus states, and footer attribution
- replaced sidebar wordmark usage with the shared SVG lockup and removed duplicate brand naming drift
- added symbol-only SVG asset for compact contexts and PNG fallback for legacy support
- updated documentation for asset locations and future brand updates

## Environment and auth notes

For production auth to work correctly, keep Supabase URL configuration aligned with the live domain:

- Site URL: `https://setutrack.com`
- Redirect URL: `https://setutrack.com/auth/callback`

## Recommended validation after unzip

1. `npm install`
2. `npm run build`
3. verify `/login` on desktop + mobile
4. verify sidebar lockup on authenticated routes
5. verify the mobile drawer brand lockup
6. verify dark theme brand contrast

## Latest update: mobile UX and timesheet quick-fill

- Mobile brand assets now use cleaned SVG wrappers with PNG fallbacks for sharper logo rendering in the header, drawer, and shared lockups.
- The weekly timesheet automatically opens on the current week and scrolls to today's date.
- Quick-fill actions are available on the weekly timesheet to copy yesterday into today and to copy last week into the current week when that week is still empty.
- Copied lines remain fully editable until saved or submitted.
