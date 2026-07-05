# Design: add-item-paused-postponed-statuses

## Context

`ItemWorkflowStatus` is a 3-state enum (`done`, `in_progress`, `blocked`) threaded through Prisma, shared Zod, the lead form's status control, card renderers, the slide grid (`buildOwnItemRow` marks only `done`), weekly-report mappers and PDF export. Slide rows now carry NO status words — done = check glyph, risk severity = row background/border. Deferred follow-up recorded in `redesign-lead-slide-by-product-grid` design.md §6.

## Goals / Non-Goals

**Goals:**

- Honest states for on-hold and pushed-out work, end to end (write → every read surface → export).
- Rollups treat both as not-done and non-escalating.

**Non-Goals:**

- Risk/decision statuses, auto carry-over transitions, slide-row editing.

## Decisions

- **Semantics.** `paused` = on hold, owner intends to resume within the period horizon; `postponed` = consciously pushed beyond this period. Both not-done, both non-escalating — an item that is stuck for a bad reason is a RISK, not a status (existing derivation convention holds).
- **Slide rendering.** No words: paused = pause glyph (‖ icon, same quiet treatment as the done check), postponed = the item text in muted foreground + a forward glyph. Both with sr-only labels. Exact glyphs settle at implementation against the live slide; the spec fixes only "non-textual + distinct + sr-only".
- **Blocked coercion stays.** The slide's existing blocked→unmarked coercion for items is untouched; the two new states never coerce.
- **Enum growth is a dev-DB reshape.** MVP phase: edit `prisma/schema.prisma` + `migrate reset`; seeds get one paused and one postponed exemplar in the small tier so the states are visible out of the box.
- **Every render site gets an explicit mapping** — the overlay/coercion lesson ([[overlay-must-coerce-before-derive]]): grep all `workflowStatus` switches; no default-case fallthrough hiding the new states.

## Risks / Trade-offs

- Enum consumers with exhaustive switches (`ts-pattern`/switch) will fail typecheck until every arm is added — that is the desired loud failure, not a risk to suppress.
- PDF/print: glyph-only distinction must survive grayscale — pause/forward glyph shapes differ structurally, not by hue.
- Analytics velocity counts may shift once leads start honestly marking paused work — expected, not a regression.
