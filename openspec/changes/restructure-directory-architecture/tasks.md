## 1. Enforcement ratchet baseline (additive, zero file moves)

- [x] 1.1 Add the four NEW boundary zones to `eslint.config.ts`: the package-name
      zones (api domain-purity; ui-domain-free) extend the existing
      `@typescript-eslint/no-restricted-imports` block; the relative-path zones
      (api cross-module internals; web cross-slice) use the resolver-aware
      `import-x/no-restricted-paths` rule from `eslint-plugin-import-x`, its native
      `except` option carrying the allowlist. Each zone lands with ALL current
      violations allowlisted (forbid new, grandfather existing); structure the
      allowlist as zone entries per consuming module to keep the grandfathered
      scope minimal (a module's entry covers only the paths it already imports);
      `eslint-disable`
      suppression of boundary zones forbidden; do NOT re-declare the package-level
      zones already owned by `lint-max-strictness-standard` — verify, do not re-add.
      Land `pnpm lint` green. **Gated on clean git status (parallel session).** - DONE (2026-07-05). Installed `eslint-plugin-import-x`, `eslint-import-resolver-typescript`
      (required so `no-restricted-paths` resolves NodeNext `.js`→`.ts` specifiers; without it every
      zone is a silent no-op), and `@eslint-community/eslint-plugin-eslint-comments` (the
      spec-mandated suppression ban). Zones: (3) api cross-module `import-x/no-restricted-paths`,
      one zone per module, 36 grandfathered `except` entries across 11 consumers (30 sibling-module + 6 loose-root-file imports); (4) api domain-purity `no-restricted-imports` on invariant
      `domain/**` (inert — domain/ arrives slice 4, 0 violations); (5) web cross-slice
      `no-restricted-paths` wired with empty zones (features/ absent — each web slice appends its
      own `{target,from,except:[self]}` zone from slice 2); (6) ui-domain-free `no-restricted-imports`
      (0 violations). Verified fail-closed: synthetic new cross-module import errors; inverse test
      (drop one `except` → that exact import errors) proves the resolver + allowlist are load-bearing;
      eslint-disable of a boundary rule is itself reported. `pnpm lint` + `pnpm typecheck` + api/web
      unit suites green. Zones 1-2 (packages one-way, web→api) verified still active in
      `lint-max-strictness-standard`, not re-added.

## 2. Web: extract ONE self-contained leaf slice (proves the mechanic)

- [x] 2.1 Relocate the pinned pilot leaf domain `landing` (fully covered by
      `docs/architecture/mapping/`, unlike `search`) from
      `apps/web/src/components/landing/` to `apps/web/src/features/landing/` with
      `ui/`/`model/`/`api/` (minimal `index.ts` ONLY if a route/slice consumes
      it — web barrels are optional per the standard), fix imports, edit the eslint
      exemption list, and live-verify web from source (the shared-src `.js`-extension
      webpack 500 that tsc/vitest miss). Full unit gate green.
      **Gated on clean git status (parallel session).** - DONE (2026-07-06). `git mv`
      of all 7 files + 2 snapshots to `features/landing/ui/`; `features/landing/index.ts`
      barrel (route consumer exists); consumer imports + vi.mock paths updated in 3 app/
      files; `landing` zone appended via new `webCrossSliceZones`; complexity-exemption
      path updated. Fail-closed proven (synthetic cross-slice import errors). Full gate
      green (typecheck, lint, 1497 web unit). Live-verified from source on :3100 —
      `/` 200, moved components SSR-render, no webpack module-resolution 500. Fable
      adversarial review APPROVED (2 LOW: stale zone-5 comment fixed in-commit;
      barrel-vs-internals except semantics deferred to slice 3).

## 3. Web: remaining slices (one domain per change)

- [ ] 3.1 Relocate the remaining web domains one slice at a time — including the
      giant `lead/` (→ `report-sections` + `period` + `review`) and `admin/` —
      dissolving `lib/mappers/` into each slice's `model/` and moving
      `report-shell`/`common`/`ui` primitives to `src/shared/`; keep every move OUT
      of `app/`. Each domain lands its own OpenSpec change with the full unit gate green.
      **Gated on clean git status (parallel session).**

## 4. api: formalize existing ports in the invariant modules (internal only)

- [ ] 4.1 For the four invariant modules `period`, `report-sections`, `review`, and
      `publication` (`admin` stays MODERATE-flat — not in this slice), lift internal
      files into `domain/application/infrastructure`, push residual `@prisma`/`@nestjs`
      imports out of the pure domain files, and inject repositories by Symbol token
      rather than concrete class; reuse the existing `*.contract.test.ts` as
      port-contract suites where the port exists (`period`, `report-sections`) and
      introduce the port + contract suite for `review` and `publication`. No
      cross-module rewiring. Full unit gate green.
      **Gated on clean git status (parallel session).**

## 5. api: wrap infra as ports (Email/Queue/Cache)

- [ ] 5.1 Define EmailPort over `infrastructure/email`, QueuePort over
      `infrastructure/bullmq`, and CachePort over redis; bind port→adapter at each
      consuming module's boundary so reminders/analytics/pdf-export become
      unit-testable with in-memory fakes. Full unit gate green.
      **Gated on clean git status (parallel session).**

## 6. api: reroute cross-module deep imports to facades + flip the zone to error

- [ ] 6.1 Design a `withTransaction(fn)`/UnitOfWork seam FIRST, then reroute every
      cross-module deep import to the sibling module's `index.ts` barrel (which
      re-exports the module class + facade service; the zone's sole `except`
      pattern — never a raw `*.prisma-repository` or other internal path), and flip
      the api cross-module lint zone from allowlist→error. Gate on `pnpm test:integration` (single-thread, postgres+redis
      up) AND the full unit gate; verify the atomic period dual-state write and publish
      atomicity do not leak `Prisma.TransactionClient`.
      **Gated on clean git status (parallel session).**
