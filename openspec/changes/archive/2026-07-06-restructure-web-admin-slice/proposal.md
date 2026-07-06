## Why

The parent change `restructure-directory-architecture` locked the target web
structure (`app/` routing + `features/<domain>/` slices + `shared/`) and its
machine-enforced import boundaries, then proved the mechanic end-to-end with the
`landing` pilot slice. Task 3.1 of that change mandates that **each remaining web
domain lands its own OpenSpec change**; `analytics`, the shared `navigation`
chrome, `dashboard`, and the shared `report-shell` primitives already did. Task
3.1 further names the two grab-bag legacy folders that do **not** collapse to a
single slice — `lead/ (→ report-sections + period + review)` and `admin/`. This
child slice dissolves the `admin/` folder.

Unlike the four landed siblings — each a single legacy `components/` subfolder
that mapped to ONE destination — `apps/web/src/components/admin/` is a grab-bag.
Its 45 source files carry five different canonical domains: the admin console
proper (users/groups/products/jobs/reminders/action-log/settings shell), the
period-lifecycle editor (`periods-*`, `settings-periods-*`, `use-period-mutations`),
the reopen-request review surface (`reopen-*`), the organization settings sub-tabs
(`settings-identity/integrations/notifications`), and three business-agnostic
primitives shared across ≥2 slices. The per-file placement is researched and fixed
in `docs/architecture/mapping/web-comp-admin-2026-07-02.md` (source catalogs
`docs/architecture/catalog/web-comp-admin-part1-2026-07-02.md` +
`part2-2026-07-02.md`), with `TARGET-STRUCTURE-2026-07-02.md` as the tie-breaker.
This change dissolves the folder into those five homes per the mapping's `Layer`
and canonical-`Domain` columns; it does not re-derive placement.

