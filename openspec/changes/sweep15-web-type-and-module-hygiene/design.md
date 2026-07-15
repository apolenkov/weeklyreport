## Context

Three web files shadow shared `PeriodStatus`; `mapWeeklyReport` creates two mutable result arrays in one 90-line loop; the print template is 766 lines with an inline disable; and `section-slide-utils.ts` mixes five model jobs behind an ESLint exemption. `admin-presentation-type-ssot` and `sweep15-live-report-type-ssot` own adjacent mock/live type seams and are explicitly excluded; this change consumes their resulting types and handles only residual `PeriodStatus` ownership plus module structure.

## Goals / Non-Goals

**Goals:** restore canonical type ownership, make weekly-report projection functional and small, create cohesive print/slide modules, and remove both size exceptions without changing output.

**Non-Goals:** alter API schemas, report content, print readiness/error markers, slide pagination semantics, visual design, or feature-barrel reachability.

## Decisions

### 1. Import `PeriodStatus` from shared at all three declarations

`admin-mock-data.ts`, `admin-types.ts`, and `weekly-report-page-helpers.ts` use the shared type directly. Mock values continue to satisfy live contracts. No local alias remains unless it adds a genuinely narrower semantic subset.

### 2. Project one product once

Build immutable grouped lookup inputs once, then map each `portfolioOverview` row through a `projectProduct` helper returning `{ portfolio, product }`. Derive the two arrays with `map` over those paired projections (or one `map` plus pure projections), never `push` or accumulator mutation. Period/result assembly stays separate. Every new function is at most 50 lines.

This prevents the portfolio and accordion shapes from silently using different lookup/default logic.

### 3. Split print by render responsibility

- `print-report-template.tsx`: query/controller and outcome selection only.
- `print-portfolio-table.tsx`: portfolio overview markup.
- `print-lead-section.tsx`: lead/product content blocks.
- `print-executive-summary.tsx`: summary content.
- `print-report-styles.tsx` (or a CSS module): print/page styles.

Readiness attributes and loading/error/success branches remain owned by the controller. Extracted components receive typed data and contain no fetching.

### 4. Split slide utilities by data transformation

Create modules for section model composition, activity model projection, pagination, foreign-content merge, and product-scoped derivation. Shared leaf types/constants move to a small contracts module only where needed. Imports form a directed graph toward leaf helpers; no replacement god-barrel is introduced.

### 5. Tests prove parity at seams

Mapper tests compare complete outputs; print tests assert readiness markers and representative DOM; slide tests cover each extracted transform plus integrated model output. Only after source files meet the standard are inline/config exemptions removed.

Load-bearing period dual-state and role-coverage invariants are unaffected; no data or deployment migration exists.

## Risks / Trade-offs

- [Mechanical extraction changes order or defaults] → Snapshot/structural parity tests before and after each slice.
- [New imports create cycles] → Keep controllers dependent on leaf render/model modules and run the production build.
- [Styles drift across print/PDF] → Preserve selectors and print declarations byte-for-byte before cleanup.

## Migration Plan

Land or compose `sweep15-live-report-type-ssot` first where it touches weekly/print imports, then apply residual `PeriodStatus` ownership and mapper projection, print, and slides, removing each exemption only with its split. Rollback is per-slice code reversion.

## Open Questions

None.
