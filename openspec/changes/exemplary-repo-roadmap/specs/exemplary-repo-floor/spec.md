## ADDED Requirements

### Requirement: A file is "on the floor" only by a mechanical test

A file counts toward the `filesOnFloor` ratchet counter if and only if it
passes the full rule set (`pnpm typecheck && pnpm lint && pnpm test`), is
named in **no** `eslint.config.ts` `files:` override block, and carries
**no** bare or file-scope `eslint-disable` directive. This is exactly
`catalogue.json` classification `cls: "A"` for `kind: "product"`, produced by
`pnpm catalogue` (`scripts/exemplary-catalogue.ts`).

A single-line `eslint-disable-next-line` carrying a reason that explains why
compliance is architecturally impossible is tolerated in review, but it MUST
NOT be counted as "on the floor" — it still increments the live-suppressions
counter. Verdicts from `REPORT.md` (exemplary/minor/needs_work/redesign) are
a human review layer on top of this mechanical test, not a substitute for
it: a file can be walk-verdict `exemplary` and still be catalogue `cls: B`
or `C` (carrying a suppression or a relaxed lint budget), and the mechanical
test governs the ratchet.

#### Scenario: Classifying a file

- **WHEN** `pnpm catalogue` runs
- **THEN** a `kind: "product"` file with `cls: "A"` is on the floor
- **AND** `cls: "B"` (suppression), `"C"` (relaxed budget), `"E"` (no
  importer), or `"F"` (unlinted) is not on the floor regardless of its
  `REPORT.md` verdict

#### Scenario: A justified single-line disable is still debt

- **WHEN** a file carries `eslint-disable-next-line` with an
  architecturally-necessary reason
- **THEN** the file may be treated as floor-quality in human review
- **AND** it still counts against the live-suppressions ratchet counter and
  does not move the file to `cls: "A"`

### Requirement: Three ratchet counters move in one direction only

`filesOnFloor` (product files at `cls: "A"`) MUST NOT decrease between two
measurements without a stated justification in the same commit.
`overrideBlocks` (count of `files:` entries in `eslint.config.ts`) MUST NOT
increase without a stated justification. `liveSuppressions` (count of inline
`eslint-disable*` directives, from `catalogue.json`'s `suppressions` field
summed across all files) MUST NOT increase without a stated justification.

Baseline recorded 2026-07-28, measured live by regenerating `catalogue.json`
(the checked-in copy at proposal time predated three same-day classifier fix
commits and undercounted `filesOnFloor` by ~17 files):
`filesOnFloor` 827 of 924 product files (89.5%), `overrideBlocks` 27,
`liveSuppressions` 140 across 107 files.

#### Scenario: A change touches the lint surface

- **WHEN** a change adds, removes, or edits an `eslint.config.ts` `files:`
  block, or adds/removes an `eslint-disable` directive
- **THEN** `pnpm catalogue` is re-run and the resulting three counters are
  compared to the last recorded baseline in this spec
- **AND** a regression on any counter is either justified in the change's
  `proposal.md` or the change is rejected

#### Scenario: `catalogue.json` is stale

- **WHEN** `catalogue.json`'s mtime predates the latest commit to
  `scripts/exemplary-catalogue.ts`
- **THEN** any counter read from it MUST be treated as unverified, and
  `pnpm catalogue` MUST be re-run before the counter is cited in a proposal
  or a report

### Requirement: Duplicated domain logic has exactly one owner

When two modules independently implement the same domain decision (not
coincidentally similar code — the same business rule, expressed twice), one
module MUST own the decision and the other MUST import or delegate to it
rather than reimplement it. This is distinct from per-file test-fixture
duplication, which `lint-max-strictness-standard` and the sibling
`architecture-refactor-backlog` already govern.

Known instances recorded 2026-07-28, pending a fix change each:

- The default reporting-group fallback is implemented independently in
  `apps/api/src/modules/auth/user-session.ts`
  (`resolveNextReportingGroupId`) and
  `apps/api/src/modules/admin/admin-group.queries.ts`
  (`ensureFallbackReportingGroup`), with the id/name/description literals
  copied verbatim into the former.
- Period-lifecycle gating (`status` vs `periodStatus` under a reopen) is
  decided independently in three files:
  `apps/api/src/modules/telemetry/telemetry.gauges.ts`,
  `apps/api/src/modules/telemetry/telemetry.queries.ts`, and
  `apps/api/src/modules/telemetry/telemetry.prisma-repository.ts`.
  A one-sided fix desyncs the other two; see the open decision below.
- Domain-error mapping is spelled three ways with identical bodies
  (`withDomainErrorMapping` / `withMappedDomainError` /
  `withMappedDomainErrors`), plus 8 routers inlining the same try/catch.
