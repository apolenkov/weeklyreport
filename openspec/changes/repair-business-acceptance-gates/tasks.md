## 1. Diagnose

- [x] 1.1 Run the full integration suite without fail-fast.
- [x] 1.2 Preserve failure screenshots, traces, and exact exit status.
- [x] 1.3 Classify each failure as product, accessibility, fixture, isolation, or infrastructure.

## 2. Repair acceptance contracts

- [x] 2.1 Replace stale absolute seed counts with manifest-backed or relative assertions.
- [x] 2.2 Align submit confirmation browser coverage with its `alertdialog` accessibility contract.
- [x] 2.3 Add or strengthen targeted coverage for dashboard scope, settings, slides, and review where the matrix had no direct journey.

## 3. Execute locally

- [x] 3.1 Pass `pnpm test:e2e:integration` (final matrix rerun after adding the direct review journey).
- [x] 3.2 Pass `pnpm test:e2e:prodbuild` (50 passed, 1 intentional skip).
- [x] 3.3 Pass `pnpm test:e2e:csp` (4 role profiles passed).
- [x] 3.4 Pass `pnpm test:uat` (4 role sweeps passed; 47 non-blocking axe findings retained as accessibility debt).
- [x] 3.5 Pass the targeted business-journey matrix, including a persisted browser review verdict.
- [x] 3.6 Pass OpenSpec strict validation and deterministic repository gates.

## 4. Execute server-side

- [x] 4.1 Inventory and remove the existing GitHub Actions run history.
- [ ] 4.2 Dispatch fresh CI and dependency-scan workflows.
- [ ] 4.3 Confirm that fresh jobs receive runners and complete, or record the exact external allocation blocker.

## 5. Record and hand off

- [x] 5.1 Update the campaign HTML report with commands, counts, failures, fixes, and remaining blockers.
- [x] 5.2 Update the durable handoff without duplicating mutable source data.
- [ ] 5.3 Archive this change only after every non-external task is complete.
