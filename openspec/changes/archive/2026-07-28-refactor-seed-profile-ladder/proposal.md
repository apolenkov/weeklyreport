# Refactor Seed Profile Ladder

## Why

The repository exposes overlapping `small`, `middle`, `huge`, `fresh:simple`,
and `fresh:advanced` commands backed by three seed implementations.
`seed-simple.ts` is also the visual-regression and hard-reset fixture, while the
current huge dataset omits capabilities present in smaller datasets. These are
named sizes, not a reliable progression of product capability.

## What Changes

- Replace the public seed surface with one explicit selector for four profiles:
  `minimal`, `demo`, `full`, and `stress`.
- Make capabilities monotonic: `minimal` is a strict subset of `demo`, `demo`
  a strict subset of `full`, and `stress` retains `full` while increasing scale.
- Give every profile a checked-in capability/count manifest, stable identifiers,
  post-seed validation, and a profile-specific end-to-end smoke journey.
- Adapt hard reset, migration seed, visual regression, UAT, and developer
  commands to select a named profile explicitly.

## Non-goals

- Do not preserve accumulated MVP rows or obsolete command aliases.
- Do not require one monolithic writer; stable internal modules may remain.
- Do not weaken `prisma/_destructive-guard.ts` or target an unnamed external DB.
- Do not make wall-clock-relative active period dates byte-identical.