- Failure classification disagrees on mechanism: `instanceof` in the
  lead-form family vs `error.name` string comparison in
  `apps/api/src/infrastructure/trpc/routers/weekly-report.router.ts`, which
  silently promotes a renamed or subclassed domain error to `error` level
  logging.

#### Scenario: A second implementation of an existing domain decision is proposed

- **WHEN** a change would add a second module that decides something a
  named single-owner module already decides
- **THEN** the change imports or delegates to the existing owner instead
- **AND** if a new decision is genuinely needed, the existing owner is
  extended, not duplicated

### Requirement: `apps/*` comments carry WHY, not restated names, and are `//`, not JSDoc

`apps/*` MUST carry rationale as a `//` comment, not a JSDoc block — this is
the existing `CLAUDE.md` JSDoc policy (public-API-only, `packages/shared`
and `packages/ui`); it is unenforced in `apps/*` because
`jsdoc/require-jsdoc` is `publicOnly` and armed only for `packages/*` (no
gate exists to catch violations mechanically). Until a gate exists, the
2026-07-28 per-file walk's three-way classification governs a hygiene sweep:
**delete outright** when the JSDoc restates the name it sits on (measured:
the largest single class in the walk, recurring in 10 of 18 first-pass
shards); **compress to `//` at or under 3 lines** when it carries a real
rationale that is simply over budget or in the wrong wrapper (example:
`apps/web/src/features/admin/model/admin.ts` carries a 29-line header);
**leave alone** when it is a contract-bearing one-liner that already reads
fine.

#### Scenario: A JSDoc block in `apps/*` is reviewed

- **WHEN** a hygiene sweep or a code review encounters a JSDoc block under
  `apps/*`
- **THEN** it is classified delete / compress / leave-alone by content, not
  by `/** */` syntax alone, per the criteria above

### Requirement: Documentation MUST NOT assert a control the code does not implement

A comment, JSDoc block, or README claim that describes a guarantee (a
privacy exclusion, a single-owner claim, a default value, a fallback
behavior) MUST be true of the code as written. A maintainer who reads the
claim and builds on it is the harm this requirement exists to prevent — the
2026-07-28 walk ranked this class as its most dangerous (Tier B), above
functional bugs, because a functional bug is discoverable by using the
feature and a false doc is not.

Known instances recorded 2026-07-28, pending a fix change each:

- `apps/api/src/infrastructure/trpc/routers/telemetry.router.ts`: the
  fallback comment and `trpc.router.ts:90` both claim an undefined
  dependency hides the procedure; the resolver instead returns a
  hand-written all-zero KPI payload.
- `apps/api/src/lib/audit-logger-types.ts`: `MutationInput`'s JSDoc promises
  an `ai.*` mutation exclusion the middleware does not implement (it only
  checks `auth.*`), and no `ai` router exists yet to have exercised the gap.
- `apps/api/src/infrastructure/bullmq/queue-registry.ts`: claims to be the
  "single owner of the raw Queue handles for this process"; `bullmq.module.ts`
  also registers a `Queue` instance per queue name.
- `apps/api/src/modules/auth/auth.routes.ts`: a comment claims `FRONTEND_URL`
  has a localhost default in dev; `env.schema` declares it with no default.
- `apps/web/README.md`: documents an "AppShell — SidebarProvider +
  role-based navigation + header" that does not exist; the only primitive
  matching that description
  (`packages/ui/src/components/ui/sidebar.tsx`) has zero consumers
  repo-wide.

#### Scenario: A doc claim is reviewed

- **WHEN** a comment, JSDoc block, or README section asserts that the code
  implements a specific guarantee
- **THEN** the reviewer verifies the claim against the code before accepting
  the change, not the reverse

### Requirement: A comment referencing a change slug or ticket MUST resolve or be removed, never assumed

Comments and test titles carrying a bare provenance reference (a change
slug, ticket id, or phase number, e.g. `38-02`, `E2E-06`, `ruling F16`) are
ambiguous by shape alone: some resolve to durable, MUST-level requirements in
`openspec/specs/` (`ruling F16` resolves to
`openspec/specs/web-polish-lows/spec.md` and
`openspec/specs/reliable-reminder-delivery/spec.md`, both live, both cited
across 9 files including production source) and deleting them destroys
greppability; others are dead (`e2e/sweep/playwright.config.ts` and
`e2e/catalog-sweep.spec.ts` both cite
`openspec/changes/behavioral-ui-regression-gate`, which no longer exists —
`openspec/changes/` holds only `archive/`).

