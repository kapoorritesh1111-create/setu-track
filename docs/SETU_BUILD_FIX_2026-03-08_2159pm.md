Build fix for analytics money formatter signature.

- Updated src/app/analytics/page.tsx so money() accepts an optional currency argument.
- Fixes the TypeScript error on the budget-aware project labor mix row during Vercel build.
