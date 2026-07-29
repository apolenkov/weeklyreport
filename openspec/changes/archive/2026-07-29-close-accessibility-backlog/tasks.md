## 1. Measurement and blocking proof

- [x] 1.1 Preserve the 47-anomaly four-role baseline and group repeated entries by root cause.
- [x] 1.2 Add a Playwright planted low-contrast probe that proves the installed axe scanner detects `color-contrast`.
- [x] 1.3 Make each role sweep write its report and then fail on any anomaly.

## 2. Shared UI and web repairs

- [x] 2.1 Repair the shared muted-text contrast token and any remaining direct component color failures.
- [x] 2.2 Repair skipped heading levels while preserving visual typography.
- [x] 2.3 Add focused component tests for changed semantic headings and shared color contracts.

## 3. Policy-debt verification

- [x] 3.1 Re-run the suppression ledger and prove zero unresolved or unproved retained directives.
- [x] 3.2 Re-run ESLint-scope probes and prove zero duplicate or unjustified relaxation blocks.

## 4. Acceptance

- [x] 4.1 Pass `pnpm test:uat` with zero anomalies in all four role reports and the planted detector proof.
- [x] 4.2 Pass `pnpm test:e2e:integration`, `pnpm test:e2e:prodbuild`, and `pnpm test:e2e:csp`.
- [x] 4.3 Pass `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm catalog:check`, `node apps/web/uat-suite/mutation-audit.mjs --check`, and `pnpm exec openspec validate --all --strict`.

## 5. Durable closeout

- [x] 5.1 Update `roadmap.json`, `REPORT.md`, the downloaded HTML artifact, and `HANDOFF.md` with exact before/after evidence and restart commands.
- [x] 5.2 Archive `close-accessibility-backlog`, re-run strict OpenSpec validation, and verify no active changes remain.
- [x] 5.3 Commit the clean green tree locally. Do not push while the owner's zero-run GitHub Actions requirement is in force, because a push to `main` dispatches CI.
