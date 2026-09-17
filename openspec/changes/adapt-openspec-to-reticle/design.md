## Context

The OpenSpec corpus evolves over time. The gate derives the exact scenario and normative-outcome denominators from the accepted source snapshot; prose counts are descriptive evidence for that snapshot, never fixed contract values. Scenario identity uses the specification path, requirement title, and scenario title together, so titles reused in different structured parents remain distinct. Existing saved Reticle flows for project `customreport-web-60381801` are present in the workspace, but no source-controlled contract maps them to OpenSpec.

The existing `behavioral-ui-regression-gate` keeps human and model browser review advisory. This change adds traceability and runtime evidence without creating a second product acceptance authority.

## Goals / Non-Goals

**Goals:**

- Make every current and future normative scenario visible to one exact coverage gate.
- Force explicit human classification while automating identity, fingerprint, and drift checks.
- Reuse the smallest set of flows that provides consequence-level evidence.
- Keep source-controlled declarations deterministic and runtime receipts ephemeral.

**Non-Goals:**

- Infer applicability from keywords or generate flows from specification prose.
- Copy normative scenario text or volatile Reticle output into the registry.
- Exercise production, shared data, credentials, or destructive operations.
- Change period dual-state, role middleware coverage, or database guard behavior.

## Decisions

### Use one structured registry and derive both denominators

`.reticle/spec-coverage.json` will use version 2 and one source entry for every normative outcome introduced by `THEN` or its following `AND` clauses. Each entry preserves the structured `spec`/`requirement`/`scenario` identity, exact outcome text and ordinal, and both the normalized parent and outcome fingerprints. `coverage` is either `{ kind: "unclassified" }` or `{ kind: "classified", proofs: [...] }`; a classified entry has a non-empty array of required proofs. The parser never splits one source outcome to obtain additional entries. This avoids touching source specifications individually, represents mixed scenarios without discarding obligations, and preserves readable review diffs.

The validator derives both the scenario denominator and the normative-outcome denominator directly from `openspec/specs/*/spec.md` on every run. Any reported count is bound to the checked source snapshot and is never a constant in code or a permanent denominator in prose.

Alternative rejected: metadata in every specification would spread Reticle-specific implementation detail through durable product contracts. Keyword classification was rejected because applicability is semantic.

### Classify each normative outcome by its required proofs

A classified entry contains a non-empty `proofs` array. Each proof is either `{ kind: "reticle", flow, assertion, consequence }` or `{ kind: "deterministic", surface, reference, detail }`. `reference` names the exact first-party source that establishes the outcome, and the validator rejects a proof without it, so a migrated or refreshed entry can never claim deterministic evidence by surface alone. Every proof is required, and its `consequence` or `detail` describes a separate sub-guarantee. Allowed deterministic surfaces describe inherent evidence such as `server-test`, `database-test`, `deployment-check`, `static-source-gate`, `performance-check`, `operations-check`, and `non-web-client-test`.

The registry has no `blocked`, wildcard, inherited, or default classification. A missing fixture or red product behavior keeps an applicable browser proof Reticle-required and incomplete. A mixed scenario retains one source entry per normative outcome; one entry may require both browser and deterministic proofs. Browser evidence cannot stand in for an internal proof, and deterministic evidence cannot replace an applicable browser proof.

### Address the assertion inside the saved flow

An assertion locator identifies either a step expectation or the flow success predicate. The validator resolves the locator in the saved flow and requires non-empty intent. The installed Reticle core 2.14 consequence validator qualifies only `signal`, `net`, and `state`; `console` and `text` may be supplemental but do not qualify alone, and a route may be asserted through real registered state. A bare action or element-presence-only predicate is rejected.

One outcome may require several proofs, and many outcomes may share a flow only when each Reticle proof points to an assertion sufficient for its sub-guarantee. Review, rather than string similarity, establishes semantic sufficiency.

The installed Reticle 2.14 `predicateToExpect` path drops `route`, `text`, and `element.state` details, so saved proof predicates qualify only `state`, `net`, and `signal`. The native capability matrix still has unresolved signal candidates; visible DOM is not an emitted signal. A live Viewer replay that loses its saved route assertion is rejected for mapping, even when its live network check passes. The Reticle getter location is readable but has no subscription, and a warning alone is not a product defect.

Before any proof-specific code is added, the runtime lane must complete one accepted native flow. Reuse existing native `state`/`net`/`signal` assertions first. If a saved assertion cannot express a required UI clause, the narrow fallback is first-party DEV-only store fields derived from the actual DOM for the exact fact needed, such as an active-element descriptor, period label and `aria-selected`, viewport/document sizes, or computed styles. These fields must not use fake pass flags or constants; do not add a third-party package, schema fork, test framework, or broad product fix.

### Separate the deterministic gate from live acceptance

