# Tasks

- [x] 1. Add read-compatibility regressions for every affected read model (publication snapshots first) and for the merge, weekly (published and live), carry-over and PDF render consumers, plus a per-field and stage-name check that author writes still reject the value; confirm they fail on the `reject-invisible-only-safe-text` source.
- [x] 2. Give read models a stored-text field kind for the listed fields and stage names while write schemas keep `safeText` and the stage-name write rule.
- [ ] 3. Reconcile the `reject-invisible-only-safe-text` current-read stage-name scenario and assertion with this contract, run the applicable gates, obtain an independent review, and deliver after `reject-invisible-only-safe-text`.
