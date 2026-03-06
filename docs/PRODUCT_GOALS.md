**Baseline:** Phase 2.9 feature set (2.7 receipts + 2.8 export center + 2.9 client deliverables), branded for **SETU GROUPS / SETU TRACK**.  
**Last update:** 2026-03-05.

# PRODUCT_GOALS (Contractor-First Payroll Command Platform)

## Product vision
Build a **Contractor‑First Payroll Command Platform** focused on:
- **Financial clarity** (totals first, money-forward UI)
- **Workflow transparency** (states + next actions)
- **Audit trust** (who/when/what changed; reproducible exports)

## What we are NOT building
- A full HR suite
- EOR / global compliance automation
- Tax engine
- Benefits / IT provisioning

## What we ARE building
The cleanest **payroll control layer** for growing contractor teams:
- clear periods
- approvals + locking
- reproducible exports
- payroll runs ledger + detail

## North-star UX principles (Deel-inspired)
1. **Executive summary first** (SummaryBar / metrics before tables)
2. **Calm hierarchy** (PageHeader → CommandBar → CommandCards)
3. **One primary action per page** (top-right)
4. **Consistent language + components** (StatusChip, ActionMenu, EmptyState)
5. **Trust layer visible** (locked/export metadata)

## Current progress (UI/UX modernization)
Completed and deployed through **Phase 1.9**:
- StatusChip + MetricsRow
- PageHeader + SummaryBar standard
- TrustBlock + CommandCard framing + MetaFooter
- ActionMenu (unified exports / secondary actions)
- Theme-aware background + appearance settings (theme/accent/density/radius)
- DataTable enterprise styling + density tokens
- Button hierarchy standardization
- Primary action in header (Phase 1.7)
- CommandBar standard (Phase 1.8)
- Saved Views scaffolding + row-action hover behavior (Phase 1.9)

Deployed through **Phase 2.6**:
- Official exports are now **audit-receipted** (`export_events`)
- Payroll report + Payroll run detail include **Recent exports / Export receipts** panels
- Payroll report + Payroll run detail include **Diff vs previous locked period** (variance model)
- Payroll report + Payroll run detail include **Changes since last official export** (export-to-export variance)
- Stage timeline surfaced: Preview → Approved → Locked → Exported → Paid
- Admin can mark/unmark Paid on payroll runs

## What’s next (Phase 2)
### Phase 2.0 — Payroll Run Detail becomes the “Command Center”
- Run detail summary surface (totals + deltas + counts)
- Audit trail (locked/exported/approved timeline)
- “Re-export official” vs “preview export” clarity

### Phase 2.1 — Manager Impact Dashboard
- pending approvals + payroll impact
- team-level rollups

### Phase 2.2 — Saved Views productized
- persist views per-user (in `profiles.ui_prefs`)
- default view + sorting

### Phase 2.7 — Deel-level export & payment polish
   - receipt drill-down drawer (click receipt → scope/filters/actor/run link)
   - “No changes since last export” badge + export guardrails
   - paid confirmation modal + paid note + “Paid on/by” display

### Phase 2.8 — Client-grade PDF design system
   - branded PDF header (org/project/period)
   - page numbers + totals blocks
   - consistent table layout and disclaimers

### 🧭 Positioning

Deel-level UX clarity
Without enterprise bloat.

### 🏗 Core Product Pillars
## 1️⃣ Financial Authority

Every payroll surface must:

Show totals first

Emphasize money visually

Display pay period clearly

Make payroll state obvious

No table-first views.

## 2️⃣ Workflow Transparency

All payroll must visibly move through:

Draft → Submitted → Approved → Locked → Paid

States must use consistent Status Chips across the app.

## 3️⃣ Manager Visibility

Managers must see:

Pending approvals

Payroll impact

Team summary

Not just contractor lists.

## 4️⃣ Trust Layer

Every payroll period must eventually show:

Locked by

Approved by

Exported by

Timestamps

Activity log

Authority comes from visible process.

## 5️⃣ UX Principles

Executive metrics before tables

Calm visual hierarchy

Card-based structure

Consistent state language

Minimal button noise

Clear next action

## 🚫 Anti-Goals (Important)

**Do not build:**

Multi-country tax engine

Benefits management

Device provisioning

Global compliance automation

Feature sprawl

Stability + clarity > complexity.

## **📈 Success Criteria**

The product feels:

Financially serious

Operationally controlled

Workflow-driven

Audit-ready

Calm and enterprise-ready
