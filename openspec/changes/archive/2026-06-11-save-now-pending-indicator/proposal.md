# Save-Now Button: Visible Pending Indicator While the Save Mutation Runs

## Why

User feedback on the lead report toolbar: while the manual "Save draft
now" mutation is running, the icon-only save button must visibly show
work in progress — spinner instead of the disc, accent green fill with
a white icon, `aria-busy`, and no repeat clicks — reverting when the
mutation settles (success or error).

Current state of
`apps/web/src/components/report-shell/save-now-button.tsx`: the spinner
swap and the disabled guard already exist (`isInFlight` →
`SpinnerIcon`, `disabled`, aria-label "Saving draft"). What is missing
is the _visual_ pending treatment and the a11y signal:

- no `aria-busy` attribute in any state;
- the button keeps its idle styling (transparent background, default
  border, foreground-colored icon) while the mutation runs — at 32×32
  the spinning stroke alone is easy to miss.

The button learns about save state end-to-end already: tRPC
`saveDraft` mutation → `use-lead-form-autosave.ts` (`isInFlight =
saveDraftMut.isPending`, line 256) → `AutosaveSnapshot` prop →
`SaveNowButton`. No wiring changes are needed; this is a
presentation + a11y change in one component.

## What Changes

In `save-now-button.tsx` only:

1. Add `aria-busy={isSaving}` to the button element.
2. While `isInFlight`, restyle the button with the repo's primary-CTA
   fill convention: `bg-[var(--color-starbucks-accent)]` +
   `text-white` (same pair as the login CTA,
   `login-page.client.tsx:307`, and `confirmation-dialog.tsx:127`).
   The spinner already strokes `currentColor`, so it turns white for
   free. Revert to the existing idle classes when `isInFlight` drops —
   on success or error alike (the existing check/alert branches stay
   untouched).
3. Neutralize the `disabled:opacity-40` washout for the pending state
   so the green fill reads at full strength while clicks stay blocked.
4. Extend `save-now-button.test.tsx`: pending render asserts spinner +
   `aria-busy="true"` + accent-fill class + `disabled`; settled states
   assert `aria-busy="false"` and no accent class.

## Non-goals

- No changes to `use-lead-form-autosave.ts` or the tRPC save path —
  the state already flows end-to-end.
- No changes to the saved-check / error-alert visuals or the 1500 ms
  revert timer.
- No new tokens, no theme work — only the existing
  `--color-starbucks-accent` token is referenced.
- The four config-linked invariants (role-coverage, period dual-state,
  deferred-feature, destructive-guard) are untouched; the durable
  contract this adds lives in `lead-report-controls-integrity`.

## Impact

- `apps/web/src/components/report-shell/save-now-button.tsx`
  (presentation + `aria-busy`).
- `apps/web/src/components/report-shell/save-now-button.test.tsx`
  (new assertions; existing tests must pass unchanged).
- `openspec/specs/lead-report-controls-integrity/spec.md` — this
  change carries an ADDED requirement ("In-flight control actions
  show a visible busy state"); synced into the durable spec at
  archive time.
