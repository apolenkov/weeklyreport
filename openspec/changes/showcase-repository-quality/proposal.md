# Proposal

## Why

Readers and contributors need to see which checks run on GitHub, how to
report a vulnerability privately, and how the application fits together.

## What Changes

- Add coverage and supply-chain jobs alongside the existing CI checks.
- Run CodeQL and publish OpenSSF Scorecard results from GitHub Actions.
- Add GitHub contribution templates and a private reporting link.
- Document the application, checks, and local setup in the README. Add diagrams
  from the source tree and images from actual command output.

## Capabilities

### New Capabilities

- `repository-quality`: public repository checks and contributor entry points.

## Impact

GitHub workflows, community files, contributor and security guides, and
README assets. The application and its deployment commands are unchanged.
