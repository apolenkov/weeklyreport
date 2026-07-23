# review-finding-triage Specification

## Purpose

Define how a whole-repo review's low-severity findings on already-shipping
files are triaged: every recurring class gets an explicit fix-or-ratify
ruling before any mass edit, and no class is fixed on reviewer preference or
silently dropped.

## Requirements

### Requirement: Recurring Minor Finding Classes Are Ruled Fix-Or-Ratify Before Any Fix Runs

When a whole-repo review produces a large set of low-severity findings on
already-shipping (good-verdict) files, those findings MUST be classified into
recurring classes and each class given an explicit ruling — **fix-in-waves**
or **ratify-as-norm** — before any file is edited. A class MUST NOT be fixed
en masse on reviewer preference alone, and a class MUST NOT be silently
dropped. The ruling authority is the department head (Sasha). The 2026-07-22
baseline is `class-distribution.json` in the `good-to-exemplary-triage`
change: 513 minors across 422 good files, 16 named classes plus a residual
`other` bucket, every count computed from the review dataset.

#### Scenario: A fix wave is proposed for an unruled class

- **WHEN** an implementation wave is about to edit files for a finding class
  from a whole-repo review
- **THEN** that class MUST already carry a recorded fix-in-waves ruling; if
  it does not, the wave does not start until the ruling is made

#### Scenario: A class is ratified as the house norm

- **WHEN** a class is ruled **ratify-as-norm**
- **THEN** its findings are closed as by-design, a reject-list entry is added
  to the mass-review rubric so the pattern is not re-flagged on the next
  whole-repo review, and any contradicting rule in `CLAUDE.md` /
  `docs/exemplary-code-standard.md` is reconciled in the same change

#### Scenario: A file is promoted to exemplary

- **WHEN** all of a file's minor findings are cleared or ratified
- **THEN** the file reaches **exemplary** only if it also independently meets
  the hard bar in `docs/exemplary-code-standard.md` (size, function length,
  cognitive complexity, zero `let`/mutation, `eslint --max-warnings 0`, no
  exempt entry) — clearing review findings alone does not confer exemplary
