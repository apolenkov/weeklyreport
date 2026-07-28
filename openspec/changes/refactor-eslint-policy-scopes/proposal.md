# Refactor ESLint Policy Scopes

## Why

`eslint.config.ts` contains 26 `files:` blocks, but they are not 26 equivalent
exceptions: many enable type-aware, package-public-API, React, Nest, test, UAT,
or architecture policy. A raw-count cleanup could erase enforcement while
appearing to improve the exemplary-floor metric.

## What Changes

- Classify all 26 blocks from effective configuration and representative files.
- Preserve distinct enforcement and policy scopes.
- Consolidate only proven duplication and remove only proven relaxation debt.
- Add planted representative probes so scope coverage cannot silently shrink.
- Update the ratchet to the measured post-classification block count.

## Non-goals

- Do not target zero `files:` blocks.
- Do not combine scopes whose plugins, parser programs, environments, or policy
  semantics differ.
- Do not move inline suppressions into configuration.
- Do not adopt new lint rules unrelated to the measured blocks.
