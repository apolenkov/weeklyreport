## MODIFIED Requirements

### Requirement: Status literal-union re-declarations are gated

The gate MUST match over the syntax tree rather than over source text, and MUST
run with inline configuration disabled so no comment can suppress a verdict. A
file it cannot parse, or does not lint, MUST fail rather than pass.

The syntax-tree requirement is what keeps fixture source inside string literals
from being read as declarations — the gate's own test file declares
vocabularies that way, and a text scan reported 28 hits there that are not
declarations at all.

The exemptions are the three SSOT files themselves and the documented literal
mirror `prisma/seed-constants.ts` — four paths, hardcoded centrally, with no
inline annotation escape. The e2e tree needs no exemption of its own: the gate
does walk `e2e/**`, and the one role mirror left there is an `as const` VALUE
list, which is out of scope by construction rather than by allowlist.

#### Scenario: A vocabulary is re-declared outside its SSOT

- **WHEN** a staged source or test file declares a union or zod literal list
  carrying a full traffic-light, report-status, canonical-status or role
  vocabulary outside its SSOT file
- **THEN** the gate exits non-zero naming the file and line, and the commit is
  blocked by lint-staged

#### Scenario: A union planted under e2e is reported

- **WHEN** a role union is declared anywhere under `e2e/`
- **THEN** the repo-wide `--all` sweep reports it, because the gate's ignore
  list does not exclude that tree

#### Scenario: Fixture source inside a string is not a declaration

- **WHEN** a file passes vocabulary source to a helper as a template literal,
  as the gate's own test file does
- **THEN** the gate reports nothing for it, because a string is not a union

### Requirement: The gate is wired into both lint paths

The gate MUST run from lint-staged on every staged `.ts`/`.tsx` file, including
tests, and from the root `lint` composite as a repo-wide `--all` sweep, so hook
bypasses and rebases cannot land violations silently. The composite entry is
named `lint:ssot-gate`: the gate covers roles as well as statuses, and matches
syntax rather than literals, so the earlier name described neither.

#### Scenario: Sweep-time gating

- **WHEN** `pnpm lint` runs
- **THEN** the gate sweeps the whole tree via `--all` and fails the composite on
  any hit
