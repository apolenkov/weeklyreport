# Tasks

## 1. Shared profile contract

- [ ] Define typed `minimal`, `demo`, `full`, and `stress` profile names,
      capability manifests, stable identifiers, and bounded row-count
      invariants.
- [ ] Add one explicit selector and reject missing or unknown profiles.
- [ ] Share canonical identity and manifest validation without forcing all
      writers into one module.

## 2. Prisma writers and reset

- [ ] Map or refactor current `seed-demo.ts`, `seed-simple.ts`, and `seed.ts`
      content into the monotonic ladder.
- [ ] Ensure `minimal` is the smallest valid boot/auth/write dataset.
- [ ] Ensure `demo` contains every minimal capability plus the curated role,
      health, ownership, reminder, submission, and published-period scenarios.
- [ ] Ensure `full` contains every demo capability plus all shipped admin,
      activity, history, reopen, policy, archive, and publish families.
- [ ] Ensure `stress` contains every full capability at deterministic
      high-volume scale.
- [ ] Make reset select a profile explicitly and preserve the destructive guard.
- [ ] Scope post-seed checks to profile-owned report/entity IDs.

## 3. API and web consumers

- [ ] Update developer reseed routes and commands to the named profile contract.
- [ ] Update visual-regression, integration, UAT, and e2e setup to select the
      intended profile explicitly.
- [ ] Remove obsolete public seed commands after all callers migrate.

## 4. Profile proof

- [ ] Add manifest/count/stable-ID validation for every profile.
- [ ] Add a minimal boot/auth/edit smoke journey.
- [ ] Add a demo multi-role/health/Mine-versus-Everyone smoke journey.
- [ ] Add a full admin/history/reopen/publish smoke journey.
- [ ] Add a stress pagination/scroll/query-volume smoke journey while retaining
      the full capability manifest.
- [ ] Prove reseeding each profile produces identical IDs/text and bounded
      counts, excluding permitted week-relative dates.

## 5. Completion verification

- [ ] Run all four profile seed commands against disposable test databases.
- [ ] Run seed unit tests, Prisma tests, profile smoke journeys,
      `pnpm typecheck`, `pnpm lint`, and affected visual/e2e suites.
- [ ] Run `openspec validate refactor-seed-profile-ladder --strict`.
