# Research: organizing a TypeScript monorepo (2025–2026 best practice)

Scope: pnpm workspaces + Turborepo; one NestJS app, one Next.js App-Router app, shared
packages. Question: how to structure folders/files so the layout is logical, searchable, and
machine-enforceable. Method: primary sources only — every claim links to the doc that owns it;
disagreements are flagged, not averaged.

Compared against `docs/architecture/TARGET-STRUCTURE-2026-07-02.md` (the current plan) in the
"How this maps to CustomReport" section. Contradictions/refinements are called out there.

## TL;DR (10)

1. **apps/ = deployables, packages/ = everything else.** Turborepo prescribes exactly this split; never reach across a package with `../` — declare the dep and import the package name ([turbo](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)).
2. **Domain-first, layer-second is the consensus.** Uncle Bob's Screaming Architecture (top level shouts the domain, not the framework) and NestJS feature modules agree ([cleancoder](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html), [nestjs](https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/modules.md)).
3. **Next.js is explicitly unopinionated** about project organization; it offers three strategies (files outside `app/`, top-level inside `app/`, split-by-feature) and says "choose one and be consistent" ([next](https://nextjs.org/docs/app/getting-started/project-structure)).
4. **FSD is the canonical frontend domain-slice spec:** 7 layers, slices partition by domain, segments (`ui`/`model`/`api`/`lib`/`config`) partition by technical nature; use only the layers that pay off ([fsd layers](https://feature-sliced.design/docs/reference/layers), [fsd slices](https://feature-sliced.design/docs/reference/slices-segments)).
5. **FSD's iron rule: a slice may only import layers strictly below it, and same-layer slices may NOT import each other** — this is the anti-spaghetti rule ([fsd layers](https://feature-sliced.design/docs/reference/layers)).
6. **The barrel file (`index.ts`) is now a live contradiction.** FSD _mandates_ a public-API barrel per slice; Atlassian got **75% faster builds by deleting barrels** (TS-server + test-runner + tree-shaking cost). Reconcile by granularity/context, not by averaging ([fsd slices](https://feature-sliced.design/docs/reference/slices-segments), [atlassian](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files)).
7. **Colocation is the Next.js default** — non-routable files are safe inside route segments; `_private` folders and `(route-group)` folders opt out of routing. Central `lib/` dirs are a _strategy_, not a mandate ([next](https://nextjs.org/docs/app/getting-started/project-structure)).
8. **kebab-case filenames + role suffixes** (`.service.ts`, `.repository.ts`) and one-concept-per-file are the Angular-style-guide canon; ban generic `utils.ts`/`helpers.ts`/`common.ts` ([angular](https://angular.dev/style-guide)).
9. **Enforcement has four real options**, in ascending config cost: `import-x/no-restricted-paths` (relative-path zones, `except` allowlist), `no-restricted-imports` (package-name bans), Turborepo **Boundaries** (native, tag-based, experimental), Nx `enforce-module-boundaries` (tags + `depConstraints`). All are lint/graph-level — none is a runtime guarantee ([import-x](https://github.com/un-ts/eslint-plugin-import-x/blob/master/docs/rules/no-restricted-paths.md), [turbo boundaries](https://turborepo.dev/docs/reference/boundaries), [nx](https://nx.dev/features/enforce-module-boundaries)).
10. **Fewer packages, more folders.** Turborepo warns against `../` leakage; promote a folder to a package only when a _second consumer_ shares it. God shared-package and app-to-app value imports are the two named pitfalls ([turbo structuring](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository), [turbo boundaries](https://turborepo.dev/docs/reference/boundaries)).

---

## 1. app vs package split criteria

Turborepo: "split your packages into `apps/` for applications and services and `packages/` for
everything else, like libraries and tooling." Cross-package `../` is an explicit smell — "if you
ever find yourself writing `../` to get from one package to another, you likely have an
opportunity to re-think your approach by installing the package where it's needed." Nested
packages (`apps/**` inside `apps/**`) are **unsupported** due to package-manager ambiguity;
group with globs (`packages/*`, `packages/group/*`) not nested `package.json`. Namespace every
internal package (`@repo/x`, `@acme/x`) ([turbo structuring](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)).

**When to extract a package (heuristic, not a hard spec).** The primary anchor is Turborepo's
"install it where it's needed" rule — i.e., extract when a second consumer would otherwise reach
across a boundary. The "rule-of-2 / fewer packages, more folders" phrasing is a _community
heuristic_ built on top of that rule, not a first-party prescription; treat it as such. Package
extraction adds build-graph + versioning cost, so the bar is a real second consumer, not size.

## 2. layer-vs-feature grouping (and hybrid)

The origin of "feature-first" is **Screaming Architecture**: "When you look at the top level
directory structure … do they scream: Health Care System … Or do they scream: Rails, or
Spring/Hibernate? … Frameworks are tools to be used, not architectures to be conformed to"
([cleancoder](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html)). The
domain boundary itself is Fowler/DDD's **Bounded Context** — "divides large models into distinct
sections … the primary factor determining these boundaries is human culture / Ubiquitous
Language" ([fowler](https://martinfowler.com/bliki/BoundedContext.html)). Practical consensus is
the **hybrid**: domain at the top (feature/module/slice), technical layer _inside_ each domain —
which is exactly FSD's slice→segment shape and NestJS's feature-module shape.

NestJS: "A feature module organizes code that is relevant to a specific feature, helping to
maintain clear boundaries." Encapsulation is enforced by the framework: "you can only inject
providers that are either part of the current module or explicitly exported from other imported
modules" — a module's public surface is its `exports`, and modules may "re-export modules that
they import" ([nestjs](https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/modules.md)).
This is a _runtime-enforced_ public API, unlike the frontend's lint-enforced barrels.

## 3. Feature-Sliced Design (FSD) — the layers

Seven layers, most-responsibility → least ([fsd layers](https://feature-sliced.design/docs/reference/layers)):

```
App        routing, entrypoints, global providers/styles   (segments only, no slices)
Processes  DEPRECATED — avoid
Pages      full screens / large route chunks
Widgets    self-sufficient UI blocks delivering a use case
Features   REUSED implementations of product actions (business value)
Entities   business domain concepts (user, product)
Shared     project-agnostic reusable code + external libs    (segments only, no slices)
```

Import rule (verbatim): _"A module (file) in a slice can only import other slices when they are
located on layers strictly below."_ Same-layer slices **cannot** import each other — the low-
coupling guarantee. Layers are optional: "most frontend projects minimally include Shared,
Pages, and App." **v2.1 "pages first"**: keep large blocks, forms, and data logic in the _page_
slice unless actually reused elsewhere — i.e., don't prematurely promote to Features/Widgets
([fsd slices](https://feature-sliced.design/docs/reference/slices-segments), [v2.1 discussion](https://github.com/feature-sliced/documentation/discussions/756)).

Segments (technical nature inside a slice): `ui` (components/formatters/styles), `model` (schemas,
stores, business logic), `api` (backend calls + data types), `lib` (slice-internal helpers),
`config`. Custom segments must "describe purpose, not essence — avoid `components` or `hooks`."
Public API: "Modules outside of this slice/segment can only reference the public API, not the
internal file structure" ([fsd slices](https://feature-sliced.design/docs/reference/slices-segments)).

> **Naming-semantics trap.** FSD "Features" = _reused_ actions across pages. A plan that calls its
> domain slices `features/<domain>/` (as TARGET-STRUCTURE does) is using the word loosely — those
> are domain **slices**, not the FSD Features layer. Fine as a convention, but don't claim FSD
> conformance on the layer taxonomy; the plan explicitly rejects the widgets/entities/features
> layer split (see §9 mapping).

## 4. colocation vs central lib dirs

Next.js is "**unopinionated** about how you organize and colocate your project files." Colocation
is safe by default: "a route is not publicly accessible until a `page.js` or `route.js` file is
added … project files can be safely colocated inside route segments without accidentally being
routable." Opt-outs: `_folder` (private, "opting the folder and all its subfolders out of
routing") and `(folder)` route groups (omitted from URL). Three named strategies, no
recommendation between them: (a) all code outside `app/`, (b) top-level folders inside `app/`,
(c) split by feature/route into the segments that use them. Official guidance: "choose a strategy
that works for you and your team and be consistent" ([next](https://nextjs.org/docs/app/getting-started/project-structure)).

FSD takes the opposite-of-central stance: colocate `ui`+`model`+`api` inside each slice, not in
global `components/`+`hooks/`+`lib/` trees. The two are compatible — FSD's `shared/` layer is the
principled home for the genuinely cross-cutting helpers a flat `lib/` would otherwise dump
together.

## 5. barrel files (index.ts) — the live disagreement

Do **not** average this; the sources openly disagree.

**Pro-barrel (public-API discipline).** FSD requires a public-API file per slice so external code
references the slice's API, not its internals ([fsd slices](https://feature-sliced.design/docs/reference/slices-segments)).
NestJS's `exports`/re-export is the same idea, runtime-enforced ([nestjs](https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/modules.md)).
Both lint enforcers (`import-x/no-restricted-paths` `except`, `eslint-plugin-boundaries`
`entry-point`) enforce imports going _through_ a designated public file — they **presume the
barrel exists**; lint does not remove the need for the file.

**Anti-barrel (performance).** Atlassian: "**75% faster builds by removing barrel files**"; the
pain was TS-server highlighting "upwards of 2 minutes," multi-minute local unit-test runs, and CI
running far more tests than necessary ([atlassian](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files)).
Independent write-ups add: bundlers (even Webpack 5 / Vite) struggle to tree-shake through a
barrel, so one named import can pull the whole barrel; test runners (Vitest/Jest) don't tree-
shake at all, so a barrel eagerly loads every re-export ([dev.to](https://dev.to/tassiofront/barrel-files-and-why-you-should-stop-using-them-now-bc4), [webpack discussion #16863](https://github.com/webpack/webpack/discussions/16863)).

**Honest reconciliation (context + granularity, NOT "lint instead of a barrel"):**

- **Server / NestJS:** no bundler tree-shaking exists for Nest DI, and a facade barrel re-exports
  ~2 symbols (module class + facade service). Atlassian's _bundle_ cost doesn't bite; its
  _TS-server / test-runner_ cost bites weakly. → small server facade barrels are fine.
- **Client / Next.js:** barrels genuinely cost. But Atlassian's disaster was an _app-wide mega-
  barrel re-exporting hundreds of modules_, not a small per-slice `index.ts`. A slice barrel of
  5–15 named exports is a different animal.
- **Mitigations:** keep each barrel minimal; prefer `export type` re-exports (erased at build);
  never build a repo-root or app-root mega-barrel. If a slice barrel ever grows large or hot in
  test paths, drop it and enforce the public API via deep-import lint zones instead.

## 6. naming conventions

Angular style guide (the canonical role-suffix source): "Separate words within a file name with
hyphens" (kebab-case); role/type suffix by extension (`.spec.ts`; component/template/style share
a base name); "Prefer focusing source files on a single concept … when in doubt, go with the
approach that leads to smaller files"; "File names should generally describe the contents" —
explicitly discouraging generic `helpers.ts`, `utils.ts`, `common.ts` ([angular](https://angular.dev/style-guide)).
NestJS convention extends the suffix idea to `.service.ts`, `.controller.ts`, `.module.ts`,
`.repository.ts`. FSD wants segment names to "describe purpose, not essence." Net: kebab-case +
role suffix + descriptive-not-generic is uncontested across sources.

## 7. test colocation

Next.js colocation covers this: non-routable files (including tests) sit safely beside the code
they test inside route segments ([next](https://nextjs.org/docs/app/getting-started/project-structure)).
Angular colocates the spec next to the unit (`x.ts` / `x.spec.ts`) ([angular](https://angular.dev/style-guide)).
FSD places tests inside the slice/segment they belong to (they are internal, not public API)
([fsd slices](https://feature-sliced.design/docs/reference/slices-segments)). No primary source
argues for a separate central `__tests__` tree at scale; colocation is the consensus.

## 8. import-boundary enforcement — options, capabilities, limits

All four are **lint/graph-level**: they fail CI, they are not a runtime sandbox.

| Tool                                       | Matches on                                                               | Public-API / entry-point                  | Allowlist                 | Cost / limits                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `import-x/no-restricted-paths`             | resolved **relative paths** (zones: `target`/`from`/`except`)            | via `except` = the one allowed file       | native per-zone `except`  | can't ban by package _name_; glob-vs-dir `except` rules ([import-x](https://github.com/un-ts/eslint-plugin-import-x/blob/master/docs/rules/no-restricted-paths.md)) |
| `@typescript-eslint/no-restricted-imports` | import **specifiers** (package names/patterns)                           | —                                         | no per-site allowlist     | can't express "module A must not reach B's _files_" ([eslint](https://eslint.org/docs/latest/rules/no-restricted-imports))                                          |
| **Turborepo Boundaries**                   | package **tags** (allow/deny, incl. transitive) + import-outside-package | tag rules (`public` can't use `internal`) | tag/deny lists            | **experimental**; package-granularity, not intra-package folders ([turbo](https://turborepo.dev/docs/reference/boundaries))                                         |
| Nx `enforce-module-boundaries`             | project **tags** + `depConstraints` (`onlyDependOnLibsWithTags`)         | project-level                             | tag matching (glob/regex) | needs Nx project graph; "projects without tags cannot depend on any project" ([nx](https://nx.dev/features/enforce-module-boundaries))                              |
| `eslint-plugin-boundaries`                 | declared **element types** (pattern→type)                                | `boundaries/entry-point` rule             | per-rule allow/disallow   | most expressive for intra-app layers; another dep + config ([plugin](https://github.com/javierbrea/eslint-plugin-boundaries))                                       |

Nx's **library-type taxonomy** is the canonical statement of typed dependency direction, even for
non-Nx repos: `feature` → any; `ui` → ui+util; `data-access` → data-access+util; `util` → util
only ([nx types](https://nx.dev/concepts/decisions/project-dependency-rules)). This is the mental
model to encode regardless of which linter enforces it.

**Two matchers, two jobs (the load-bearing distinction):** package-_name_ bans → `no-restricted-
imports`; relative-_path_ zones (module A can't reach into module B's files) → `import-x/no-
restricted-paths` or `eslint-plugin-boundaries`. One rule cannot do both.

## 9. monorepo pitfalls (named by primary sources)

- **God shared package.** Turborepo's `../`-leak warning and "install where needed" push toward
  fewer, purpose-scoped packages; a catch-all `shared` that every app dumps into re-creates the
  coupling packages were meant to break ([turbo](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)).
- **App-to-app value imports.** No source blesses runtime app↔app imports; a _type-only_ import
  (e.g. tRPC `AppRouter`) is the exception — a value import drags the server graph into the
  browser bundle.
- **Circular deps.** Prevented structurally by FSD's strict-downward rule and Nx's acyclic tag
  graph; barrels _increase_ cycle risk (a reason the anti-barrel camp cites) ([fsd layers](https://feature-sliced.design/docs/reference/layers)).
- **Nested packages.** Unsupported by Turborepo — never `package.json` inside `package.json`
  ([turbo](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)).

---

## How this maps to CustomReport

Read against `docs/architecture/TARGET-STRUCTURE-2026-07-02.md`. The plan is largely well-sourced;
below are the points where the research **confirms**, **refines**, or **contradicts** it.

**Confirms:**

- api = domain-first modular monolith (Screaming Architecture + NestJS feature modules). The
  per-module hexagon and "thin CRUD stays flat" right-sizing match FSD/NestJS "only add structure
  that pays off."
- Two-package cap with a one-way, acyclic, type-only app→app graph — matches Turborepo + Nx.
- kebab-case + role suffixes + no generic `utils.ts` — matches Angular canon.
- Web cross-slice import ban (`features/A ✗→ features/B`) — this is _exactly_ FSD's same-layer
  rule and is the single most valuable gate. Keep it.
- The two-matcher enforcement split (`no-restricted-imports` for package names, `import-x/no-
restricted-paths` for relative-path zones) is technically correct and primary-sourced.

**Refines (adjust the plan, don't reverse it):**

1. **Barrels are not free — the plan's blanket "`index.ts` barrel for every slice and every
   module" over-commits.** Server facade barrels (~2 exports) are fine. **Web slice barrels carry
   real TS-server/test/tree-shake cost** ([atlassian](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files)).
   Recommendation: keep web slice barrels _minimal + type-only where possible_; forbid any app-
   root/repo-root mega-barrel; treat "enforce public API via deep-import lint zone, no physical
   barrel" as the fallback if a slice barrel grows hot. (Note: lint does **not** eliminate the
   barrel by itself — `entry-point`/`except` presume the public file exists.)
2. **`features/` is a naming misnomer vs FSD.** These are domain **slices**, not the FSD Features
   layer. Harmless, but drop any implied claim of FSD-layer conformance; the plan already (rightly)
   rejects the widgets/entities/features taxonomy, so call them "slices" to avoid confusion.
3. **`shared/` god-package risk applies web-side too.** The plan's `src/shared/` (rule-of-2) is
   the right instinct, but it is exactly where a god-bucket forms. Keep it segmented
   (`shared/ui`, `shared/lib`, `shared/hooks`, `shared/server`) as planned and watch its growth.

**Contradicts / not-considered:** 4. **Turborepo Boundaries was rejected without evaluation.** The plan dismisses "boundaries/Nx-
tags machinery" and reaches for a new dependency (`eslint-plugin-import-x`). But Turborepo ships
a **native, zero-new-dependency Boundaries feature** with package tags and allow/deny (incl.
transitive) ([turbo](https://turborepo.dev/docs/reference/boundaries)). It is **experimental**
and **package-granular** (it cannot express intra-app module-A-can't-reach-module-B-files, which
the plan's zones 3/5 need), so it does **not** replace `import-x/no-restricted-paths` for the
relative-path zones — but for the _package-level_ zones 1/2/6 it is a native alternative worth a
line of consideration rather than silent rejection. Net: the plan's tool choice survives for the
intra-app zones; it should acknowledge Boundaries for the package-level zones. 5. **Migration order (period last) vs research "period first."** The plan deliberately inverts the
research's least-effort ordering to a blast-radius ordering (period is the atomic-write hotspot).
No primary source dictates ordering; the plan's risk-based inversion is sound — flagging only
that it is a _conscious_ contradiction of the effort-first heuristic, which is the correct call.

Nothing in the research invalidates the plan's core shape (domain-first hybrid, two packages,
lint-enforced acyclic graph, FSD-lite for web, per-module hexagon for api). The one substantive
change is **de-mandating universal barrels** (point 1); everything else is refinement or an
acknowledged trade-off.

---

## Sources

- Turborepo — Structuring a repository: https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository
- Turborepo — Boundaries (experimental): https://turborepo.dev/docs/reference/boundaries
- Next.js — Project structure & organization: https://nextjs.org/docs/app/getting-started/project-structure
- NestJS — Modules (raw): https://raw.githubusercontent.com/nestjs/docs.nestjs.com/master/content/modules.md
- Feature-Sliced Design — Layers: https://feature-sliced.design/docs/reference/layers
- Feature-Sliced Design — Slices & segments: https://feature-sliced.design/docs/reference/slices-segments
- FSD v2.1 "Pages first": https://github.com/feature-sliced/documentation/discussions/756
- Nx — Enforce module boundaries: https://nx.dev/features/enforce-module-boundaries
- Nx — Library types / project dependency rules: https://nx.dev/concepts/decisions/project-dependency-rules
- eslint-plugin-boundaries: https://github.com/javierbrea/eslint-plugin-boundaries
- eslint-plugin-import-x — no-restricted-paths: https://github.com/un-ts/eslint-plugin-import-x/blob/master/docs/rules/no-restricted-paths.md
- ESLint — no-restricted-imports: https://eslint.org/docs/latest/rules/no-restricted-imports
- Atlassian — 75% faster builds by removing barrel files: https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files
- "Barrel files and why you should stop": https://dev.to/tassiofront/barrel-files-and-why-you-should-stop-using-them-now-bc4
- Webpack discussion #16863 (barrels vs tree-shaking): https://github.com/webpack/webpack/discussions/16863
- Uncle Bob — Screaming Architecture: https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html
- Martin Fowler — Bounded Context: https://martinfowler.com/bliki/BoundedContext.html
- Angular — Style guide (naming): https://angular.dev/style-guide
