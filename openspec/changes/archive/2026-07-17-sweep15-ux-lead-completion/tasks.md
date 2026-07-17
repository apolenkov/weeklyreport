## 1. Shared readiness model

- [x] 1.1 Add characterization tests for existing submit coupling blocks, unset product/activity/stage auto-promotion, absent draft payload, autosave state, and mutation pending behavior.
- [x] 1.2 Implement pure `deriveLeadSubmitReadiness` with affected identities/counts, `willAutoPromote`, blocking issues, and `canOpenConfirmation`.
- [x] 1.3 Route `useLeadFormWriteActions.handleSubmit` through the readiness projection while preserving server-authoritative validation, confirmation, and mutation payloads.

## 2. End-of-form completion surface

- [x] 2.1 Build a focused readiness-summary component with Ready/Needs attention, `Will be set to On Track`, and `Blocks submission` groups using English copy.
- [x] 2.2 Render the summary after `LeadFormEditSections` with a final Submit action sharing the existing handler/pending state.
- [x] 2.3 Add component tests for ready, auto-promotion-only, coupling-blocked, missing-draft, and live-update states.

## 3. Sticky compact actions

- [x] 3.1 Extract a shared Save/Add/Submit action presentation contract from `LeadFormHeaderActions` without duplicating mutations or state.
- [x] 3.2 Add a header-action sentinel and `IntersectionObserver` hook with deterministic tests for enter/leave and unavailable-observer behavior.
- [x] 3.3 Render the compact sticky cluster only in editable non-slides mode when header actions are out of view; make the alternate presentation hidden/non-focusable while the header is visible.
- [x] 3.4 Add safe-area/bottom clearance, at least 40px targets, visible focus, non-color save/error status, and narrow-width wrapping.
- [x] 3.5 Add keyboard/RTL tests proving only one accessible Save/Add/Submit set is active and every presentation invokes the same handlers once.

## 4. Focused verification

- [x] 4.1 Run focused lead-form readiness, write-action, header, sticky-cluster, and accessibility tests.
- [x] 4.2 Drive a long lead report from source at desktop and mobile widths; verify header handoff, no covered content, Add routing, save state, blocker copy, and Submit confirmation.
- [x] 4.3 Check changed `.tsx` files with `grep -nE '[а-яА-Я]' <file>` and confirm every hit is permitted data/comment/test content.

## 5. Repository gates

- [x] 5.1 `pnpm --filter @customreport/api db:generate`
- [x] 5.2 `pnpm typecheck`
- [x] 5.3 `pnpm lint`
- [x] 5.4 `pnpm test`

## 6. Adversarial review closure

- [x] 6.1 Split the submit-readiness summary into focused groups while preserving readiness, auto-promotion, and blocking copy.
