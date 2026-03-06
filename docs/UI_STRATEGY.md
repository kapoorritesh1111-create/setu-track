# UI Strategy (v2.0)

## Goals
Deliver a calm, premium SaaS UI inspired by Deel:
- clean hierarchy
- financial trust
- consistent card surfaces
- minimal cognitive load

## Layout rules
- Center content with max width (e.g., `max-w-7xl`)
- Use a neutral app background; elevate content via cards
- Avoid dense, border-heavy layouts

## Components & patterns
### Cards
- All primary data should sit inside cards:
  - `rounded-2xl`
  - subtle shadow
  - light border

### Page hierarchy (standard)
Use a consistent vertical rhythm:
1. **PageHeader** (title, subtitle, top-right primary action)
2. **CommandBar** (filters/search + secondary actions)
3. **SummaryBar** (KPIs / money-forward totals)
4. **TrustBlock** (audit context)
5. **CommandCard(s)** (tables + footers)

### Command surfaces
- **Primary action** lives in the header (one per page).
- **Secondary actions** live in ActionMenu (Exports / Copy / Bulk).

### Tables
- Prefer **clean tables** with row-actions hidden until hover (desktop).
- Table density is driven by **Settings → Appearance → density**.

### Views
- “Saved Views” is a first-class UI element on list pages.
- In Phase 1.9 it’s localStorage; later it becomes per-user persistence.
  - generous padding

### Tables
- Tables should live **inside cards** and include:
  - clear header row
  - right-aligned numeric columns
  - totals row when relevant
  - no “raw dev table” look

### Financial formatting
- Currency always formatted consistently (2 decimals)
- Hours displayed with consistent decimals (e.g., 2)
- Totals visually emphasized (size + weight)

### Status badges
Use consistent badge language + visual weight:
- Approved
- Pending
- Rejected
- Locked
- Closed / Reopened

### Safety UX (critical)
- When a period is locked: disable edits + show a clear banner/pill.
- Unlock/reopen actions must:
  - be admin-only
  - require confirmation
  - show warnings if a payroll run exists (force unlock pattern)

## “Done” quality bar
A screen is shippable only if:
- It reads clearly in 5 seconds
- Totals are unambiguous
- Date range is explicit
- Locked/safety states are obvious
- It would look credible in an investor deck
