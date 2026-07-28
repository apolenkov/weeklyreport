# Remove Unjustified Suppressions

## Why

The starting catalogue reported 126 raw `eslint-disable` substrings across 96
files. Parser-backed inventory proved that this was 115 live directives across
93 files plus 11 strings or documenting mentions. The directives range from
real framework/type mismatches to test shortcuts and mutable-state exceptions,
so deleting them mechanically or promising a raw zero would be ungrounded.

## What Changes

- Preserve all 126 starting observations in the ledger, explicitly separating
  the 115 directives from the 11 measurement-noise records.
- Inventory and adjudicate every live directive against current source,
  installed rule behavior, and production ESLint settings.
- Remove or replace unnecessary suppressions.
- Retain only minimal-scope exceptions with a concrete current reason, an
  owning surface, and a planted proof that the rule still protects adjacent
  code.
- Update the ratchet to parser-backed directive semantics and then to the
  measured retained total after all 115 starting directives are resolved.

## Non-goals

- Do not disable a rule or move inline debt into a broad config override.
- Do not rewrite correct code merely to satisfy a false-positive rule.
- Do not treat a justification comment as proof without reproducing the rule.
- Do not start ESLint `files:` block consolidation in this change.
