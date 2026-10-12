# Design

## Context

See proposal.md for the three admitted existing-contract roots. The shared primitive enum already admits the same five progress states in Current and Next; both callers parse that enum before the redundant per-type refinement.

## Decisions

- Before: canonical enum parsing → repeated per-type status check → pause/next-step/parent refinements. After: canonical enum parsing → the same pause/next-step/parent refinements. Remove both callers atomically with the unused helper and arrays; keep no compatibility alias without a consumer.
- Correct the date issue wording only. The UTC predicate and coercion remain unchanged; the existing assembled-report parser fixture owns the 1999-message regression and retains the 2000 success control.
- Before: safeText message literal and independently copied web classifier literal. Shared checkpoint: one `INVISIBLE_TEXT_MESSAGE` literal used by safeText and reexported through the existing index. The assigned web leaf imports that token from the integrated checkpoint; web behavior is unchanged until then.
- No durable requirement changes are needed for a pure ownership cleanup and corrective message. `skip_specs: true` is the supported OpenSpec opt-out for this case; no requirement is invented to satisfy validation.

## Risks / Trade-offs

- Removing the helper without either caller breaks imports → deliver all four source changes in one patch.
- A weaker status or prose guard could silently admit invalid data → retain the canonical enum and every independent refinement; exercise existing public owner tests.
- New shared export could drift from the actual message → safeText references the token directly; the later production consumer has a named owner.
- The date assertion must fail for the wrong wording, not fixture rejection → use a valid assembled report with only periodStart set to 1999 and assert its exact field issue.

Period lifecycle atomicity, role middleware identity, destructive guards, read-only boundaries, and accepted schema inputs remain unchanged. No migration, rollout flag, or database operation is needed. Root integrates the checkpoint with normal hooks; final aggregate checks and review remain separate evidence.