**Count reconciliation.** The two source catalogs' headers claim `29 + 18 = 47`
files, but their tables enumerate `28 + 17 = 45` rows — a header overcount of 2;
the mapping table lists exactly those **45 source files**. Reconciled against the
current folder (2026-07-06): the 45 source files are byte-for-byte the same set
(`diff` = identical), none added or removed since 2026-07-02. The catalog was
source-scoped and omitted tests; the folder additionally holds **10 co-located
`*.test.tsx`** (`group-products-editor`, `groups-tab`, `jobs-tab-label`,
`jobs-tab`, `periods-tab`, `product-group-chips`, `products-tab`, `reminders-tab`,
`settings-tab`, `users-tab`) — all authored on or before 2026-07-02, so none is a
post-catalog addition. Per the `dashboard`/`report-shell` precedent each test
travels co-located with its source file (9 → `features/admin/ui/`, 1 `periods-tab`
→ `features/period/ui/`). **Total relocations: 45 source + 10 tests = 55.** One
further internal note: the mapping's summary splits the 45 as `admin (26) /
period (10)`, but its own Target column resolves to `admin (25) / period (11)` —
an off-by-one in the summary's split only; the 45 total and every other domain
count (review 3, organization 3, shared 3) hold. This proposal uses the
Target-column figures.

## What Changes

- **Dissolve `apps/web/src/components/admin/` into its five canonical homes** per
  the mapping's Target column (filenames unchanged; the legacy folder MUST NOT
  survive):
  - `features/admin/ui/` (20) + `features/admin/model/` (5 pure utils/hooks/config:
    `action-log-format`, `reminders-form-state`, `reminders-tab-format`,
    `reminders-tab-mutations`, `timezone-options`).
  - `features/period/ui/` (10 `periods-*` / `settings-periods-*`) +
    `features/period/model/` (1: `use-period-mutations`).
  - `features/review/ui/` (3 `reopen-*`).
  - `features/organization/ui/` (3 `settings-identity/integrations/notifications`).
  - The catalog `Domain` labels `reminders` / `products` / `reopen` collapse to
    the canonical `admin` / `admin` / `review` vocabulary; the six `periods-*` /
    `use-period-mutations` files the catalog tagged `admin` group under canonical
    `period` (period-lifecycle-only, coupled to period-tagged siblings) — exactly
    as the mapping's Notes column records.
- **Graduate the three ≥2-slice primitives out of the slice tree** (rule-of-2 (web);
  `shared/` is not a feature slice, so no `webSlices` entry and no barrel):
  - `settings-tab-shared.tsx` → `shared/ui/settings-tab-shared.tsx` (hook + icon,
    consumed by admin + period + organization sub-tabs).
  - `tab-count-pill.tsx` → `shared/ui/tab-count-pill.tsx` (consumed by
    `jobs-tab-label` (admin) + `reopen-tab-label` (review) — a
    `features/review → features/admin` import would violate the cross-slice zone).
  - `mock-data.ts` → `shared/lib/admin-mock-data.ts` (types/consts consumed by
    admin + period + organization sub-tabs; **renamed** to avoid colliding with the
    already-graduated `shared/lib/dashboard-mock-data.ts`).
- **Register NO slice this change** (amended during implementation: the cross-slice
  zone keys on the IMPORTER, so registering `admin` while its composition roots
  `admin-panel.tsx`/`settings-tab.tsx` still import `period`/`review`/`organization`
  internals trips six zone errors — proven by a temp-append probe, then reverted;
  `admin` registers together with the other three when the completing change
  relocates those cross-slice imports behind sibling barrels). Still add the
  `features/admin/index.ts` barrel exporting exactly the symbols its routes load,
  and reroute `app/(app)/admin/page.tsx` and `app/(app)/admin/products/page.tsx`
  off the legacy internal paths to the barrel.
- **Seed but do NOT register `period` / `review` / `organization`.** Their `ui/`
  (and `period/model/`) segments are created and populated by this change, but each
  is only _partially_ built here — `period` and `review` are completed and
  boundary-registered by the paired `lead/` change (parent task 3.1:
  `lead/ (→ report-sections + period + review)`), and `organization`'s remaining
  consolidation rides with them. Registering a half-built slice's zone now would
  enforce a boundary the domain does not yet fully own. Consequently the admin
  composition roots `admin-panel.tsx` and `settings-tab.tsx` keep importing the
  period/review/organization sub-tabs by **direct recomputed-relative path**
  (grandfathered — no zone governs an unregistered slice), and those imports are
  converted to sibling-barrel imports when those slices register in their completing
  change. This is precisely the mapping's "resolve in migration slice 3" deferral.
- **Recompute every moved file's cross-directory imports** from its new location
  (the slice tree sits one level deeper and under a different top segment than the
  legacy `components/admin/` tree). Intra-folder `./`-relative imports between files
  that land in the SAME target segment stay valid unchanged; imports that now cross
  a segment boundary (e.g. a moved file → `../../../components/ui/*`,
  `../../../lib/mappers`, `../../../hooks/*`, or a graduated `shared/*` primitive)
  are recomputed, not blindly prefixed.
- **Repoint the six admin `eslint.config.ts` exemptions** to the moved paths:
  `mock-data.ts` (max-lines + `sonarjs/no-duplicate-string`) → `shared/lib/admin-mock-data.ts`;
  `users-tab.tsx`, `groups-tab.tsx`, `products-tab.tsx` (max-lines) →
  `features/admin/ui/*`; `admin-panel.tsx` (complexity) →
  `features/admin/ui/admin-panel.tsx`.
- **Behavior-neutral**: no component logic, props, or rendered output changes; this
  is a pure relocation + import reroute.

## Non-goals

- No component logic, styling, or contract change — pure relocation.
- **No premature registration of `period` / `review` / `organization`.** They are
  seeded here and registered by their completing change; enforcing their zones
  against a half-built slice is out of scope and would surface false cross-slice
  violations from the admin composition roots.
- **No `app/` composition move.** Parent task 3.1 requires every move to stay OUT
  of `app/`; the composition roots `admin-panel` / `settings-tab` remain in
  `features/admin/ui/` and cross to sibling slices via barrels (on registration),
  not by hoisting them into a route.
- No graduation of `tab-header.tsx` — the mapping keeps it in `features/admin/ui`
  claiming "no second-slice consumer", but review found period/periods-tab and
  review/reopen-tab also import it (3 slice consumers — strictly more reach than
  the graduated `tab-count-pill`). Left in place this change (unenforced,
  behavior-neutral); the completing change graduates it to `shared/ui/` or exposes
  it via the admin barrel when the slices register.
- No fixture/type split of `mock-data.ts` — it graduates whole to
  `shared/lib/admin-mock-data.ts`; splitting legacy fixtures from live types is a
  deferred follow-up, exactly as `dashboard` deferred its own mock-data split.
- No re-home of `use-period-mutations.ts` beyond its mapped `features/period/model/`
  target; no relocation of the `components/ui/*` / `lib/*` / `hooks/*` helpers the
  admin files depend on — those keep their current homes this pass.
- No change to the boundary-zone mechanism itself (owned by the parent change);
  this slice leaves the `webSlices` list untouched (registration deferred, above).

## Impact

- Affected code: `apps/web/src/features/{admin,period,review,organization}/**`
  (new) and `apps/web/src/shared/{ui,lib}/*` (three graduated primitives), the
  deleted `apps/web/src/components/admin/` tree, the two `app/(app)/admin/*` routes
  (barrel reroute), every recomputed cross-directory import among the moved files
  and their consumers, and `eslint.config.ts` (six repointed exemption paths;
  `webSlices` untouched — registration deferred).
- Parent: `restructure-directory-architecture` task 3.1 — this change is that
  task's fifth web child slice (after `analytics`, `navigation`, `dashboard`,
  `report-shell`) and the first grab-bag folder to dissolve into multiple
  canonical homes. Mapping: `docs/architecture/mapping/web-comp-admin-2026-07-02.md`.
- No load-bearing invariant touched: the period dual-state write lives in the API
  layer; this pass only relocates the web period-lifecycle UI, rewiring no tRPC
  middleware chain and no write path.
