## 1. Web implementation

- [ ] 1.1 Add `use-lead-form-chrome.ts`: the `selectedPeriodId` +
      `titleHistoryEntry` derivations, the document-title effect (set +
      restore-on-unmount), and the archive show-state with its auto-expand
      effect — bodies and dependency arrays verbatim.
- [ ] 1.2 Add `lead-form-toolbar-controls.tsx`: the `ReportToolbar`
      contextControls fragment (period navigator, archive filter, agent-review
      placeholder, record-visibility toggle, view-mode toggle, mode-adaptive
      collapse-all/fullscreen slot) with the collapse-all derivations absorbed
      — markup verbatim.
- [ ] 1.3 Rewire `lead-form.tsx` to use both; slim imports and single-use
      destructures; hook order, refs, guard, and branch structure unchanged.
- [ ] 1.4 Remove the `lead-form.tsx` `max-lines` exemption from
      `eslint.config.ts`; probe the cyclomatic and cognitive entries by
      removal + scoped lint and remove those that pass; keep all new files
      under the 250-line standard with no new exemptions.

## 2. Planning and verification

- [ ] 2.1 Update `openspec/specs/architecture-refactor-backlog/spec.md` and the
      matching change delta with final post-slice `lead-form.tsx` LOC evidence;
      record the size target as closed if ≤ 250 lines is reached.
- [ ] 2.2 Run focused tests:
      `cd apps/web && pnpm exec vitest run src/features/report-sections/ui/lead-form.test.tsx src/features/report-sections/ui/lead-form-visibility.test.tsx src/features/report-sections/ui/lead-form-addressable.test.tsx src/features/report-sections/ui/lead-form-viewmode.snapshot.test.tsx`.
- [ ] 2.3 Run scoped lint on changed web files with `--max-warnings 0`.
- [ ] 2.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`,
      and `git diff --check`, then validate this change with `--strict` and
      run the full strict OpenSpec validation.
