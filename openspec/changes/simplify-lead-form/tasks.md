# Tasks

## 1. Verdict model and write paths

- [ ] 1.1 Add a pure mapper from verdict (`done`, `continue`, `next`, `paused`, `wont_do`) and the item's lineage state to either an item-save patch (linked occurrence exists) or a prior-plan outcome input (none exists); verified by unit tests covering both paths, the one-active-next-per-`stableId` rule and stages/tag/priority preservation (`status-overview-items.ts` neighbours).
- [ ] 1.2 Add `Confirm all as continue` as one section save clearing `carriedOver` on all pending continuations, leaving already decided items unchanged; verified by a unit test (N pending, mixed decided) and an API integration test on a guarded disposable database showing one save and no duplicate occurrences.
- [ ] 1.3 Derive the pending-review count from unconfirmed carried items (paused and postponed excluded) and feed it to the existing submit readiness; verified by `lead-submit-readiness-summary` tests showing `n to review` text and unchanged blocker identity (`UNCONFIRMED_CARRIED_ITEM`).

## 2. Item rest state and reveal-on-demand actions

- [ ] 2.1 Replace the permanent action row and the metadata line in `status-overview-item-preview.tsx` / `status-overview-item-actions.tsx` / `status-overview-item-metadata.tsx` with a status icon, text and stage badge, plus a status menu on the icon; verified by updated `status-overview-item-preview.test.tsx` (rest state shows no text button, accessible names `Status of …` and `Edit item: …`).
- [ ] 2.2 Reveal the overflow control and quick week-move on hover, `focus-within` and tap without removing them from the accessibility tree; verified by component tests for keyboard Tab order and a touch-tap test, then agent-browser at 1280 and 375 (no hover required at 375, targets ≥ 44 px, no horizontal overflow).
- [ ] 2.3 Move SDLC stages, tag and pause detail into the canonical editor only; verified by a test that no stage text renders at rest and that the editor still saves them.

## 3. Previously planned verdict controls

- [ ] 3.1 Render verdict icons (`Done`, `Continue`, `Next week`, `Paused` + reason, overflow `Won't do`) on Previously planned items that are decidable, with the colour-plus-shape state vocabulary from `status-presentation-model` / `web-status-color-tokens`; verified by component tests and a colour-independence check (shape differs per verdict).
- [ ] 3.2 Show the verdict as an icon stamp on the frozen prior item and keep the prior occurrence untouched; verified by an API test that the prior-week row and its snapshot are unchanged after each verdict.
- [ ] 3.3 Add the `n to review` indicator to the existing sticky Save/Submit cluster and keep the end-of-form explanation in flow; verified by `lead-completion-guidance` tests and a 375 screenshot with no overlap.

## 4. Collapsed blocks and weekly fields

- [ ] 4.1 Collapse `open-work-register.tsx` into one disclosure line with a count, no render when empty; verified by updated register tests and a browser check that expanded content and replan still work.
- [ ] 4.2 Render the report health pulse as one summary line that expands to the existing inspection; verified by `lead-report-health-pulse` tests (counts with denominators, all-healthy line) and a browser screenshot at 1280 and 375.
- [ ] 4.3 Open Activity weekly title/description only from an edit control, show set values read-only in the Activity header; verified by tests for open, save, cancel focus return and reset to catalogue name.

## 5. Spec sync, tests and acceptance

- [ ] 5.1 Update e2e (`e2e/lead-form/overview.test.ts`, `completion.test.ts`, navigation and lifecycle suites) and the remaining unit tests to the new controls, adding the carried-item fixture path; verified by the lead-form e2e lane green on a guarded reset plus explicit seed.
- [ ] 5.2 Browser acceptance with agent-browser on the demo profile as Lead at 1280 and 375: verdict in one action per item, `Confirm all as continue`, no text buttons at rest, interactive elements on the first screen ≤ 35, page height ≤ 60% of 4097 px at 1280, whole screenshots without visible defects, keyboard-only pass; evidence saved beside the audit.
- [ ] 5.3 Run `pnpm lint`, web and API tests and the local acceptance checks from `docs/exemplary-code-standard.md#verification`; update `openspec/specs` through `openspec archive`, then remove `openspec/changes/archive/` as the cleanliness gate requires.
