# Per-file audit — apps/web/src/components/ui (2026-07-02)

Read-only audit, wave 2 web.
2 files reviewed (confirmation-dialog.tsx, sdlc-tooltip.tsx).
6 findings kept, 0 killed by verification.

## confirmation-dialog.tsx (4 findings)

| Lines                                                                       | Dimension   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Suggestion                                                                                                                                                                                                                                                                              | Your verdict |
| --------------------------------------------------------------------------- | ----------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 123-200                                                                     | duplication | high     | `getDialogPreset()` and its `PresetConfig` type (~78 lines, ~40% of the file) have zero callers anywhere in apps/web/src — not in dashboard-page.tsx, revoke-lead-button.tsx, or even confirmation-dialog.test.tsx (grep for `getDialogPreset` matches only its own definition/JSDoc). Every real caller hardcodes title/description/confirmLabel inline instead.                                                                                                                                                                                                                                          | Delete `getDialogPreset` + `PresetConfig`, or wire the two real call sites (dashboard-page.tsx:293, revoke-lead-button.tsx:69) through it and delete the unused variant branches.                                                                                                       |              |
| 7-15,38-41                                                                  | simplicity  | medium   | `ConfirmationDialogVariant` declares 8 values (submit, publish, reopen, fill-from, version-restore, delete, revoke, default) but a repo-wide grep for `variant="..."` on `ConfirmationDialog` shows only `"revoke"` is ever passed by real code; 6 of 8 variants (and the whole `DESTRUCTIVE_VARIANTS` branch for "delete") are unreachable — vestiges of the same abandoned preset-catalogue plan.                                                                                                                                                                                                        | Shrink the variant union to what's actually used (`"revoke" \| "default"`, or a boolean `destructive` prop) once the dead preset code is removed.                                                                                                                                       |              |
| 1-201; sibling apps/web/src/components/lead/confirm-delete-dialog.tsx:1-174 | duplication | high     | `ConfirmDeleteDialog` is a second, independently-implemented confirmation modal covering the exact same job as `ConfirmationDialog`'s dead "delete" variant: character-identical fixed inset-0/z-[100]/bg-black/40 backdrop and rounded card/shadow-xl/animate-scale-in shell class strings, same destructive-red confirm button, same Cancel/Confirm footer layout — but hand-rolls its own keydown listener + requestAnimationFrame focus management (lines 71-101) instead of the shared `useDialogFocus` hook that `ConfirmationDialog` already uses (which also gives a Tab focus-trap, absent here). | Consolidate: extend `ConfirmationDialog` with the `preview`/`subtitle`/`consequence`/`reversible` slots it's missing (as `children`, already supported) and delete `ConfirmDeleteDialog`, or at minimum make it reuse `useDialogFocus` instead of reimplementing focus/Escape handling. |              |
| 43-52                                                                       | comments    | low      | File-level JSDoc on `ConfirmationDialog` runs ~7 content lines (bullet list of behaviors), over the 3-line comment budget; it narrates what the code + `useDialogFocus` already express rather than a single non-obvious WHY — and its opening action list (Submit, Publish, Reopen, Fill From, Version Restore) documents the dead preset catalogue, not real usage.                                                                                                                                                                                                                                      | Trim to one line noting only the non-obvious bit (focus/escape handling delegated to `useDialogFocus`) and drop the rest — it's derivable from reading the component.                                                                                                                   |              |

Already good: correctly reuses the shared `useDialogFocus` primitive for focus trap/Escape/restore instead of hand-rolling it — good idiom reuse.

## sdlc-tooltip.tsx (2 findings)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                                                                                                                   | Suggestion                                                                                                                                                                                                      | Your verdict |
| ----- | --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 3-17  | comments  | low      | 15-line file-header JSDoc (usage example + consumer-instructions) exceeds the 3-line comment budget. The one load-bearing WHY (portal to `document.body` escapes overflow:hidden clipping in collapsed accordions) is buried among narration/usage-example lines that just restate the exported API.                                      | Keep only the WHY (portal-to-body avoids overflow:hidden clipping) in 1-2 lines; drop the usage-example block — it duplicates what the exported `SdlcTooltipProvider`/`useSdlcTooltip` signatures already show. |              |
| 75,93 | constants | low      | Positioning magic numbers (`rect.top - 8` vertical offset at line 75, `maxWidth: 280` at line 93) are inline with no name explaining what they represent, contrary to the strict named-constant policy for magic numbers; neither is in the allowed inline set (0/1/-1/2/index/self-naming) and the adjacent comment names neither value. | Extract `TOOLTIP_OFFSET_PX = 8` and `TOOLTIP_MAX_WIDTH_PX = 280` (or fold into a documented constants block) so the values are self-explanatory at call sites.                                                  |              |

Already good: clean singleton-portal pattern — context + createPortal + SSR-safe `mounted` guard, small (103 lines), single concern, graceful no-op fallback for provider-less usage in tests/Storybook.

## Rollup

**By dimension:**

- duplication: 2 (both high)
- simplicity: 1 (medium)
- comments: 2 (low)
- constants: 1 (low)

**By severity:**

- high: 2
- medium: 1
- low: 3

**Top 3:**

1. `confirmation-dialog.tsx` — `ConfirmDeleteDialog` vs `ConfirmationDialog` is a full duplicate confirmation-modal implementation, missing the shared focus-trap hook (high, duplication).
2. `confirmation-dialog.tsx` — `getDialogPreset`/`PresetConfig` is ~40% dead code with zero callers (high, duplication).
3. `confirmation-dialog.tsx` — 6 of 8 `ConfirmationDialogVariant` values are unreachable, vestige of the same abandoned preset plan (medium, simplicity).

**Overlap with pending OpenSpec changes:** none of the 6 findings map to any item in the pending list (unified-activity-entry, fix-manual-publish-archive-race, head-surface-parity-declutter, responsive-compact-layout, project-activity-reporting, review-acknowledgement, input-and-error-hardening, code-health-and-test-cleanup, fix-dashboard-nan-pending, key-charts-by-id, fix-analytics-date-matching, harden-web-vitals-endpoint, fix-prod-web-build-args, fix-open-redirect-next-param, tighten-code-quality-ratchet, tighten-comment-policy, map-domain-errors, escape-org-data-script). All 6 are local style/duplication/dead-code cleanups fit for a standalone sweep, not a pending change.

## Killed by verification

None — all 6 reported findings held up under verification (0 killed).
