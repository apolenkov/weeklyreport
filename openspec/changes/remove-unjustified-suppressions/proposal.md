# Remove Unjustified Suppressions

## Why

The current catalogue counts 126 live inline ESLint suppressions across 96
files. Their comments range from real framework/type mismatches to test
shortcuts and mutable-state exceptions, so deleting them mechanically or
promising a raw zero would be ungrounded.

## What Changes

- Inventory and adjudicate every live suppression against current source,
  installed rule behavior, and production ESLint settings.
- Remove or replace unnecessary suppressions.
- Retain only minimal-scope exceptions with a concrete current reason, an
  owning surface, and a planted proof that the rule still protects adjacent
  code.
- Update the ratchet to the measured retained total after all 126 starting
  entries are resolved.

## Non-goals

- Do not disable a rule or move inline debt into a broad config override.
- Do not rewrite correct code merely to satisfy a false-positive rule.
- Do not treat a justification comment as proof without reproducing the rule.
- Do not start ESLint `files:` block consolidation in this change.
