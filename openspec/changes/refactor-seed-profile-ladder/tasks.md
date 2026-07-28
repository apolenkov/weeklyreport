# Tasks

## 1. Shared profile contract

- [x] Define typed `minimal`, `demo`, `full`, and `stress` profile names,
      capability manifests, stable identifiers, and bounded row-count
      invariants.
- [x] Add one explicit selector and reject missing or unknown profiles.
- [x] Share canonical identity and manifest validation without forcing all
      writers into one module.

## 2. Prisma writers and reset

- [x] Map or refactor current `seed-demo.ts`, `seed-simple.ts`, and `seed.ts`
      content into the monotonic ladder.
- [x] Ensure `minimal` is the smallest valid boot/auth/write dataset.
- [x] Ensure `demo` contains every minimal capability plus the curated role,
      health, ownership, reminder, submission, and published-period scenarios.
- [x] Ensure `full` contains every demo capability plus all shipped admin,
      activity, history, reopen, policy, archive, and publish families.
- [x] Ensure `stress` contains every full capability at deterministic
      high-volume scale.
- [x] Make reset select a profile explicitly and preserve the destructive guard.
- [x] Scope post-seed checks to profile-owned report/entity IDs.

## 3. API and web consumers

- [x] Update developer reseed routes and commands to the named profile contract.
- [x] Update visual-regression, integration, UAT, and e2e setup to select the
      intended profile explicitly.
- [x] Remove obsolete public seed commands after all callers migrate.

## 4. Profile proof

- [x] Add manifest/count/stable-ID validation for every profile.
- [x] Add a minimal boot/auth/edit smoke journey.
- [x] Add a demo multi-role/health/Mine-versus-Everyone smoke journey.
- [x] Add a full admin/history/reopen/publish smoke journey.
- [x] Add a stress pagination/scroll/query-volume smoke journey while retaining
      the full capability manifest.
- [x] Prove reseeding each profile produces identical IDs/text and bounded
      counts, excluding permitted week-relative dates.

## 5. Completion verification

- [x] Run all four profile seed commands against disposable test databases.
- [x] Run seed unit tests, Prisma tests, profile smoke journeys,
      `pnpm typecheck`, `pnpm lint`, and affected visual/e2e suites.
- [x] Run `openspec validate refactor-seed-profile-ladder --strict`.
