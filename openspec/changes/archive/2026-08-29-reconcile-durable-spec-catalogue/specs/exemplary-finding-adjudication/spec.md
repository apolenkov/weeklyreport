## REMOVED Requirements

### Requirement: Unadjudicated findings are not actionable

**Reason**: This requirement governs the closed adjudication of 57 historical flags, not a permanent WeeklyReport capability. The archived `2026-07-28-adjudicate-exemplary-findings` change preserves the concrete accepted and overturned verdicts.

**Migration**: Apply `exemplary-repo-floor` requirement `The six exemplary-campaign decisions are explicit and durable` to future quality work; retain the archived change as provenance for the original verdict set.

The campaign SHALL require a source-grounded adjudication before a per-file
flag may be implemented or counted as confirmed debt.

#### Scenario: A flag has a concrete source claim

- **WHEN** the current source proves or disproves the recorded claim
- **THEN** the roadmap stores `confirmed` or `overturned`
- **AND** stores concise evidence for that verdict

#### Scenario: A flag has no claim

- **WHEN** a roadmap record contains no finding
- **THEN** it is marked `overturned`
- **AND** no defect is inferred from its `needs_work` label

### Requirement: Confirmed fixes land in verifiable slices

**Reason**: This requirement describes how the completed adjudication campaign was delivered. Current repository guarantees already live in `code-quality-modernization` requirement `HOT ZONE Refactors MUST Be Guarded By A Characterization Test` and `lint-max-strictness-standard` requirement `Each firing follows the fix-first escalation ladder`.

**Migration**: Use those surviving requirements for new changes and retain the archived adjudication change as provenance for the historical accepted and overturned decisions.

The campaign SHALL separate local corrections from contract migrations and
cross-feature refactors.

#### Scenario: A local correction has no product-contract impact

- **WHEN** the fix is isolated to a test, helper, or deterministic seed result
- **THEN** it may land with targeted tests and typecheck

#### Scenario: A fix changes a shared or product contract

- **WHEN** the fix changes wire schemas, persisted semantics, or UI state flow
- **THEN** it is implemented in a separate slice with direct regression tests

### Requirement: Adjudication covers every current maintained file

**Reason**: This requirement is the coverage rule of one completed exhaustive campaign. Permanent coverage is already specified by `exemplary-repo-floor` requirements `Campaign completion requires universal product-floor coverage` and `Universal coverage is measured from current source`.

**Migration**: Use the current catalogue and exemplary-floor gates for future quality waves; keep the historical per-file ledger in the archived `2026-08-04-repair-exhaustive-audit-exemplary-quality` change.

The exemplary campaign MUST perform source-grounded semantic, structural, test,
documentation, and comment adjudication for every maintained file in the final
worktree, including files with no starting flag. The ledger surface is the concrete
consumer of this requirement and MUST record `file -> reviewer/checks -> verdict`
for each path.

#### Scenario: A file had no historical flag

- **WHEN** a maintained current file was absent from the historical campaign or had
  no recorded finding
- **THEN** it still receives a final-source review and explicit verdict
- **AND** absence from the older finding set is not evidence of quality

#### Scenario: A remediation changes an already reviewed file

- **WHEN** implementing any finding changes the reviewed content of another file
- **THEN** the affected file's adjudication returns to pending
- **AND** its final verdict is based on the changed source rather than the prior pass

### Requirement: Review evidence matches the claim's scope

**Reason**: This requirement records a review method for a historical campaign rather than product behaviour. The general evidence boundary survives in `sdlc-release-readiness` requirement `SDLC status MUST separate evidence classes`, with documentation quality governed by `exemplary-repo-floor`.

**Migration**: Use source-bound evidence from current domain specifications and gates, and keep the archived review material as provenance instead of maintaining a separate adjudication capability.

Every adjudication verdict MUST cite evidence capable of proving that verdict. A
repository-wide absence claim MUST use a repository-wide inventory or search over the
applicable final scope; a behavior claim MUST use direct source reasoning and an
exercising test where executable; a comment verdict MUST inspect the actual comment
and its claimed owner or durable rationale.

#### Scenario: A broad absence is inferred from a sample

- **WHEN** a reviewer cites a subset of files to claim that no instances remain in
  the repository
- **THEN** the adjudication is invalid
- **AND** the reviewer MUST gather evidence over the complete applicable inventory
