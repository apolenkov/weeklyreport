# Batch-Upgrade Minor And Patch Dependencies

## Why

The dependency audit (2026-05-29) found 21 minor/patch updates across the
monorepo. These are low-risk currency bumps with no expected breaking changes.
Doing them one-by-one would burn 21 gate cycles for no benefit; doing them in a
single batch keeps the working tree current with one validated gate pass.

The 8 MAJOR items (including the two "Deprecated" packages and `lucide-react`)
are intentionally OUT of scope here — each carries real blast radius and is
handled by its own isolated change so a failure stays contained.

## What Changes

- Bump all 21 minor/patch dependencies to the audit's target versions in one
  batch, grouped so coupled packages move in lockstep.
- Run the full gate suite ONCE after the whole batch (not per-package).
- Treat `@anthropic-ai/sdk 0.98.0 -> 0.100.1` as elevated-risk: it is pre-1.0,
  so a "minor" can carry breaking changes. Verify the AI-module facade still
  compiles and its tests pass.
- Explicitly EXCLUDE all 8 majors. Not touched here:
  `@bull-board/api`, `@bull-board/express`, `@types/node`,
  `@vitejs/plugin-react`, `jsdom`, `typescript`, `lucide-react`,
  and the two deprecated stubs (`@react-email/components`, `@types/cookie`).

Coupled groups that MUST bump together to the same target:

- `@sentry/nestjs`, `@sentry/nextjs`, `@sentry/node` -> 10.55.0
- `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`,
  `typescript-eslint` -> 8.60.0
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` -> 11.1.24
- `@commitlint/cli`, `@commitlint/config-conventional` -> 21.0.2

## Impact

- Affected workspaces: root (`customreport`), `apps/api`, `apps/web`.
  (`packages/ui`, `packages/shared` carry no minor/patch items in this batch.)
- Files: `package.json` (root), `apps/api/package.json`,
  `apps/web/package.json`, plus the `pnpm-lock.yaml` lockfile.
- Risk: Low overall. The single elevated-risk item is `@anthropic-ai/sdk`
  (pre-1.0). The typescript-eslint trio interacts with `eslint.config.ts`;
  the Nest trio and `@sentry/*` set must stay version-synced to avoid
  instrumentation/adapter mismatch.
- No source, schema, or migration changes are expected. No production UI
  strings, no theme/director work touched.
