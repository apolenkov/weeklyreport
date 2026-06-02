# lint-max-strictness-standard Specification (delta)

This delta ADDs the **enforcement discipline** for the
`lint-max-strictness-standard` capability declared by `declare-lint-max-strictness`
(Phase 2). It governs _how_ the codebase is driven to the standard in Phase 3 —
the ordering, escalation, gating, and economy that keep the ramp attributable and
prevent both big-bang enablement and mass-disable shortcuts.

## ADDED Requirements

### Requirement: Strictness is achieved by ratchet, never by big-bang

The codebase MUST be brought to the standard by ramping one rule (or the single
autofix cluster) at a time, not by enabling the full strict set at once. The
autofixable cluster MUST land first as one isolated mechanical `eslint --fix`
commit with no logic change. After that, each remaining rule MUST go from `off`
to `error` with its own fixup wave and MUST land the gate green before the next
rule is ramped. Behavior-risky rules (`no-unsafe-*`, `no-unnecessary-condition`)
MUST be ramped last.

#### Scenario: a rule is ramped only after the previous one is green

- **WHEN** a maintainer ramps the next strict rule to `error`
- **THEN** the prior rule's cluster has already merged with a green
  `pnpm lint` + `typecheck` + `test`
- **AND** the autofix cluster was committed in isolation before any manual rule
- **AND** `no-unsafe-*` and `no-unnecessary-condition` are scheduled after the
  safer rules

### Requirement: Each firing follows the fix-first escalation ladder

When a ramped rule fires, the response MUST follow this order: (1) fix the code;
(2) only if the firing is a genuine false positive, add a per-site
`eslint-disable-next-line <rule> -- <reason>` with the reason; (3) only as a last
resort, raise the rule's threshold or add it to the documented exclude-list,
recorded in the standard's spec. Mass-disabling a rule, or blanket-raising a
threshold, to force the gate green is forbidden.

#### Scenario: a false positive is suppressed with a reason, not mass-disabled

- **WHEN** a ramped rule fires on a line that is a verified false positive
- **THEN** a single `eslint-disable-next-line` with a written reason is added at
  that site
- **AND** the rule remains `error` everywhere else
- **AND** no file-wide or project-wide disable is introduced to clear the cluster

#### Scenario: a rule's built-in framework-accommodation option is a config choice, not a weakening

- **WHEN** a ramped rule offers a built-in option that encodes a language or
  framework design reality (e.g. `no-extraneous-class` `allowWithDecorator` for
  NestJS decorator-DI, where an empty `@Module` class is correct by design;
  `restrict-template-expressions` `allowNumber` + `allowBoolean` for the
  dominant `${number}` / `${boolean}` interpolation case)
- **THEN** setting that option is a legitimate rule-scoping configuration that
  sits OUTSIDE the fix→disable→exclude ladder — it is neither a per-site
  suppression nor the rung-3 threshold-raise/exclude that the spec restricts
- **AND** the rule still fires on genuine offenders the option does not cover
  (e.g. non-decorated extraneous classes still error)
- **AND** the choice is documented inline in `eslint.config.ts` and recorded in
  the change's `tasks.md`, so it stays auditable

### Requirement: Ratchet work is gated and reviewed per cluster

Each cluster MUST pass `pnpm lint` + `pnpm typecheck` + `pnpm test` before merge.
A PR MAY bundle a few related rules (2–4), composing with one-rule-at-a-time
fixing. Behavior-risky clusters (`no-unsafe-*`, `no-unnecessary-condition`) MUST
receive an Opus-level review before merge.

#### Scenario: a risky cluster is gated and reviewed

- **WHEN** a `no-unsafe-*` cluster is prepared for merge
- **THEN** `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass for that
  cluster
- **AND** the cluster has an Opus-level review recorded
- **AND** the PR groups only related rules, not the whole strict set

### Requirement: Ratchet execution uses a cost-tiered model split and per-cluster budget

Phase-3 execution MUST tier models by task: Haiku for mechanical autofix, Sonnet
for judgment rules, Opus for review of behavior-risky clusters. Budget MUST be
managed **per cluster** — one rule plus a token target per run, no global ceiling
invented up front. The execution Workflow (per-file fan-out, worktree isolation,
per-cluster gate) MUST be authored at execution time, not while the plan is being
written.

#### Scenario: a mechanical cluster runs on the cheap tier

- **WHEN** the autofix cluster is executed
- **THEN** it is handled by the Haiku tier, not Opus
- **AND** a judgment rule cluster is handled by Sonnet
- **AND** a behavior-risky cluster's review is handled by Opus
- **AND** each run is scoped to one rule with its own token target, with no
  global Phase-3 token ceiling
