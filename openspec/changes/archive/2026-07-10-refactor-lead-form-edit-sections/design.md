## Context

`apps/web/src/features/report-sections/ui/lead-form.tsx` is 986 lines after
`refactor-lead-form-data-loading`. Every logic family is extracted (mappers,
draft orchestration, write actions, draft merges, loaded view model, data
loading); what remains is composition state, small render helpers, and a
~600-line JSX return. The largest cohesive subtree is the edit-mode section
stack: `LeadReviewFeedback`, the `LeadFormSyncBridge.Provider` wrapping the
Product Status, Project Activities, unified-vs-classic item, and Risks
accordions, and the Decisions accordion.

This slice was grilled by the same two-seat council as the data-loading slice:
both advisers independently named the edit-section stack as the next
extraction and converged on the boundary rules used here — the Codex seat
contributed the file split (`LeadFormEditSections` + nested
`LeadFormItemSections`) and the Provider-nesting rule; the deep-reasoning seat
contributed the grouped-prop contract (pass whole hook/builder results, no new
context, no flat scalar bag). Codex itself is unavailable for stop-time review
in this window (auth token requires interactive re-login).

Load-bearing invariants:

- Period dual-state, role-coverage gate: untouched (no write-path or API
  changes).
- `LeadFormSyncBridge` context: `.Pipeline` and `.Risks` MUST render inside
  the `.Provider` — the item sections stay children of the Provider block.
- Render-phase ref assignments (`writeActionSubmitContextRef`,
  `draftMergeContextRef`) stay in `LeadForm`, before the JSX return.
- Rendered markup stays byte-identical; the end-to-end suites are the pins.

## Goals / Non-Goals

**Goals:**

- Move the edit-mode section stack out of `LeadForm` into
  `LeadFormEditSections`, with the items conditional in a nested
  `LeadFormItemSections`; both files < 250 lines, no new lint exemptions.
- First real exercise of the grouped-prop contract: `viewModel` and `merges`
  passed wholesale.
- Update `architecture-refactor-backlog` with actual post-slice LOC evidence.

**Non-Goals:**

- No toolbar/header/document-actions/dialog extraction (next slices).
- No hook, view-model, data-loading, or styling changes.
- No backend, shared schema, Prisma, tRPC, route, or UI-string changes.
- No broad `ReportDataCoordinator` or `FormStateManager`.

## Decisions

### D1: One `LeadFormEditSections` owning the Provider block, items split out

The Provider plus its five accordions move as ONE component so the context
consumers stay inside it; the unified-vs-classic conditional (the two week
accordions or the unified accordion) becomes a nested `LeadFormItemSections`
rendered as a child inside the Provider — required to keep the outer file
under 250 lines without lifting context consumers out.

Alternative rejected: extracting per-accordion components — five files with
near-identical prop plumbing for no cohesion gain.

### D2: Grouped props, no context

`LeadFormEditSections` takes `viewModel` (the `LeadFormLoadedViewModel`
result) and `merges` (the `useLeadFormDraftMerges` return) as whole objects,
plus named residuals that are genuinely component-local: `draftSection`,
`reviewFeedback`, `groupExpanded`, `unifiedView`, `stagesForProduct`,
`recordVisibility`, `visibilityHydrated`, and `crossAuthorEntries`. The child
destructures. No `LeadFormContext` — the tree is two levels deep and a context
would hide the data flow the decomposition is trying to expose.

Alternative rejected: flattening into ~30 scalar props — the lawless prop bag
both council seats flagged.

### D3: Pure relocation, existing tests are the pins

The subtree moves verbatim (markup, classNames, testids, handlers). No new
tests: `lead-form.test.tsx`, `lead-form-visibility.test.tsx`,
`lead-form-addressable.test.tsx`, and the viewmode snapshot render `LeadForm`
end-to-end and assert by role/testid/text, so they pin the moved markup
without importing the new components. The data-loading slice verified none of
these import file-local symbols.

## Risks / Trade-offs

- Provider/context boundary break (items lifted OUT of the Provider) -> D1
  nesting rule; `lead-form-sync-bridge.test.tsx` and the Pipeline/Risks
  sections in `lead-form.test.tsx` fail loudly if violated.
- Silent prop-miswiring during the move -> mechanical relocation only, no
  logic edits in the same commit; full unit suite before commit; adversarial
  verifier diffs old vs new JSX.
- New files creep past 250 lines -> the items split (D1) is designed in from
  the start; if `LeadFormEditSections` still exceeds, move the Decisions
  accordion into `LeadFormItemSections`' sibling scope rather than adding an
  exemption.

## Migration Plan

1. Add `lead-form-edit-sections.tsx` (Provider block + Decisions accordion)
   and `lead-form-item-sections.tsx` (unified-vs-classic conditional).
2. Rewire `LeadForm`'s edit branch to render `<LeadFormEditSections …/>`;
   keep the slides branch, dialogs, header, and toolbar unchanged.
3. Update the backlog spec and delta with actual post-slice LOC evidence.
4. Run focused tests, scoped ESLint, `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, `pnpm format:check`, `git diff --check`, and OpenSpec
   validation.

Rollback is a normal git revert; no persisted data or API surface changes.

## Open Questions

- None blocking.
