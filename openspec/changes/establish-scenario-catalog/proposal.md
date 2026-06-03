# Establish the Behavioral Scenario Catalog (AI-testing foundation)

> **STATUS: DEFERRED (2026-06-03).** A full catalog (596 scenarios, API + live-DOM
> UX) was built via Workflow this session, then **removed** — binding scenarios to
> `file:line` is premature on an unstable MVP-phase codebase (config.yaml grants
> "schema and interfaces can change freely"); the code-links and coverage marks
> would rot on the first refactor. What was kept:
>
> - The reusable Workflow scripts under `workflow/` (generic + repo-specific +
>   UX), so the catalog can be **regenerated in one run** once the code settles.
> - The real findings the run surfaced, extracted into focused changes:
>   `fix-period-dual-state-writer-count`, `fix-ui-role-access-inconsistencies`,
>   `cleanup-dead-enum-states`, `fix-admin-role-model-drift`.
>   Re-run the Workflow (and only then wire SC-6/SC-7 drift gate) when the code
>   stabilizes. The Playwright e2e suite was removed on `chore/wipe-e2e-tests` for
>   agent-driven regeneration; this catalog is the eventual source for that.

## Why

The last weeks of work were a mechanical lint-strictness campaign (~50 commits,
ratcheting rules `warn`→`error`). Static gates (`typecheck`/`lint`/`test`/`build`)
passed throughout, yet a runtime regression still shipped — autofix turned
DI-injected classes into `import type` and broke NestJS boot; only a live boot
caught it. The gates are provably blind to a whole class of behavior change.

To answer "did the campaign break anything, and how do I never miss repo logic
again" we need a behavioral source of truth that the gates do not provide. The
existing OpenSpec specs are NOT it: of 152 `#### Scenario:` blocks, ~110 are
tooling/invariant/dependency scenarios; only ~40 touch product behavior, while
the real surface is 128 tRPC procedures plus REST controllers, BullMQ
processors, and cron schedulers across 19 modules and 26 entities. Whole modules
(auth, analytics, search, reminders, telegram, email) have near-zero behavioral
coverage.

**Live proof that an un-gated catalog rots:** the `period-dual-state` spec lists
`carry-over` among the six Report period writers, but the carry-over save
transaction writes execution+records+section with no visible `Report.periodState`
write. Either the code is wrong or the spec drifted — surfaced by simply
cross-checking spec against code. Without a drift gate, the entire catalog
diverges the same way within weeks.

This change establishes the catalog as a durable, drift-gated contract: the
interface between human intent and AI test execution. It is built once
(code-derived), kept honest by CI, and consumed by both an API and a UI test
tier — the foundation for ongoing AI-driven testing of the whole project.

## What Changes

- ADD a new capability `scenario-catalog`: a behavioral scenario catalog derived
  by triangulating four independent sources (full code entry-point surface,
  Prisma domain model, existing specs, codegraph), stored as Given/When/Then
  `.feature` documents under `e2e/catalog/` (one per module).
- Every scenario carries a machine-checkable `Then`, a link to the entry point
  it exercises, and its covering test (or an explicit uncovered mark).
- A CI **drift gate** re-derives the code surface and fails when code exposes
  surface the catalog does not cover.
- Two execution tiers from one source — API (all entry points) and UI (the
  interactive subset) — with a fixed human/AI division: intent and ambiguous
  judgement stay human/Sonnet; mechanical execution goes to Haiku.
- A pilot already exists at `e2e/catalog/carry-over.feature` as the reference
  format (it surfaced three real gaps tests miss: untested negative authz, an
  apparently-dead `CarryOverStatus.failed`, and the period-dual-state mismatch).

## Impact

- New: `e2e/catalog/` directory, the `scenario-catalog` spec, a drift-check
  command, Workflow scripts that build the catalog (deferred — not run by this
  change's authoring step).
- Consumes existing changes rather than re-specifying them: the diff-scoped
  verification run executes `final-gates-resweep` (gates + per-role Playwright
  console sweep), `verify-a11y-recommended-flip` (per-role a11y runtime checks),
  and `defer-uat-codequality-vercel-2026-05-26` Wave 1 (UAT sweep) as ONE
  consolidated per-role pass driven by the diff-scoped catalog; on green, those
  three are archived.
- Out of scope (stays backlog): `ratchet-lint-to-strict` R3/R4 tail
  (sonarjs/unicorn/JSDoc/import-boundaries) and `defer-uat` Waves 3–4 — net-new
  work, not verification.
- No new test framework: automation grows the existing `@playwright/test` +
  Vitest suites; no BDD runner.
