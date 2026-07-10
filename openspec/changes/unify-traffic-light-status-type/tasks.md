## 1. Shared foundation

- [x] 1.1 Add
      `export type TrafficLightStatus = z.infer<typeof trafficLightStatusSchema>`
      beside the schema in `report-primitives.schema.ts` (barrel-reachable via
      `schemas/report.ts`; no index edit).
- [x] 1.2 Dedupe `analytics.ts`: `trafficLightCellSchema` derives from
      `trafficLightStatusSchema.nullable()`.
- [x] 1.3 Add or extend a shared test pinning the schema: accepts exactly
      green/yellow/red, rejects other strings (e.g. "amber").
- [x] 1.4 Gate: run the shared package test suite via the package filter.

## 2. Api swap

- [x] 2.1 Swap the 5 api source re-declarations to the shared import
      (`lead-form-shared.ts` x2, `lead-form.prisma-repository.ts` aliases,
      `report-sections.prisma-repository.ts`, `lead-form.service.ts`).
- [x] 2.2 Delete `published-report-snapshot.ts`'s exported duplicate type;
      swap its consumer `weekly-report-portfolio.ts` to the shared import.
- [x] 2.3 Add the Prisma-to-shared type-identity test in the api package
      (expectTypeOf equality against the generated Prisma enum).

## 3. Web swap

- [x] 3.1 Swap the 13 web source re-declarations to shared imports with
      composition preserved (`SlideTrafficStatus = TrafficLightStatus | null`,
      `PillStatus = TrafficLightStatus | "empty"`,
      `Record<TrafficLightStatus, X>`); `model/traffic-light.ts` keeps
      `StageStatus` and both mappers, only its color alias becomes an import;
      `lib/activity-alarm.ts`'s deliberate subset stays as-is.

## 4. Tests and verification

- [x] 4.1 Swap the 6 test fixture files' union annotations to the shared
      import (import-line churn only).
- [x] 4.2 Verify by grep: the full three-literal union appears nowhere outside
      `report-primitives.schema.ts` (justified subset in activity-alarm noted).
- [x] 4.3 Update `openspec/specs/architecture-refactor-backlog/spec.md` and
      the matching change delta: target CLOSED with corrected inventory.
- [x] 4.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`,
      and `git diff --check`, then validate this change with `--strict` and
      run the full strict OpenSpec validation.