A mechanical or LLM sweep MUST dereference each reference before acting on
it. A reference that resolves to a live `openspec/specs/` requirement is
kept, per the existing `CLAUDE.md` allowance for a `<=2`-line pointer. A
reference that resolves to nothing is deleted. A sweep that pattern-matches
the shape of a reference without dereferencing it MUST NOT delete or keep
references in bulk.

#### Scenario: A comment-hygiene sweep encounters a provenance reference

- **WHEN** the sweep finds a change-slug or ticket-shaped reference in a
  comment or test title
- **THEN** it resolves the reference against `openspec/specs/` (and, for
  changes, `openspec/changes/`) before deciding to keep or delete it
- **AND** an unresolvable reference is deleted; a reference resolving to a
  live `openspec/specs/` requirement is kept

### Requirement: Declined mechanical rules are not re-proposed without new evidence

The following were evaluated against this repo's actual code and declined.
A future proposal to adopt any of them MUST cite new measured evidence, not
generic best-practice framing, or it is rejected on sight.

- Four `dependency-cruiser` rules that measure zero real violations at
  shippable configuration in this repo (vacuous here, not universally).
- Four `eslint-plugin-functional` rules that fight NestJS dependency
  injection and React component idioms as actually used in this codebase.
- `no-let` as a standalone rule, recorded as a no-op by the operator; the
  measured basis for that call is not in this change's audit inputs. Note
  against re-proposing without checking first: `REPORT.md` §5.12 names live
  `let`/reassignment instances (`capturedSession`, `seenExclude`,
  `caughtError` ×2, `let found = false`) in test files, so "fires on
  nothing" should be re-verified, not assumed, before this entry is used to
  reject a future proposal.
- Padding/blank-line rules already fully owned by Prettier; a duplicate
  ESLint rule for the same concern only risks disagreeing with the
  formatter.

#### Scenario: A declined rule is re-proposed

- **WHEN** a change proposes adopting one of the rules listed above
- **THEN** the proposal MUST include a fresh measurement showing the rule
  now fires on real code in this repo, or it is rejected without
  implementation

### Requirement: Open decisions are recorded, not silently resolved by whoever touches the file next

Each open decision below MUST be recorded here and MUST NOT be resolved as a
side effect of an unrelated change — a ruling requires a human, because the
walk found the "obvious" fix on at least one side is wrong or contested for
every item on this list. Recording them here prevents a future contributor
from picking a side by accident while editing one of the named files.

- **`exactOptionalPropertyTypes`**: off today; enabling it surfaces 290
  `tsc` errors. Undecided: schedule a fix wave, or record why the exposure
  (undefined-vs-missing bugs, the shape of A3's stage-id fallback in
  `REPORT.md`) is accepted.
- **The telemetry lifecycle-column trio**: `telemetry.gauges.ts`,
  `telemetry.queries.ts`, and `telemetry.prisma-repository.ts` gate
  inconsistently on `status` vs `periodStatus` under a period reopen.
  Undecided: what the on-time-ratio metric means under a reopen — "of
  periods published" (legacy `status`) vs "of periods no longer editable"
  (`periodStatus`). Whichever is chosen, all three files change together;
  changing one desyncs the other two.
- **27 type-only import cycles**: invisible to `depcruise`'s default
  configuration (0 violations, verified live 2026-07-28); visible only with
  `--ts-pre-compilation-deps`, which turns up 27 `no-circular` violations —
  the same count as measured before this change, reconfirmed live
  2026-07-28. That same run surfaces a 28th, unrelated violation
  (`not-to-unresolvable`: `apps/web/src/lib/trpc.ts` →
  `@customreport/api/infrastructure/trpc/trpc.router`), which is not a
  cycle and is outside this decision's scope, but is worth a look — and the
  run's plain exit code was 28 (piped through no filter), while a naive
  `| tail` on the same command reports exit 0, so any script gating on this
  MUST capture the exit code same-shell. Undecided: whether type-only
  cycles are worth gating on in this codebase.
- **The split-for-budget harness-duplication convention**: 6
  file pairs/families duplicate a test harness after a `max-lines` split.
  One instance (`periods-tab.test.tsx` /
  `periods-tab.dialogs.test.tsx`) was confirmed a defect by the walk's
  verifier; a near-identical instance
  (`use-lead-form-autosave.test.tsx` /
  `use-lead-form-autosave.queueing.test.tsx`) was overturned as a
  deliberate, consistently-applied convention (split commit `f3a90ab5`).
  Undecided: ratify the convention repo-wide (then only the lying headers
  get fixed) or ban it (then all 6 pairs get one shared `.tsx` harness).

#### Scenario: A fix is proposed for one of these files

- **WHEN** a change would edit one of the files named in an open decision
  above
- **THEN** the change's `proposal.md` states which side of the open
  decision it takes and why, so the decision is made explicitly rather than
  inherited from whoever happened to touch the file first