The TypeScript validator performs only deterministic checks: exact source denominators, identities, fingerprints, version 2 proof arrays, classifications, proof details, flow paths, intent, and assertion locators. Version 2 has no legacy compatibility adapter. The one-time migration mechanically wraps an existing single Reticle or deterministic classification in a one-proof array without claiming semantic review; normal version 2 refresh accepts version 2 only, preserves unchanged proof arrays, and resets changed or new outcomes to explicitly unclassified.

Native Reticle tools provide live `verified: yes` and replay results. Mixed outcomes count once in the outcome denominator. Reticle-proof and deterministic-proof outcome counts may overlap, so acceptance also reports mixed-outcome count and total proof count alongside source identity, registry/flow hashes, distinct flows, and native results. Runtime timestamps, cookies, payloads, and `passed: true` receipts remain outside Git.

### Keep implementation small and first-party

### Narrow the mandatory proof core (owner decision 2026-09-17)

`pnpm spec:reticle` was red by construction: the v1-to-v2 migration wrapped legacy `{kind, surface, detail}` proofs into version 2 arrays without a `reference`, so 1,684 of 1,690 deterministic proofs failed the four-key contract, and no saved flow matched the 97 mapped flow names. Because the gate was chained into `spec:check`, CI reported failure for a reason unrelated to product behaviour.

The gate now separates identity integrity from proof obligation. `.reticle/spec-coverage-exclusions.json` is an owner-signed declaration naming excluded specifications and, when needed, individual outcomes by `spec`/`requirement`/`scenario`/`ordinal`; each entry carries a reason, and the declaration points at an existing decision file. Everything the declaration does not name stays mandatory, so new specifications and new outcomes fail closed instead of being skipped silently. The validator requires registry identity, scenario and outcome fingerprints, and exact outcome text for every outcome, and requires valid proofs only for mandatory outcomes. Excluded outcomes are counted separately and never contribute to proof counts.

`spec:reticle` is no longer part of `spec:check`; CI runs it as a separate non-blocking step so the remaining gap stays visible without blocking unrelated merges. The current mandatory core is six outcomes in `ci-merge-gate` and `role-coverage-gate`, with 3,114 outcomes excluded and zero Reticle proofs; the gate therefore proves registry-to-spec integrity, not browser coverage. Growing the core means adding real references or accepted flows and deleting the matching exclusion entry, and removing the step's `continue-on-error` once the declared core is wide enough to represent the product's critical surface.

The first-party implementation consists of the registry, one TypeScript validator, one focused validator test, the root script wiring, saved flows required by mappings, and this OpenSpec change. It uses Node standard-library parsing and hashing; no dependency or third-party Reticle customization is added.

## Data Flow

```text
openspec/specs/*/spec.md ──parse──┐
                                  ├── exact identity + fingerprint gate
.reticle/spec-coverage.json ──────┤
                                  ├── outcome evidence + flow assertion gate
.reticle/flows/<project>/*.json ──┘

distinct mapped flows ──native Reticle run/replay──> ephemeral acceptance report
```

No product request, Prisma write, or shared schema changes are introduced. Period dual-state, the canonical role-procedure chains, and the destructive database guard are preserved unchanged.

## Risks / Trade-offs

- [The outcome registry is review-heavy] → derive outcomes mechanically, then require explicit proof sets; never infer their evidence surface.
- [A renamed or edited contract retains stale coverage] → fingerprint both the full parent requirement and scenario blocks.
- [One broad flow overclaims coverage] → require per-outcome assertion locators and independent semantic review.
- [A deterministic label hides missing evidence] → require a concrete existing gate or test surface; keep unavailable browser outcomes applicable and incomplete.
- [Dirty sources invalidate live receipts] → bind acceptance to both commit identity and hashes of task-relevant uncommitted files.
- [Reticle flow schema changes] → validate only the committed native fields used by current flows and fail closed on unknown assertion shapes.

## Migration Plan

1. Add the version 2 validator and failure-focused proof-array tests.
2. Run the one-time v1-to-v2 migration, mechanically wrapping prior single classifications into one-proof arrays without claiming semantic review; keep changed and new outcomes unclassified.
3. Refresh only the version 2 registry, preserving unchanged proof arrays and resetting changed outcomes, then classify every outcome in reviewed domain batches while retaining all required sub-guarantees and any mixed browser/internal proof set.
4. Reconcile existing flows, strengthening any presence-only assertion before mapping it; qualify only core `signal`/`net`/`state` consequences and use console/text only as supplemental evidence.
5. Record the minimum missing flows in one owned browser/runtime lane, restoring authorized synthetic fixtures after write scenarios.
6. Run static gates, then every distinct mapped flow and replay on the accepted sources.

Rollback removes the new registry, validator, script wiring, and task-owned flows; no product or persisted-data migration is involved.
