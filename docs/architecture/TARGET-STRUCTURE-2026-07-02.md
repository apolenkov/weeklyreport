# Target directory architecture (2026-07-02)

The api is already a screaming-architecture modular monolith — `src/modules/<domain>/`
plus a cross-cutting `src/infrastructure/` — and three of its modules
(period, report-sections, admin) already carry the port pattern (a `*Repository`
interface the service owns, a `*.prisma-repository.ts` adapter, pure framework-free
domain files like `period-transition.ts`). The web app, by contrast, is type-first and
partly flat: a giant `components/<domain>/` tree, a flat `lib/` mixing hooks + utils +
mappers, plus `hooks/` and `server/`, so one feature's component, hook, and mapper live
in three unrelated trees. Packages are already correctly layered (`shared` = runtime-pure
Zod/tRPC contracts, `ui` = presentational primitives) with a single one-way lint zone.
The goal is a clear, best-practice grouping — domain-first, layer-second — that is easy
to search and machine-enforces its boundaries, reached by **finishing patterns already
present**, not rewriting. This is a plan, not a mandate to move files today.

## Chosen approach

Three methods, one per app, drawn from the four research tracks. Each is deliberately
**right-sized** to an MVP-stage two-app monorepo; the ceremony each track warns against
is rejected explicitly below.

### apps/api — modular DDD, completed per-module hexagon (not introduced)

**Decision.** Keep the `modules/<domain>/` + top-level `infrastructure/` shape. Generalize
the existing `period/` internal split — pure domain + application service + infrastructure
adapter + interface router — into the canonical intra-module layering. Treat all infra as
ports (DB already is; add Email/Queue/Cache), bind port→adapter at the module boundary with
a Symbol/abstract-class token.

**Why (cited).** The "modular hexagon" track (brocoders boilerplate; "Stop Mocking Prisma";
Domain-Driven Hexagon) says the single governing law is the Dependency Rule — imports point
inward, and if you deleted NestJS/Prisma the domain must still compile. period already
satisfies this: `period-transition.ts` is pure, `period.service.ts` depends on a
`PeriodRepository` port, `period.prisma-repository.ts` is the adapter. report-sections
(`LeadFormRepository`/`ReportSectionsRepository` + pure `report-section-merge.ts`/
`published-record-guard.ts`) and admin (`AdminRepository` + prisma facade) are the same
shape. So the api work is **formalize + complete + enforce a pattern already present in the
invariant-bearing modules**, module-by-module, matching the repo's exemplary folder-at-a-time
cadence — not a new abstraction.

**Right-sizing (the load-bearing choice).** Full `domain/application/infrastructure` +
ports is warranted **only** where non-trivial, long-lived invariants exist: **period**
(dual-state period tuple written atomically), **report-sections/review** (role-coverage +
section lifecycle + published-record lock), **publication** (publish atomicity + snapshot).
Thin CRUD — activity, project-activity, analytics, email, observability, search, telegram,
telemetry, organization — stays flat (`X.service.ts` + `X.prisma-repository.ts`). Both hexagon-track and
modular-monolith-track flag over-abstracting thin modules (ports+mappers+tokens inflating
file count with no invariant to protect) as **net-negative** against the <250-line exemplary
standard. Gate the split on real branching logic, not size alone.

**Considered & rejected.**

- _Big-bang top-level `domain/application/infrastructure` split across all 20 modules_ —
  massive churn on working code for an MVP; violates the repo's "surgical changes" rule.
  The per-module hexagon is the low-risk path.
- _CQRS / Event Sourcing_ — no context here has divergent read/write models or an audit
  requirement that justifies it; "minimum viable architecture."
- _EventEmitter2 for cross-module writes_ — the period dual-state write must be atomic; an
  async event that must be in the same transaction silently breaks consistency. Cross-context
  atomic writes stay **synchronous through an orchestrator**; events only for fire-and-forget
  (reminders, telemetry, search reindex).
- _Promoting a domain to its own package_ — violates low-granularity; adds build-graph +
  versioning cost with no second consumer.

### apps/web — Feature-Sliced Design, **lite** (3 zones), adapted to App Router

