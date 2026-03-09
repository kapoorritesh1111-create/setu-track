# Page Layout Standard

Each primary page should follow this order:

1. Page header (title + subtitle)
2. Optional toolbar / period controls
3. KPI strip
4. Primary content surface
5. Secondary insights / supporting surface

## Shared wrapper
Use `src/components/layout/SetuPage.tsx` for pages that need consistent spacing and top-level rhythm.

## Shared states
Use:
- `LoadingState`
- `ErrorState`
- `EmptyState`
- `PageSkeleton`
- `TableSkeleton`

These should replace one-off inline loading and error copy over time.
