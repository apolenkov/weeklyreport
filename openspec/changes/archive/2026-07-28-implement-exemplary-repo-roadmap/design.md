# Design

## Source precedence

The campaign uses both supplied sources:

1. the PDF supplies order, measured backlog, and the six work areas;
2. `exemplary-repo-roadmap` supplies mechanical invariants, declined rules, and
   open decisions;
3. current source and command output decide whether an item is already done.

The PDF's first three printed pages are blank because of an artifact print
failure. Their sections 01-04 are recoverable from the source HTML of the same
artifact and agree with the OpenSpec floor requirements.

## Ratchet

The repository stores a reviewed baseline for the three counters. A check
compares the current tree with that baseline and compares any edited baseline
with its first-parent predecessor. Therefore a contributor cannot make a
regression pass merely by weakening the baseline in the same commit.

The check is part of `pnpm lint`. Improvements update the baseline in the same
commit as the code that produced them.

## Landing order

Work lands in independently verifiable slices:

1. mechanical ratchet;
2. local and already-decided rules/findings;
3. cross-module ownership and shared-contract changes;
4. broad debt burn-down projects;
5. human-decision items after explicit rulings.

## Accepted decision package (2026-07-28)

The owner accepted all six rulings and delegated the five engineering
decisions. Work remains sliced so an interrupted session resumes from
`tasks.md`, not from conversational context.

| ID  | Ruling                                                            | Completion evidence                                                                     |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| R1  | migrate and enable `exactOptionalPropertyTypes`                   | 295 current workspace errors reduced to zero; scripts/Prisma/e2e clean; planted failure |
| R2  | settled telemetry selects `periodStatus = "published"`            | shared selector and reopen/republish tests across all three consumers                   |
| R3  | baseline 27 type-only cycles, reject increases, burn down to zero | same-shell exit capture and planted 28th-cycle failure                                  |
| R4  | allow small local harness repetition after budget splits          | misleading names and divergent fakes removed; remaining four findings closed            |
| R5  | adjudicate each firing Vitest rule                                | durable per-rule ledger with measurement, probe, ruling, and gate result                |
| R6  | derive provenance resolution from OpenSpec trees                  | resolver has resolved/unresolved/ambiguous tests and no committed mapping               |

R2 uses the canonical lifecycle flavour because `reopen` intentionally leaves
legacy `status` at `published` while making the period editable again. R4 keeps
the test's setup local unless extraction creates leverage by owning behavior;
textual deduplication alone does not justify a new seam. R6 similarly places
one deep resolver interface over tree traversal without adding a maintained
index.

## Vitest rule frontier

The installed `@vitest/eslint-plugin` 1.6.24 exposes 82 rules. Production flat
config already enforced 31. The remaining 51 were measured over 549 test files
with the same parser, settings, and file scopes as `pnpm lint`: 49 fired and 2
configuration-only restriction rules were vacuous.

The durable per-rule ledger is `scripts/vitest-rule-ledger.json`. Three rules
were accepted after site inspection: `prefer-each` (2 fixes),
`prefer-hooks-in-order` (1), and `prefer-vi-mocked` (2). The other 48 have an
individual rejection reason; none is hidden behind a category-level dismissal.
A main-gate test validates the ledger, proves all three accepted rules are
enabled, and plants one firing shape for each.

## `functional/prefer-immutable-types` measurement

The installed `eslint-plugin-functional` 10.0.0 rule was executed through the
ESLint API so the flat config received the plugin in the same config object as
the temporary rule. A full `apps/*` + `packages/*` run reported 25,143 findings
across 1,364 files. Even the intended pure-source candidate
(`apps/api/src/modules/**/domain/**/*.ts` plus non-test
`packages/shared/src/**/*.ts`) reported 402 findings across 33 files.

This is not an adoptable local rule slice: its default `Immutable` threshold
classifies framework values, schema values, returns, parameters, and local
variables together. Enabling it would be a repository-wide type-contract
rewrite with its own option/scoping design and compatibility review. The
roadmap therefore records the measured project boundary and does not disguise
25k suppressions or autofixes as an exemplary improvement.