**Decision.** Introduce `apps/web/src/features/<domain>/` slices, each colocating
`ui/` + `model/` (client hooks, view-mappers, types) + `api/` (tRPC call wrappers).
Keep `app/` for routing only (thin `page.tsx`/`layout.tsx` that import a
slice/view). Add `apps/web/src/shared/` for business-agnostic web helpers. Dissolve the flat
`lib/mappers/` into each slice's `model/`; `hooks/` and one-off utils follow their domain.

**Web barrels are OPTIONAL and minimal — not a mandate** (research 2026-07-02:
Atlassian measured ~75% faster builds after deleting barrel proliferation;
bundlers/TS-server/test runners pay per re-export). A web slice adds an
`index.ts` only when another slice or `app/` route actually consumes it, keeps
it to the few real entry exports (types type-only), and NEVER a repo/app-root
mega-barrel. Where a slice barrel grows hot, drop it and express the boundary
as a deep-import lint zone instead (the enforcement below presumes a public
FILE, which can be the slice's top component instead of a barrel). Api module
facade barrels stay MANDATORY — they are ~2-export server files with no
bundler cost, and zone 3 enforcement keys on them.

**Naming honesty:** `features/<domain>/` are DOMAIN SLICES; this is not the FSD
"Features" layer (cross-page reused actions) — we deliberately reject the full
widgets/entities/features taxonomy (see Right-sizing). Package-level zones
(1/2/6) could alternatively use Turborepo's native Boundaries (tags) — noted as
an experimental, package-granular option; it cannot express intra-app zones 3/5,
so import-x remains the mechanism of record.

**Why (cited).** The FSD-for-App-Router track (official FSD Next guide; Next.js project-structure
docs) prescribes domain-first slices with colocated technical segments and a unidirectional
import rule, keeping `app/` as pure routing. Today `components/` has 18 domain subfolders while
mappers/hooks live elsewhere — exactly the "giant components dir + flat lib" anti-pattern the
sources name. Most web domains already exist as `components/<domain>/`, so the move is
mechanical (relocate + fix imports, minimal barrel only where consumed), not a redesign.

**Right-sizing (two deliberate cuts).**

1. **FSD-lite, not the 6-layer taxonomy.** The sources say full FSD ceremony (widgets vs
   features vs entities, 6 layers, public-API discipline) only pays off past ~15–20 features;
   this app has ~12 domains at MVP stage. Adopt three zones — `app/` (routing), `features/`
   (slices), `shared/` — and **reject** the widgets/entities layer distinction.
2. **No web `entities/` layer.** `packages/shared` already IS the cross-app entities/model
   (Zod + tRPC contracts) and `packages/ui` already IS `shared/ui`. Recreating them web-side
   would duplicate the source of truth and break the repo's "update shared before duplicating
   types" rule. Web slices hold **UI + client hooks + view-mappers only** and keep importing
   domain types from `@customreport/shared` and primitives from `@customreport/ui`.

**Considered & rejected.**

- _Full 6-layer FSD_ — over-engineered for ~12 MVP domains (see cut 1).
- _A web-side `entities/` / re-implemented `shared/ui`_ — double-modeling (see cut 2).
- _A `modules/<domain>/` layer mirroring api verbatim (screaming-monorepo track)_ — good
  parity instinct, but `features/` is the App-Router-native term and the mechanic is identical;
  no need for a second naming convention.
- _Slices under `app/`_ — any new `app/` route trips the e2e catalog-drift gate; keep slices
  in `src/features/` so relocation never manufactures a phantom route.
- _Big-bang relocation of all 18 domains_ — hundreds of import paths at once; unreviewable and
  re-triggers the eslint exemption list + ratchet on latent debt. One slice per OpenSpec change.

### packages — strict one-way typed boundaries, curated public API

**Decision.** Keep exactly two packages (`shared`, `ui`); do not extract more. Lock the layer
graph as lint: `apps → shared/ui`; `shared`/`ui` never import an app or each other; apps never
import each other at runtime (the tRPC `AppRouter` **type** import stays allowed). Curate `ui`'s
`exports` (today `./components/*`, `./lib/*`, `./hooks/*` wildcards expose every internal as
public API) toward a barrel, or explicitly document the wide surface.

**Why (cited).** The monorepo-hygiene track (frontend-monorepo FSD; pkgpulse 2026; Nx module
boundaries; `eslint-plugin-boundaries`) says: one-way acyclic graph, public-API-only imports,
contracts package framework-agnostic, UI presentational-only, **and** "fewer packages, more
folders — promote a domain to a package only when a second consumer shares it." shared/ui already
satisfy the layer purity; the gap is enforcement holes and the wildcard `exports` leak.

**Considered & rejected.**

- _`eslint-plugin-boundaries` / dependency-cruiser / Nx tags as the primary mechanism_ — for a
  2-app repo the tagging/config overhead exceeds the benefit, and the eslint config is already
  46 KB. **Prefer the existing `no-restricted-imports` zones for package-name bans, plus
  `import-x/no-restricted-paths` for the two relative-path zones (see Boundaries & enforcement).**
  Add dependency-cruiser
  only if cycle/orphan detection is genuinely needed (shared's admin/auth/schemas/trpc subfolders
  could grow cycles) — as a separate `pnpm lint` step, not a rewrite.
- _Tightening `ui` exports in one shot_ — a breaking change across every web import site; a real
  refactor slice, not a config tweak.

## Target tree

### apps/api (generalize the period/ shape; infrastructure/ unchanged)

```
apps/api/src/
├─ main.ts                      # composition root (shrinks as modules expose facades)
├─ app.module.ts
├─ lib/                         # cross-cutting pure helpers (logger, audit, business-date,
│                               #   group-scope, env, session-cookie) — framework-light
├─ infrastructure/             # unchanged: the technical layer, shared by all modules
│  ├─ prisma/  config/  email/  bullmq/  otel/  metrics/  health/
│  ├─ middleware/  throttler/  filters/
│  └─ trpc/                     # context, middleware (9 builders), router, error-mapper
└─ modules/
   ├─ period/                   # INVARIANT-BEARING — full internal split
   │  ├─ domain/                #   pure, framework-free (period-transition.ts, factory rules)
   │  ├─ application/           #   period.service.ts (use-cases) + PeriodRepository port
   │  │                         #   + EmailPort/QueuePort/CachePort/ClockPort seams
   │  ├─ infrastructure/        #   period.prisma-repository.ts + transition.apply + schedulers
   │  ├─ period.module.ts       #   binds port→adapter by token
   │  └─ *.contract.test.ts     #   one suite every adapter (prisma + in-memory) must pass
   ├─ report-sections/          # INVARIANT-BEARING — same split (merge/guard→domain,
   │                            #   service→application, prisma-repo→infrastructure)
   ├─ review/  publication/     # INVARIANT-BEARING — same split (as invariants demand)
   │
   ├─ admin/ auth/ carry-over/ weekly-report/ archive/        # MODERATE — flat + explicit
   │  reminders/ pdf-export/                                  #   port where a repo exists
   └─ activity/ project-activity/ email/ observability/       # THIN CRUD — stay flat:
      search/ telemetry/ organization/ analytics/ telegram/   #   X.service.ts + X.prisma-repo.ts
```

Note: `domain/application/infrastructure` folders appear **only** inside invariant-bearing
modules. A thin module is `service + prisma-repository + module` at the module root — no
subfolders. The infra ports (Email/Queue/Cache) are defined by their consumers (reminders,
pdf-export, analytics services) and implemented by adapters over the existing
`infrastructure/email` and `infrastructure/bullmq`.

### apps/web (app = routing; features = slices; shared = agnostic)

```
apps/web/src/
├─ app/                         # ROUTING ONLY — thin page.tsx/layout.tsx import a slice/view
│  ├─ (app)/lead|head|admin|reports/…   # role gates + <FeatureView/> composition
│  └─ api/…                     # Next route handlers (client-logs, web-vitals, revalidate-org)
├─ proxy.ts                     # auth boundary (Next 16 middleware replacement)
├─ features/
│  ├─ report-sections/          # the lead-form heart: current/next week, items, risks,
│  │  ├─ ui/                    #   decisions, activities (was components/lead/* + report-shell)
│  │  ├─ model/                 #   autosave/record-visibility/status-risk hooks + lead-form,
│  │  │                         #   item-status, lead-cross-author, report-content mappers
│  │  ├─ api/                   #   trpc call wrappers (saveDraft, submit, cross-author)
│  │  └─ index.ts               #   public API barrel
│  ├─ period/                   # period navigator, fill-from, stage chips/pipeline, request-reopen
│  ├─ review/                   # risk cards/dialogs, lead-review-feedback, review comment list
│  ├─ dashboard/                # head dashboard page + KPI/alert/blocked-at-risk/reopen cards + mappers
│  ├─ slides/                   # decks + section-slide-utils + use-fullscreen
│  ├─ admin/                    # admin panel + tabs + admin mappers/form-inputs/types
│  ├─ analytics/  weekly-report/  viewer/  search/  auth/  landing/  organization/
│  └─ …                         #   one slice per canonical domain (see Grouping rules)
└─ shared/                      # BUSINESS-AGNOSTIC web layer (rule-of-2, see Grouping rules)
   ├─ ui/                       #   report-shell/common/navigation primitives, error-boundary,
   │                            #   role-gate, forbidden-page (web-only, not in @customreport/ui)
   ├─ lib/                      #   trpc client/provider/context, query-client, format-date,
   │                            #   client-logger, pluralize, safe-next, role-home/visibility
   ├─ hooks/                    #   use-dialog-focus, use-cursor-pagination, use-scroll-fade, …
   └─ server/                   #   server-only session/org/print adapters
```

### packages (two only; one-way graph; curated barrels)

```
packages/
├─ shared/    # runtime-pure: Zod schemas + tRPC contracts + pure helpers (name, time).
│             #   = cross-app entities/model. Imports NOTHING app-side. Barrel: src/index.ts.
└─ ui/        # presentational shadcn/Tailwind primitives + tokens. No domain logic,
              #   no data-fetching. exports → curate away wildcards (./components/* etc.).

# Dependency direction (lint-enforced, acyclic):
#   apps/web ─type─▶ apps/api        (AppRouter type only; runtime import banned)
#   apps/web ──────▶ shared, ui
#   apps/api ──────▶ shared
#   shared, ui  ✗──▶ any app         (never)
#   ui          ✗──▶ shared domain   (stays domain-free)
```

## Grouping rules

Every file's home is a pure function of **two axes**, domain first, then layer/segment —
exactly the columns already in the catalog tables. There is one deterministic answer.

**Axis 1 — domain (which slice/module).** Assign to the CANONICAL domain vocabulary below
(mirrors the api's ~20 modules; it is the shared language across both apps). The catalog's web
`domain` column is finer and overlapping — `lead-form`, `report`, `report-sections`, `period`
all appear — so **collapse to the canonical name, do not lift the raw label**:

| Canonical domain                                                                                                                    | Absorbs (catalog labels seen)                                              |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| report-sections                                                                                                                     | report-sections, lead-form, report, lead-history                           |
| period                                                                                                                              | period, periods                                                            |
| review                                                                                                                              | review, reopen                                                             |
| dashboard                                                                                                                           | dashboard                                                                  |
| slides                                                                                                                              | slides                                                                     |
| admin                                                                                                                               | admin, products; reminders **web admin-UI labels only** (settings screens) |
| reminders                                                                                                                           | reminders (api scheduling/notification module)                             |
| analytics                                                                                                                           | analytics                                                                  |
| organization                                                                                                                        | organization, integrations                                                 |
| auth                                                                                                                                | auth, authorization                                                        |
| telemetry                                                                                                                           | telemetry                                                                  |
| telegram                                                                                                                            | telegram                                                                   |
| email                                                                                                                               | email, mail                                                                |
| observability                                                                                                                       | observability, monitoring                                                  |
| _(+ weekly-report, viewer, search, activity, project-activity, pdf-export, carry-over, publication, archive, landing as their own)_ |                                                                            |

**Axis 2 — layer/segment (where inside the slice).**

- api: `domain/` = pure, zero framework imports (entities, transitions, merges, guards,
  validators). `application/` = use-case service + the port interfaces it owns. `infrastructure/`
  = adapters (prisma-repository, schedulers, email/queue/cache adapters). Interface = the
  `*.router.ts` wired in `infrastructure/trpc`. Cross-cutting-with-no-single-owner → `src/lib/`.
- web: `ui/` = components. `model/` = client hooks, view-mappers, presentation types.
  `api/` = tRPC call wrappers. Business-agnostic + reused by ≥2 slices → `src/shared/`.

**Determinism knobs (resolve every ambiguous case the same way):**

1. _Shared vs slice._ **Web: rule-of-2.** A web helper stays in its slice until a **second**
   slice needs it; at the second slice consumer it graduates to `src/shared/`. This is forced
   by boundary zone 5: `features/A → features/B` imports are banned, so a two-slice-consumer
   helper has no legal home inside either slice — `shared/` is the only lawful meeting point.
   **api: rule-of-3.** An api helper graduates to `src/lib/` only at the **third** module
   consumer; two api modules may lawfully meet through a facade (zone 3), so no forcing applies.
2. _api internal split trigger._ A module stays **flat** until it either bears a load-bearing
   invariant **or** exceeds ~6 files; only then does it grow `domain/application/infrastructure`.
3. _Contracts vs presentation._ Anything that is the wire contract between web and api →
   `packages/shared`. Anything that reshapes a read-model for one surface → that slice's `model/`.
   Never duplicate a shared type into a slice.
4. _Routing vs feature._ If the file becomes a URL (`page.tsx`/`route.ts`/`layout.tsx`) → `app/`.
   Everything else it needs → the slice. `app/` files orchestrate and import; they hold no data logic.
5. _Pure vs adapter (api)._ If it imports `@prisma/client`/`@nestjs/*`/`ioredis`/`bullmq`/
   `nodemailer` it is `infrastructure/`, never `domain/`.

## Migration slices

Each slice below = one future OpenSpec change, independently shippable and behavior-neutral.
**These are PLANS, not scheduled work.** Many folders are currently dirty under a parallel
session; every slice is **gated on a clean target folder** (git-status first) and must land with
the full unit gate green (and, for the api cross-module slice, the single-thread integration gate).
Order is by **blast radius on the load-bearing invariants**, low→high — deliberately _not_ the
research's "period first (least effort)," because period is the atomic-write hotspot (~40 deep
cross-module imports) and is therefore highest-risk, not first.

1. **Enforcement ratchet baseline** (lowest risk — additive, zero file moves). Add the boundary
   zones from the next section with **all current violations allowlisted** (ratchet: forbid _new_,
   grandfather existing). This protects every later slice from silent regressions before any move.
2. **Web: extract ONE self-contained leaf slice — `landing`** (pinned: it is fully covered by
   `docs/architecture/mapping/`, unlike `search`). Proves the mechanic
   end-to-end: relocate → add `index.ts` → fix imports → edit the eslint exemption list → live-verify
   web from source (the shared-src `.js`-extension webpack gotcha passes tsc/vitest but 500s the page).
3. **Web: remaining slices**, one domain per change — including the giant `lead/`
   (→ report-sections + period + review) and `admin/`. `lib/mappers/` dissolves into each slice's
   `model/`; `report-shell`/`common`/`ui` primitives → `shared/`. Keep every move out of `app/`.
4. **api: complete the hexagon in the four invariant modules —
   {period, report-sections, review, publication}** (the ONE canonical list; `admin` stays
   MODERATE-flat and is NOT in this slice). Lift each module's internal files into
   `domain/application/infrastructure`, push any residual `@prisma`/`@nestjs` import out of the
   pure domain files, and inject repositories by **Symbol token** rather than concrete class.
   Where the port pattern already exists (period, report-sections) reuse the existing
   `*.contract.test.ts` as the port-contract suites; for `review` and `publication` this slice
   **performs the split** — introduce the repository port + contract suite they lack. No
   cross-module rewiring yet — internal only.
5. **api: wrap infra as ports.** Define EmailPort over `infrastructure/email`, QueuePort over
   `infrastructure/bullmq`, CachePort over redis; bind at each module boundary. Payoff: reminders/
   analytics/pdf-export become unit-testable with in-memory fakes, no live broker/DB.
6. **api: reroute cross-module deep imports to facades + flip the cross-module lint zone
   allowlist→error** (highest risk — touches period orchestration and the atomic dual-state write).
   Each module exports **only** a facade service via `@Module.exports` and re-exports it (plus the
   module class) from the module's `index.ts` barrel; siblings import **only that barrel** — never a
   raw `*.prisma-repository` or any other internal path (the lintable convention behind zone 3). Design a `withTransaction(fn)` / UnitOfWork seam **before** this slice so
   the atomic period write and publish atomicity don't leak `Prisma.TransactionClient`. Gate on
   `pnpm test:integration` (single-thread, postgres+redis up), not just unit tests.

## Boundaries & enforcement

The structure is only real if a machine gate locks it. **Two mechanisms, chosen by what a zone
matches on** — `@typescript-eslint/no-restricted-imports` can only match import _specifiers_
(package names / literal patterns) and has no per-site allowlist, so it cannot express a
relative-path zone like "module A must not reach into module B's files":

- **Package-name zones (4, 6)** → extend the **existing**
  `@typescript-eslint/no-restricted-imports` block in `eslint.config.ts` (the R3c zone at ~L556),
  scoped by `files`. The banned specifier is a package name, which this rule expresses natively.
- **Relative-path zones (3, 5)** → the resolver-aware `import-x/no-restricted-paths` rule from
  `eslint-plugin-import-x` (a new, narrowly-scoped dependency — NOT the rejected
  `eslint-plugin-boundaries`/Nx-tags machinery). It resolves relative imports to real paths and
  its native `except` option per zone carries the ratchet allowlist — no hand-rolled regexes.
- **Suppression ban.** `eslint-disable` comments for any boundary-zone rule are forbidden
  (enforced via `no-restricted-syntax`/`eslint-comments` on those rule ids); the config-level
  `except` allowlist is the ONLY grandfathering mechanism, so every exemption is reviewable in
  one place and shrinks monotonically.

Add dependency-cruiser as a separate `pnpm lint` step **only** if cycle/orphan detection is needed.
Every new zone ships **ratcheted** — current violations allowlisted, new ones error — or the gate
goes red on day one (the api cross-module zone alone has ~40 existing violations).

Concrete zones:

1. **Downward-only packages** — _already owned by `lint-max-strictness-standard` — verify, do
   not re-add._ `packages/shared/**` and `packages/ui/**` must not import `@customreport/api`
   or `@customreport/web` (nor each other). Locks the acyclic graph.
2. **Web → api runtime ban** — _already owned by `lint-max-strictness-standard` — verify, do
   not re-add._ `apps/web/**` may `import type` from `@customreport/api` (AppRouter for the
   tRPC client) but never a value import — a value import pulls the Nest/Prisma server graph
   into the browser bundle. `allowTypeImports: true` stays.
3. **api cross-module internals** (`import-x/no-restricted-paths`). `apps/api/src/modules/A/**`
   must not import from `apps/api/src/modules/B/**` except the sibling's `index.ts` **barrel** —
   the machine-checkable facade convention: each module re-exports its module class + facade
   service from `index.ts`, and the zone's sole `except` pattern is that barrel. Never
   `*.prisma-repository` or any other internal path. The ~40-violation ratchet; flips to error
   in migration slice 6.
4. **api domain purity** (`no-restricted-imports`). Files under an invariant module's `domain/`
   must not import `@prisma/client`, `@nestjs/*`, `ioredis`, `bullmq`, or `nodemailer`. Enforces
   the Dependency Rule: delete Nest/Prisma and the domain still compiles.
5. **web cross-slice ban** (`import-x/no-restricted-paths`). `apps/web/src/features/A/**` must
   not import `apps/web/src/features/B/**`; two slices meet only in `app/` (a route) or in
   `shared/` (rule-of-2 — see Grouping rules). Kills feature-to-feature coupling — the rule that
   actually prevents spaghetti.
6. **ui stays domain-free** (`no-restricted-imports`). `packages/ui/**` must not import
   `@customreport/shared` domain schemas (decide + document if a narrow exception is ever
   needed); charts receive finished series as props, shaped in the web slice or api.

Supporting: curate `packages/ui`'s `exports` map away from `./components/*` / `./lib/*` / `./hooks/*`
wildcards toward a barrel (its own slice — breaking change across web import sites), so a package's
public API is a deliberate surface, not every internal file.
