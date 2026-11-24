# Proposal

## Why

The public WeeklyReport repository contains identifiers from its original
deployment and team. A reader should be able to use the project and its
examples without those identifiers.

## What Changes

- Replace organization names, personal names and internal endpoints with generic
  wording, synthetic identities and reserved example addresses.
- Keep synthetic fixtures consistent with their tests and preserve the product
  and deployment contracts.
- Document historical matches in a private report. Preserve Git history.

## Capabilities

### New Capabilities

- `public-repository-content`: the public tree uses portable examples.

## Impact

README and SVG assets, documentation and OpenSpec, sample deployment settings,
and any affected fixtures and assertions.

Rename the reserved feedback discriminator to `external-product`. WeeklyReport
continues to store and return feedback under `weekly-report`. External ingress
stays closed, so the rename requires no data migration or legacy read alias.
