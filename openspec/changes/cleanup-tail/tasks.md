## 1. Strip the archaeology prefix from `env.ts`

- [x] 1.1 `apps/api/src/lib/env.ts`: remove the
      `refactor-auth-exemplary-layering:` prefix from the docblock (line 4),
      keeping the rest of the rationale verbatim

## 2. Pin or drop `draftSaveSchema.status`

- [x] 2.1 Confirm the `saveDraft` write path
      (`apps/api/src/modules/report-sections/application/report-sections.service.ts:255`
      and its repository) never reads `status` off the parsed draft-save
      payload
- [x] 2.2 `packages/shared/src/schemas/section.schema.ts`: change
      `status: reportSectionStatusSchema.default("draft")` to
      `status: z.literal("draft").default("draft")` if the field must stay
      for wire-compat, or drop it entirely if no client sends it — pick
      based on 2.1's finding
- [x] 2.3 Update any client-side caller that currently sends
      `status: "submitted"` on a draft-save call (should be none; confirm)

## 3. Rewrite the risk-edit-dialog invariant comment

- [x] 3.1 `apps/web/src/features/review/ui/risk-edit-dialog.tsx`: rewrite the
      comment (~line 67) to describe the real constraint — the
      mount/unmount remount pattern gives `stagesForProduct` a fresh
      `useState` snapshot on every open, so its value is captured once at
      mount, not re-read reactively — instead of the false "never read in
      any deps array" claim contradicted by `useRiskEditDialog`'s own deps
      array

## 4. Fix `client-logger.ts`'s HMR log-stacking

- [x] 4.1 `apps/web/src/lib/client-logger.ts`: replace the module-level
      `installed` boolean with a guard stamped on `console` itself (e.g.
      `const INSTALLED_MARK = Symbol.for("customreport.client-logger.installed")`
      checked/set on `console`), so Fast Refresh's new module instance still
      sees the mark and skips re-wrapping
- [x] 4.2 Add a test simulating a second `installClientLogger()` call
      (mimicking HMR re-invocation) and asserting `console.error` is not
      wrapped twice (e.g. assert a single log entry is queued per call, not
      duplicated)

## 5. Resolve the dashboard archive dead path

- [x] 5.1 Confirm whether `dashboard-page.tsx`'s
      `archive: { items: [], nextCursor: null }` is intentionally
      hardcoded-empty (never fetches real archive data) with no UI consumer
      of `viewModel.archive`, or whether some surface DOES render it
- [x] 5.2 If truly dead: delete `mapArchiveSummary`, `ArchiveReport`, and the
      `archive` field/type plumbing from `dashboard.ts` and
      `dashboard-page.tsx`
- [x] 5.3 If it's a planned-but-unbuilt surface: wire it to the real
      `archive.list` query, OR mark it `ComingSoonBadge`-deferred per
      `deferred-feature-pattern` instead of leaving it silently inert —
      pick based on 5.1, don't default to building the full feature

## 6. Stabilize the agentation devtools CSS override selector

- [x] 6.1 `apps/web/src/styles/app.css`: replace the hashed-class selector
      (`.styles-module__toolbar___wNsdK.styles-module__toolbar___wNsdK`,
      line 203) with a stable `data-*` attribute selector; add the matching
      `data-*` attribute to the target element in its component if not
      already present
- [ ] 6.2 Confirm the override still applies visually after the swap (manual
      check or existing visual/e2e coverage if any targets this override)

## 7. Remove pulse.css dead var and resolve the orphan wrapper

- [x] 7.1 `apps/web/src/styles/pulse.css`: remove the unused
      `--pulse-line` custom property (line 20)
- [x] 7.2 Confirm whether `apps/web/src/features/landing/ui/pulse-mark.tsx`'s
      `.pulse-line` wrapper (line 17) renders any visible content without a
      matching CSS rule
- [x] 7.3 If the wrapper is inert: remove it from `pulse-mark.tsx`. If it's
      load-bearing for layout (e.g. spacing via default `span` display):
      keep the element but rename the class away from the dead `pulse-line`
      name, or add back a minimal rule — pick based on 7.2

## 8. Gates

- [x] 8.1 `pnpm --filter @customreport/api db:generate`
- [x] 8.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 8.3 Focused smoke for task 4: run web from source, trigger
      `console.error`, force a Fast Refresh via a source edit, trigger
      another `console.error`, confirm no duplicated log line
- [x] 8.4 `grep -nE '[а-яА-Я]' <changed .tsx files>` (expect no hits)
- [x] 8.5 `openspec validate cleanup-tail --strict`
