## Context

`period/index.ts` exports both pure period helpers and the eager Nest `PeriodModule`. Admin services lawfully import the helpers through that facade, while `PeriodModule` imports `AdminModule`; native ESM therefore evaluates the Nest graph before `AdminModule` is initialized and the API fails at module load. Vitest's transformed module graph did not reproduce the production loader behavior.

## Goals / Non-Goals

**Goals:**

- Keep sibling-module consumers on the mandatory `index.ts` facade.
- Give the API composition root a distinct public entry for eager Nest module wiring.
- Prove native TypeScript ESM import succeeds before runtime bootstrap.

**Non-Goals:**

- Change provider ownership, period lifecycle rules, or request behavior.
- Introduce `forwardRef` across the admin/period/report-sections graph.
- Permit sibling modules to import `module.ts` or other internals.

## Decisions

### 1. Separate contract and composition entries

`period/index.ts` keeps domain/application exports and stops re-exporting `PeriodModule`. A new `period/module.ts` exports only `PeriodModule`, and `app.module.ts` imports that explicit composition entry. This prevents helper consumers from eagerly evaluating the Nest graph.

Alternatives rejected: deep-importing period helpers violates the boundary ratchet; cascading Nest `forwardRef` calls leaves decorator metadata TDZ edges and obscures the actual dependency; moving settings ownership is a wider refactor than this boot fix requires.

### 2. Scope the lint rule by consumer layer

Sibling business modules remain allowed to consume only `<module>/index.ts`. API bootstrap and infrastructure zones may consume `<module>/index.ts` or `<module>/module.ts`; all other internal paths remain rejected. This is a reusable public-entry convention rather than a period-specific exemption.

### 3. Test the real loader

A focused Vitest test spawns Node with `@swc-node/register/esm-register` and imports `src/app.module.ts`. This exercises the loader path used by source startup and fails on TDZ cycles that Vitest's own transform can mask.

All load-bearing invariants are preserved: period dual-state writes and role middleware are untouched; no database or deferred-feature behavior changes.

## Risks / Trade-offs

- [A future module exports business APIs from `module.ts`] -> sibling zones still reject `module.ts`; the entry is reachable only from bootstrap/infrastructure.
- [A loader test becomes environment-sensitive] -> import the graph without application bootstrap or environment-file dependencies; the import path performs no network access.
- [Another eager export recreates a cycle] -> the loader regression imports the complete `AppModule` graph.
