# Handoff — demo-feedback cluster (2026-06-16)

Repo: `/home/user/work/customreport`. Branch: `main`. Run `git log --oneline -8`
for exact SHAs — do not trust pinned hashes. Memory auto-loads
`demo-feedback-plan-2026-06-16` and `openspec-validate-first-line-must`.

## Bottom line

Three OpenSpec changes are **planned, Codex-APPROVED, `validate --strict` clean,
committed, NOT pushed**. Next session: implement them in order
**seed → card → toolbar**, then run the gate, then ask before pushing.

`openspec list` →

- `demo-seed-datasets`
- `report-card-clarity`
- `toolbar-polish`

Each has proposal / specs / design / tasks. Read each change's `tasks.md` and
`design.md` first — they carry the concrete steps and the verified root causes.

## How they were produced

Live-demo annotation feedback (head/lead pages) → `grill-with-docs-codex`. Act 1
interview locked the decisions (and updated `CONTEXT.md` glossary). Act 2 = a
self-adversarial pass + Codex review, converged APPROVED over 3 rounds. No code
was written — this is the plan only.

## Implement order + what each change does

1. **demo-seed-datasets** (do first — needed to demo and to verify the card).
   Tiered `pnpm db:seed:small|middle|huge`, `small` default. `seed.ts` (test
   fixture) UNTOUCHED. Reuse canonical IDs (`HEAD_USER_ID`, lead IDs,
   `ACTIVE_REPORT_ID`, group, stages) or dev-login + `/head/report/<id>` break.
   Small = 2 single-stage products + 1 two-stage (Dev+Test). Seed ONE blocked
   item so the derived "Needs Attention" banner has content. `seed-simple.ts`
   folds into the `middle` tier.

2. **report-card-clarity**. Stage chip → identity only (one uniform treatment);
   item workflow status moves to the row stripe/marker. Needs-Attention dedup
   (it is DERIVED from a blocked item, so the banner structurally repeats it —
   suppress on duplicate, or condense to a summary). "By lead" scope = slice each
   product to that lead's own items/stages; "by product" stays the full
   aggregate. Add-item/add-risk stage options scoped to the selected product
   (source: the lead's `StageStatus` coverage on that product, else full SDLC).
   Scannability pass via the frontend-design skill. NOTE: this edits status-color
   application, so per `status-color-semantics` cite this grill sign-off and
   attach before/after product-card screenshots before archive.

3. **toolbar-polish**. Toggles back to GREEN (`ScopeToggle` ≡ `ViewModeToggle`,
   identical green family). Export PDF → shared 32px `ToolbarIconButton`; it lives
   in the report-toolbar PILL trailing group; keep tooltip/aria-label = "Export
   PDF" (icon-button primitive), move the unpublished precondition to
   `aria-describedby`/sr-only. PRESERVE the `ExportPdfButton` async contract
   (request → poll → busy → download → toast) — only presentation changes. Even
   spacing in the lead toolbar icon-button row. Bug "selecting a toggle opens an
   item dialog" — REPRODUCE LIVE first (head toggles are `setScope` + `<Link>`,
   no dialog is wired, so the cause is a downstream effect); if it cannot be
   reproduced, keep the guard test and record the finding.

## Gotchas (verified this session)

- **Escalations are DERIVED** by `buildEscalationsFromReadSections` (one per
  blocked item) — NOT a seedable row. The banner = the blocked item's text by
  construction; dedup is a card concern.
- **The stage chip carries two meanings today**: text = stage+initials, fill =
  workflow status (`ITEM_STATUS_BADGE`). That is the "dark vs light" confusion.
- **`6a362c2c` (unpushed) is PARTLY reverted by toolbar-polish**: KEEP its
  leading-edge agent-placeholder reposition + the `head-report-shell` position
  test; revert only the toggle colors (neutral → green). Do not drop the whole
  commit.
- **openspec validate checks the FIRST body line of a requirement for SHALL/MUST**
  — hoist the normative clause to line 1 or validation fails spuriously.
- **Codex works here** — earlier "hangs" were a too-short watchdog. Use a ≥540s
  timeout and don't `2>/dev/null` the stderr. A real proxy hang is 0% CPU for
  minutes with no `thread.started`.

## Unpushed commits on `main` (4)

- `c8e019a8` — spec-hygiene (10 durable specs repaired, `validate --specs` 51/51).
- `6a362c2c` — neutral toggles (partly reverted by toolbar-polish, see above).
- `df736aa5` — the three-change plan + `CONTEXT.md` glossary.
- `eb9302fc` — review findings incorporated.

Pushing was deferred to the user. There is also a leftover pre-existing W6
published-PDF live check from the prior cluster (see
`frsi-implemented-2026-06-16` memory) — unrelated to this work.

## How to start next session

1. `openspec list` and read each change's `tasks.md` + `design.md`.
2. Implement `demo-seed-datasets` (start with the small tier). `pnpm db:seed:small`
   should reset cleanly and load `/head/report/<ACTIVE_REPORT_ID>`.
3. Gate every change: `npx prisma generate && pnpm typecheck && pnpm lint &&
pnpm test && pnpm build`.
4. For the card change, verify against the small dataset and capture the
   before/after screenshots the `status-color-semantics` gate requires.
5. Archive each change via `opsx:archive` when its tasks are done and verified.

## Suggested skills

- `openspec-apply-change` / `opsx:apply` — work the tasks.
- `frontend-design` — the card scannability pass.
- `run` / `verify` — drive the app for the seed + card + toggle-bug repro.
- `codex:review` — cross-model re-check before archive (≥540s timeout).
- `ai-ui-driver` — behavioral re-walk of head/lead after the card change.
