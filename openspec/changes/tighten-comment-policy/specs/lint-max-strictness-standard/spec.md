# lint-max-strictness-standard — delta: tighten-comment-policy

## ADDED Requirements

### Requirement: Source comments fit a three-line WHY budget

A comment in `src` MUST state a non-obvious WHY that the code cannot express,
within a budget of three lines; code a competent reader can follow from names
and types MUST carry no comment at all. Narration of what the code already
says, change-log/ticket/phase archaeology, and JSDoc blocks on app-internal
declarations (anything outside the cross-package public API defined by the
JSDoc requirement) are noise and MUST be removed during exemplary sweeps.

#### Scenario: a narration comment is removed

- **WHEN** a sweep encounters a comment that restates what the adjacent code
  does (e.g. "validate the role, then build the session")
- **THEN** the comment is deleted with no replacement

#### Scenario: a terse non-obvious WHY survives

- **WHEN** a sweep encounters a two-line comment stating a constraint the code
  cannot express (e.g. why a read must stay lazy to avoid a boot-order crash)
- **THEN** the comment is kept as-is

#### Scenario: an app-internal JSDoc block is removed

- **WHEN** a sweep encounters a JSDoc block on a non-exported helper inside
  `apps/api/src` or `apps/web/src`
- **THEN** the block is removed, or reduced to a WHY line within the budget if
  one is genuinely non-obvious

### Requirement: Over-budget rationale is relocated before compression

Load-bearing rationale that exceeds the comment budget MUST be relocated, not
deleted: the sweep MUST first verify a covering requirement exists in
`openspec/specs/` (or an ADR) and add one when absent, and only then compress
the code comment to at most two lines, optionally pointing at the spec.
Deleting load-bearing rationale without relocation MUST be treated as a
review-blocking violation.

#### Scenario: rationale already captured by a spec compresses safely

- **GIVEN** a 10-line comment explaining the HS256 algorithm pin, and
  `jwt-session-integrity` already requires the `["HS256"]` allow-list
- **WHEN** the sweep processes the file
- **THEN** the comment compresses to at most two lines (optionally naming the
  spec), and the rationale survives in the spec

#### Scenario: rationale with no spec home is relocated first

- **WHEN** a sweep finds an over-budget comment carrying rationale no spec or
  ADR covers
- **THEN** the sweep adds the covering requirement (or ADR) before compressing
  the comment

#### Scenario: silent deletion is rejected

- **WHEN** a review finds a sweep deleted an over-budget load-bearing comment
  with no covering spec or ADR added
- **THEN** the sweep is rejected until the rationale is relocated

### Requirement: Comment sweeps over security-sensitive paths pass security review

A comment sweep MUST pass a security review before merge whenever it removes
or compresses comments in security-sensitive paths (including but not limited
to authentication, JWT, session cookies, redirects, rate limiting, CSP, CSRF,
password/secret handling, authorization checks), so that a protective
rationale is never lost by a style-only diff.

#### Scenario: an auth comment sweep is security-reviewed

- **WHEN** a comment-only sweep touches `apps/api/src/modules/auth`
- **THEN** the diff passes a security review pass before merge
- **AND** a finding that a compressed comment dropped an unspecced protective
  rationale blocks the merge until relocation completes

### Requirement: Comment policy is enforced by review, not lint

The comment policy MUST be enforced as an audit/PR-review dimension: no lint
rule judges comment noise, a lint-green run MUST NOT be read as
comment-clean, the per-folder exemplary done-signal MUST include a
comment-policy review pass in addition to exemption-free lint, and standing
PR review MUST apply the policy to every later diff so a swept folder cannot
silently regress between sweeps.

#### Scenario: lint-green does not close a folder with over-budget comments

- **WHEN** a folder passes `eslint --max-warnings 0` with no exemptions but
  still carries over-budget or narration comments
- **THEN** the folder is not "done" until a review pass confirms the comment
  policy holds

#### Scenario: a post-sweep PR reintroducing noise is caught in its own review

- **GIVEN** a folder already swept to the comment policy
- **WHEN** a later PR adds a narration comment or an over-budget block there
- **THEN** that PR's review flags it against this policy — detection does not
  wait for the folder's next sweep
