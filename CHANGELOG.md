# Changelog

## 2026-03-07 — Brand lockup + login refinement

### Added
- `src/config/brand.ts` for centralized brand constants
- `src/components/brand/BrandLockup.tsx` shared brand lockup component
- `public/brand/logo.svg` canonical SVG logo
- `public/brand/logo-mark.svg` symbol-only SVG mark
- `public/brand/logo@2x.png` PNG fallback asset

### Changed
- login page now uses the shared SVG lockup and tagline
- login page now includes footer attribution: `A product of SETU Groups LLC.`
- auth fields now use explicit labels, improved focus states, and associated status messaging
- sidebar and mobile drawer branding now use the shared brand lockup instead of mixed legacy assets

### Notes
- Assumption used for this pass: the tagline is shown with the main brand lockup on login and shell branding surfaces, while footer attribution remains login-only.

## 2026-03-07 — Official user logo asset correction

### Changed
- replaced the temporary generated logo with the official user-provided SETU TRACK PNG
- regenerated `public/brand/logo.svg` from the provided PNG so the shared brand lockup uses the correct logo everywhere
- updated `public/brand/logo@2x.png` to match the official provided logo

### Notes
- this pass only corrects the main logo asset and keeps the existing login/sidebar layout intact

## 2026-03-07 — Mobile UX + timesheet productivity
- Cleaned the shared logo SVG wrappers for sharper mobile rendering and updated shell/header brand image loading.
- Improved mobile shell, drawer, dashboard header, and timesheet header layouts.
- Timesheet now defaults to the current week and auto-jumps to today's date.
- Added quick actions to copy yesterday's entries to today and copy last week into the current week when the current week is empty.
- New entry form now defaults its date field to today.
