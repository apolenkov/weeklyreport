# Design

## Classification

Each block is evaluated through `ESLint.calculateConfigForFile` for at least one
positive representative and one nearby negative representative. It receives
one primary verdict:

| Verdict         | Meaning                                                    | Action             |
| --------------- | ---------------------------------------------------------- | ------------------ |
| enforcement     | enables a rule family for its intended language/surface    | preserve           |
| policy          | encodes an architectural or repository-specific boundary   | preserve           |
| specialization  | necessary parser/plugin/environment variation              | preserve           |
| duplicate       | effective rules are already supplied identically elsewhere | consolidate        |
| relaxation debt | disables or weakens policy without current evidence        | remove or redesign |

A block can be simplified only if the before/after effective configuration
matrix proves identical intended coverage and the planted probes still fire.

## Scope families

The measured config includes global TS, app/package source, Prisma, scripts and
tools, JS/config, package public JSDoc, web React/Next, API/Nest, feature
architecture, domain immutability, tests, UAT, and e2e families. These names are
an inventory aid, not advance verdicts.

## Completion

Completion is zero unclassified blocks, zero proven duplicates, and zero
unjustified relaxation debt. Necessary policy scopes may keep the raw count
nonzero. The exact resulting count replaces the baseline only after the
effective-config matrix and planted probes pass.
