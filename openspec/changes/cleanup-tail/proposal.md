## Why

BL-28 (P3, `docs/reviews/repo-excellence-review-2026-07-14.md`, "P2/P3 —
сжато"): cosmetic and dead-code cleanup across `apps/api`/`apps/web` — no
runtime/behavior impact except the HMR log-stacking item, which is dev-only
but genuinely behavioral (duplicated log lines during Fast Refresh). One
change, one slice per finding; the HMR item gets its own task with an
explicit smoke step per the P3 verification bar ("full gate + focused smoke
for runtime items").

## What Changes

1. **`env.ts` archaeology comment prefix.** Line 4's docblock opens with
   `refactor-auth-exemplary-layering:` — a banned change-name prefix per this
   repo's comment-hygiene rule, missed by the archaeology gate because the
   gate matches uppercase-only ticket-style prefixes
   (`Phase 35-08`, `UFB-036`, ...) and this one is lowercase-kebab. Strip the
   prefix, keep the rationale.
2. **`draftSaveSchema.status` is dead/misleading.** It accepts
   `reportSectionStatusSchema` (i.e. `"draft" | "submitted"`), but the
   `saveDraft` write path hardcodes `"draft"` and never reads the field back
   — a caller could send `status: "submitted"` on a draft save and it would
   be silently ignored. Pin to `z.literal("draft")` or drop it, whichever the
   read-side actually needs.
3. **`risk-edit-dialog.tsx`'s "structural invariant" comment is false.** The
   comment claims `stagesForProduct` is "never read in any deps array", but
   `useRiskEditDialog`'s hook reads `stagesForProduct` inside its own deps
   array (contradicting the comment at its own use site). Rewrite the
   comment to describe the REAL constraint: the mount/unmount remount
   pattern makes a fresh `useState` snapshot on every open, so
   `stagesForProduct`'s value at mount time is what matters, not
   deps-array-triggered re-reads.
4. **`client-logger.ts` stacks console wrappers on HMR.** The module-level
   `installed` guard resets on Fast Refresh (a new module instance), but the
   already-patched `console.error`/`console.warn` persist across the
   refresh — so `installClientLogger()` re-wraps an already-wrapped
   `console.error`, and every subsequent dev log line duplicates once per
   Fast Refresh cycle. Guard on a symbol stamped onto `console` itself
   (survives module re-instantiation) instead of a module-level boolean.
5. **Dashboard archive composition path is dead code.** `mapArchiveSummary`
   / `ArchiveReport` / the `archive` field
   (`apps/web/src/features/dashboard/ui/dashboard-page.tsx:242`,
   `archive: { items: [], nextCursor: null }`) is unreachable — no UI
   surface renders it. Delete or wire it; per `deferred-feature-pattern`, a
   genuinely-planned-but-not-yet-built surface needs a `ComingSoonBadge`, not
   silent dead plumbing.
6. **`app.css` keys an agentation devtools override on a hashed CSS-module
   class** (`.styles-module__toolbar___wNsdK.styles-module__toolbar___wNsdK`)
   — this class name is a build artifact that changes on every CSS-module
   rebuild, silently breaking the override with no compile-time signal.
   Switch to a stable `data-*` attribute / `data-testid`-style selector.
7. **`pulse.css` has a dead `--pulse-line` var and an orphan `.pulse-line`
   wrapper.** `--pulse-line` (line 20) has no consumer in the file; the
   `.pulse-line` class is referenced by `pulse-mark.tsx:17` but has no CSS
   rule anywhere. The file's own header comment already documents the pulse
   motif was removed 2026-06-23 — this is leftover scaffolding from that
   removal. Remove the dead var; either remove the orphan `.pulse-line`
   wrapper from `pulse-mark.tsx` (if it renders nothing meaningful without a
   rule) or add back a minimal rule if the wrapper is load-bearing for
   layout — confirm which during implementation.

## Claim disposition

| #   | Claim                                                           | Verdict                                                                                                                                                                                                                                                               | Action                                  |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | `env.ts` archaeology prefix missed by gate                      | CONFIRMED — read `apps/api/src/lib/env.ts:4`, literal `refactor-auth-exemplary-layering:` prefix present                                                                                                                                                              | Strip prefix                            |
| 2   | `draftSaveSchema.status` dead/misleading                        | CONFIRMED per review summary; verify the `saveDraft` write path's hardcoded `"draft"` during implementation (not independently re-read in this pass — same file already read for section.schema.ts line 228)                                                          | Pin literal or drop                     |
| 3   | risk-edit-dialog invariant comment contradicted by its own hook | CONFIRMED — read `risk-edit-dialog.tsx`; comment says "never read in any deps array" (line ~67) while `useRiskEditDialog({ ..., stagesForProduct })` (line ~102) passes it into the hook, which is exactly the kind of read the comment disclaims                     | Rewrite comment                         |
| 4   | `client-logger.ts` stacks wrappers on HMR                       | CONFIRMED — read `apps/web/src/lib/client-logger.ts`; `installed` is a module-level `let`, `console.error`/`console.warn` reassignment has no prior-wrap check                                                                                                        | Guard via a `console`-stamped symbol    |
| 5   | Dashboard archive composition dead code                         | CONFIRMED (partially) — `dashboard-page.tsx:242` has `archive: { items: [], nextCursor: null }`; `mapArchiveSummary`/`ArchiveReport` reachability not independently traced past this literal in this pass — confirm no consumer during implementation before deleting | Delete or wire; verify first            |
| 6   | app.css fragile hashed-class selector                           | CONFIRMED — read `apps/web/src/styles/app.css:203`, exact hashed class present                                                                                                                                                                                        | Switch to stable selector               |
| 7   | pulse.css dead var + orphan wrapper                             | CONFIRMED — read `pulse.css` (no `--pulse-line` consumer) and `pulse-mark.tsx:17` (`.pulse-line` has no matching CSS rule in the file)                                                                                                                                | Remove dead var; resolve orphan wrapper |

## Non-goals

- Not touching the archaeology gate's regex itself (`scripts/find-archaeology.mjs`)
  to catch lowercase-kebab prefixes generally — this change removes the one
  instance the review found; broadening the gate's pattern is a separate,
  larger change (risk of new false positives across the whole tree) not
  authorized here.
- Not redesigning `client-logger.ts`'s batching/flush logic — only the
  install-guard mechanism changes.
- Not building the dashboard archive feature — if it turns out to be a
  genuinely deferred feature rather than truly dead, the correct fix per
  `deferred-feature-pattern` is a `ComingSoonBadge`, not silent completion;
  confirm which during implementation and note the decision in the PR, don't
  default to building it out.
- Not touching `.pulse-tagline`'s JS-toggled fade or any other still-live
  rule in `pulse.css` — only the dead var and the orphan wrapper.

## File manifest

- `apps/api/src/lib/env.ts` (line 4 docblock)
- `packages/shared/src/schemas/section.schema.ts` (`draftSaveSchema.status`,
  line 228)
- `apps/api/src/modules/report-sections/*.ts` (`saveDraft` write path —
  confirm exact file during implementation; not independently traced in
  this pass)
- `apps/web/src/features/review/ui/risk-edit-dialog.tsx` (invariant comment,
  ~line 67)
- `apps/web/src/lib/client-logger.ts` (`installed` guard)
- `apps/web/src/features/dashboard/ui/dashboard-page.tsx` (`archive` field,
  line 242, and its `mapArchiveSummary`/`ArchiveReport` chain)
- `apps/web/src/styles/app.css` (line 203 selector)
- `apps/web/src/styles/pulse.css` (`--pulse-line`, line 20)
- `apps/web/src/features/landing/ui/pulse-mark.tsx` (`.pulse-line` wrapper,
  line 17)

## Verification

P3 bar: full gate + focused smoke for runtime items (item 4 is the only
behavioral one).

- `pnpm --filter @customreport/api db:generate`
- `pnpm typecheck && pnpm lint && pnpm test`
- Focused smoke for item 4: run `pnpm dev` (web from source), trigger a
  console.error, edit-save a web file to force Fast Refresh, trigger another
  console.error, confirm the log line appears once per trigger (not doubled)
  after the refresh — per `live-verify-source-web-cross-port-cookie`, verify
  from source, not the stale docker image
- `grep -nE '[а-яА-Я]' <changed .tsx files>` per this repo's UI-strings-stay-English
  convention, if any UI copy is touched incidentally (not expected here)
- `openspec validate cleanup-tail --strict`

## Sequencing

Independent of the other five changes — no shared files. Purely cosmetic
except item 4 (dev-only HMR behavior); safe to land in any order.
