# Design — Upgrade TypeScript 5.9 → 6.0

## Context

`typescript` is declared once at the root `package.json` (`^5.8.3`, resolving to
`5.9.3`) and is the compiler behind every workspace's typecheck, lint, and build:
`apps/api`, `apps/web`, `packages/shared`, and `packages/ui` each run
`tsc --noEmit -p tsconfig.json`; the root runs
`tsc --project tsconfig.prisma.json --noEmit` (`pnpm lint:prisma:typecheck`); and
ESLint type-aware linting drives `tsc` through `projectService` in
`eslint.config.ts`. The registry latest is `6.0.3` — one major ahead.

TypeScript 6.0 is a major release: stricter type-checking defaults and removed
deprecated flags/APIs. Unlike a test-only dependency, the compiler sits under the
entire toolchain, so its blast radius is repo-wide and surfaces as new type
errors and rejected tsconfig options across all four strict-mode workspaces.

A second fact shapes the scope: `@typescript-eslint` adds TypeScript-version
support per release line, and the `8.60` line is the one that supports TS6 (the
dependency audit notes "typescript 6 should land with the @typescript-eslint 8.60
trio that supports it"). The repo pins the trio
(`@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`,
`typescript-eslint`) at `^8.58.1`. Type-aware linting would break if the compiler
moved to TS6 while the trio stayed on a line that does not support it.

This change is part of a Wave-3 dependency-currency effort where each major bump
is isolated into its own change so one breaking dependency cannot sink a batch.

## Decision

**Bump `typescript` 5.9 → 6.0 as a standalone, isolated change that internally
co-bumps the `@typescript-eslint` 8.60 trio as a required dependency, validated by
the full repo-wide typecheck/lint/test/build fan-out, with the merge decision left
to the user.**

Rationale:

- **Isolation is from the other Wave-3 majors, not from the tseslint trio.** The
  compiler and its lint adapter are a single coupled unit for validation
  purposes: type-aware ESLint cannot run on TS6 unless the trio supports TS6.
  Bundling them is correctness, not convenience. Keeping `@types/node`,
  `@vitejs/plugin-react`, `jsdom`, `lucide-react`, and `@bull-board/*` out is the
  isolation that matters — it keeps unrelated failure modes from entangling this
  bump and preserves a clean revert.
- **The acceptance gate is repo-wide, not a single suite.** Because the compiler
  underpins every workspace, validation is the full fan-out: per-workspace
  `tsc --noEmit`, the prisma typecheck (`tsconfig.prisma.json`), the
  tseslint-driven `eslint .`, the test suites, and the builds. A green run across
  all of these — with no suppressed errors or loosened strict flags — is the bar.
- **Fix the cause.** Stricter defaults and removed flags must be migrated by
  correcting tsconfig options and source to the new, spec-aligned behavior — not
  by adding `// @ts-expect-error`, disabling lint rules, or relaxing strictness to
  paper over a real error.
- **The trio is claimed here, not in the minor batch.** The same three packages
  appear in the `dependency-upgrades-minor` audit list; binding them to this
  change prevents a double bump and keeps the TS6-support coupling explicit.

## Alternatives considered

- **Batch with the other Wave-3 majors.** Rejected: violates the locked
  isolation decision and couples unrelated failure modes; a single breaking dep
  would force re-litigating the whole batch. High blast radius makes a clean,
  revertible boundary especially valuable here.
- **Bump `typescript` alone and leave the tseslint trio behind.** Rejected:
  type-aware linting (`projectService` in `eslint.config.ts`) would run on a TS6
  compiler with a trio that does not support it, breaking the lint gate. The trio
  is a required co-bump, not an optional one.
- **Let the tseslint trio ride in the minor batch instead.** Rejected: it would
  split a hard coupling across two changes, so the lint gate could only pass when
  both land — defeating the point of isolating the TS major for an independent
  merge decision.
- **Defer the upgrade.** Rejected: the gap only grows, and a future unrelated
  dependency could force TypeScript forward under worse conditions. Landing it
  now, isolated, is the cheapest point to absorb a high-blast-radius change.
