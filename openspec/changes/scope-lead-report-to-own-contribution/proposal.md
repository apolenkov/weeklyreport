# Proposal: scope-lead-report-to-own-contribution

## Why

The lead's own report page (`/lead/report/<id>`) must read as "my work". Today it
does NOT: on a co-owned product the page merges **other authors' full records**
into the lead's own surface. The `leadForm.crossAuthorSections` query is always
loaded, and `mapForeignItems` / `mapForeignRisks` / `mapForeignDecisions` copy
foreign item text, risk text + impact + mitigation, decision text, and the
author's full name into `mergedCurrentItems` / `mergedNextItems` / `mergedRisks` /
`mergedDecisions`, which render on the page. A second query
(`leadForm.crossAuthors`) additionally feeds foreign item/risk **counts** and
status into the Product Status card.

This is the W5/W6 "foreign kanban (read-only)" behaviour from
`fix-report-surface-integrity`. The lead asked to see only their own records.
This change removes foreign **records** from the lead page while keeping the
co-owned product's **health colour** honest — so a co-owner is not blind to a
red stage they do not own — shown as anonymized, status-only product context.

Decision locked via grill-with-docs-codex (variant 2): content is strictly own;
product health stays honest; foreign stages are dimmed, identity-only (initials +
status), derived from risks; severity inside one group is not secret.

## What Changes

- **Foreign records are removed from the lead page** — no other author's item,
  risk, or decision text renders. The lead page shows only the signed-in lead's
  own items / risks / decisions. This reverses the W5/W6 foreign-record merge on
  the lead surface (the read model is replaced by a status-only one).
- **Foreign counts are removed** — `crossAuthors` no longer returns / renders
  `itemCount` / `riskCount`.
- **Foreign full names are removed** — Product context shows initials only; no
  `assignee` full name reaches the lead surface or the `StageChip`.
- **Product health colour stays honest** — a co-owned product reflects all
  contributing leads' stages (already the `lead-pipeline-card` rule).
- **Foreign stage status derives from risks** — the canonical traffic-light rule
  (`status-risk-unification`), not the blocked-item path.
- **Slides mode obeys the same rule** — lead slides show no foreign records, keep
  honest product health.
- **Authorization is explicit** — Product context is returned only to a caller
  who owns a section in / has access to that report; an arbitrary `reportId`
  yields nothing.
- **No user-facing toggle** on the lead page; `by product` / `by lead` stays the
  head grouping axis (`CONTEXT.md`).

## Capabilities

- `lead-pipeline-card` (modified) — lead-page own-records rule, anonymized
  status-only product context, slides parity, authorization bound.

## Impact

### Shared / API contract (do first)

- `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts` —
  `getCrossAuthorSections` (full foreign content) is removed from the lead path
  or replaced by a status-only read; `getCrossAuthors` drops `itemCount` /
  `riskCount` and the `user.name` select (initials only); add a caller-access
  check on both.
- tRPC `leadForm.crossAuthorSections` procedure — removed or narrowed to a
  status-only shape; `leadForm.crossAuthors` output shape trimmed. Consumers:
  the lead form + slides only.
- Shared types: `CrossAuthorEntry`, `CrossAuthorSection`, `ForeignKanbanItem` /
  `ForeignRiskEntry` / `ForeignDecisionEntry` removed or reduced.

### Frontend

- `apps/web/src/components/lead/lead-form.tsx` — drop `crossAuthorSectionsQ`
  merge; `merged*` collapse to own arrays.
- `apps/web/src/lib/mappers/lead-cross-author.ts` — remove `mapForeign*`
  content mappers; keep only a status-only product-context projection.
- `apps/web/src/components/lead/sdlc-pipeline.tsx` — foreign stages dimmed,
  identity-only (initials + status), no counts; product health unchanged.
- `apps/web/src/components/lead/stage-chip.tsx` — `Locked` chip shows initials,
  not the owner's full name.
- `CONTEXT.md` — terms **Own contribution**, **Product context** (added during
  the grill).
