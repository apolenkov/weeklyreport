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
      Progress 2026-07-06: 4 domains landed + archived — analytics (3b4f9a9c),
      navigation→shared/ui (b07e75a1), dashboard (e8cf8a74), report-shell→shared/ui
      (c4592bd7); each via impl → full gate → 2 Fable adversaries + Codex → live-verify.
      Progress 2026-07-07: lib/mappers dissolved into
      features/{admin,dashboard,report-sections}/model
      (restructure-web-mappers-dissolution) — the trailing tree. lead, admin,
      weekly-report, common/ui primitives, and the shared/report-shell/navigation
      primitives all landed earlier this window (see git log).
      Progress 2026-07-07: `slides/` — the last survivor under `components/` —
      dissolved into `features/slides/{ui,model}`
      (restructure-web-slides-slice); `apps/web/src/components/` removed entirely.
      Task 3.1 is COMPLETE: every web domain lives in a `features/` slice or
      `shared/`, and all populated slices are boundary-enforced.

## 4. api: formalize existing ports in the invariant modules (internal only)

- [x] 4.1 For the four invariant modules `period`, `report-sections`, `review`, and
      `publication` (`admin` stays MODERATE-flat — not in this slice), lift internal
      files into `domain/application/infrastructure`, push residual `@prisma`/`@nestjs`
      imports out of the pure domain files, and inject repositories by Symbol token
      rather than concrete class; reuse the existing `*.contract.test.ts` as
      port-contract suites where the port exists (`period`, `report-sections`) and
      introduce the port + contract suite for `review` and `publication`. No
      cross-module rewiring. Full unit gate green.
      **Gated on clean git status (parallel session).**

## 5. api: wrap infra as ports (Email/Queue/Cache)

- [x] 5.1 Define EmailPort over `infrastructure/email`, QueuePort over
      `infrastructure/bullmq`, and CachePort over redis; bind port→adapter at each
      consuming module's boundary so reminders/analytics/pdf-export become
      unit-testable with in-memory fakes. Full unit gate green.
      C5 (8f5cfb08): `EmailPort` + `EMAIL_PORT` token — the reminder worker injects
      the interface; test double drops its `as never`. C6 (2f3ea69c): `JobEnqueuer`
      port — reminders/pdf-export narrow off bullmq's `Queue`; a real Queue
      structurally satisfies the port so wiring is unchanged; doubles drop their
      casts. C7 (CachePort) needed no new code: `RedisReadThroughCache`
      (infrastructure/cache/read-through-cache.ts) already IS the port and already
      ships a Map-backed in-memory fake test; analytics/telemetry implement
      `*CachePort`. Slice-5 payoff (unit-testable via in-memory fakes) was already
      met — this slice removed the type-hygiene escape hatches.

## 6. api: reroute cross-module deep imports to facades + flip the zone to error

- [x] 6.1 Reroute every cross-module deep import to the sibling module's
      `index.ts` barrel and flip the api cross-module lint zone to barrel-only.
      No new UnitOfWork: the tx seam already existed as pure functions taking a
      structural `Pick<Prisma.TransactionClient,…>` slice (council finding). C8
      (64646ae): the two tx/logic seams — review→applyRevokeTransition via
      report-sections/index, publication→buildTransition via period/index. C9a
      (38c4f43): 8 more barrels + all non-DI reroutes; also removed a real
      load-time side effect the barrels exposed (period-factory's top-level
      `new Logger`). C9b (62c5096): period.module DI + schedulers through sibling
      barrels. C10 (below): zone flipped from a per-edge grandfather allowlist to
      a generated barrel-only `except` (self + every sibling `X/index.ts` + the
      two still-loose root files `published-report-snapshot.ts` /
      `report-escalations.ts` until they relocate). Deep-path enforcement proven
      by negative test. Invariant guards held throughout: role-coverage (2),
      lifecycle-write-gate (1), and the tx-integration proofs (3) green — no
      `Prisma.TransactionClient` leak (the one cross-boundary pass is a pure fn
      taking a structural slice). Gate: unit 1410 + integration 258 green at each
      commit; C8/C9 adversarially verified (Codex CONFIRMED-CLEAN).
