## Context

The report-shell audit pilot (`docs/audit/report-shell-pilot-2026-07-02.md`) and
the dedup roadmap flagged a set of web-layer duplications. Their originating
changes archived without homing them, so the copies persist and one has drifted
into a live bug. Current evidence (paths verified against HEAD on 2026-07-05;
see the sequencing note under Decisions — the `report-shell/` slice has **not**
yet moved, so re-verify any path at implementation time if
`restructure-directory-architecture` lands first):

- **CardSurface**: the mega-literal lives at
  `apps/web/src/components/report-shell/accordion-section.tsx:65` and is duplicated
  across ~10 files (product-accordion, portfolio-overview-table, lead-summary-table,
  blocked-at-risk-table, the skeletons, lead-history-list).
- **RotatingChevron**: three hand-rolled _rotating_ `ChevronDown` SVGs —
  `report-shell/accordion-section.tsx:5`, `weekly-report/product-accordion.tsx:173`,
  `dashboard/blocked-at-risk-table.tsx:32` — each `h-4 w-4` with an `expanded` prop
  driving `transition-transform` + `rotate(-90deg → 0deg)`. `lucide-react` (which
  exports `ChevronDown`) is already imported by siblings.
  `lead/fill-from-button.tsx:61` is **excluded**: its `ChevronDown` is a _static_
  split-button dropdown glyph — `h-3 w-3`, no `expanded` prop, no transition, no
  rotation. Homing it through the rotating idiom would change its rendered size
  (h-3 → h-4) and add rotation it must not have, violating the behaviour-preserving
  Non-Goal. It consumes `lucide-react`'s `ChevronDown` directly at `h-3 w-3`
  instead (killing the local SVG without changing render), which is a size/tone
  cleanup, not part of the rotating-chevron idiom.
- **Date format**: `format-date.ts` already owns a _private_ `MONTHS_SHORT` and has
  no `formatTimestampShort`; three external files redeclare a month array —
  `components/admin/reminders-tab-format.ts:153`, `lib/mappers/lead-form.ts:227`,
  `lib/mappers/lead-history.ts:58`. Count = 3 external + format-date's own = 4.
- **ROLE_LABEL**: `app/login-page-roles.ts` maps `head: "Head"`;
  `components/dev/role-switcher.tsx:22` maps `head: "Department Head"` (drift);
  `lib/mappers/lead-form.ts:915` derives `"Head"` inline from the role token.
- **Role→route**: THREE role→landing maps, not two.
  1. `apps/api/.../dev-login.routes.ts:45` `DEV_LOGIN_REDIRECT_BY_ROLE`
     (viewer → `/reports?tab=published`).
  2. `app/login-page-roles.ts:10` `DEFAULT_FOR_ROLE` (viewer → `/reports/latest`).
  3. `lib/role-home.ts` `roleHomePath(role)` — a `switch`, self-described
     "single source of truth" for "where does role X land after login / when the
     brand mark is clicked / when redirected from `/`", consumed by
     `components/navigation/nav-bar.tsx:162` (`getLogoHref`) and
     `components/role-gate.tsx:38`. Viewer → `/reports/latest`.
     (1) is **divergent for viewer** (`/reports?tab=published` vs `/reports/latest`);
     (2) and (3) already agree on `/reports/latest`. (1) and (2) carry sync-me
     comments referencing each other; the sync is unenforced and broke. All three
     are the same concept — the canonical per-role post-login landing — so the shared
     map must back all three, not just (1) and (2), or `roleHomePath` remains a live
     divergence surface for any future viewer-target edit.
- **Shell URL-state**: `head-report-shell.tsx` and `viewer-report-shell.tsx` share
  an identical block (lines ~60–85): `useRouter` + `useSearchParams`, a
  `new URLSearchParams(searchParams.toString())` setter, `archive === "1"`, and the
  `scope === "lead" ? "lead" : "product"` derivation. The viewer adds `source` /
  `recovery` on top.

## Goals / Non-Goals

**Goals:**

- Give each of the six idioms exactly one canonical home and route every former
  copy through it.
- Fix the viewer-landing route divergence as part of homing the role→route map.
- Preserve rendered output and existing test intent; move source-scan guards to
  the new homes.

**Non-Goals:**

- No visual redesign of any surface (extraction is behaviour-preserving).
- No change to head/lead/admin landing routes (only viewer converges).
- No change to the `viewer-report-navigation` read-gate or resolver behaviour;
  this change only consumes its already-decided canonical entry.
- Not addressing the other audit findings (effect-to-state, inert, size splits) —
  those are separate changes.

## Decisions

**One capability, six requirements.** All six are the same shape — "one home,
consume everywhere" — so a single `web-shared-idioms` capability with a
per-idiom requirement is coherent and avoids six near-empty spec folders. All
deltas are `## ADDED` to avoid MODIFIED-header collisions with in-flight changes
(restructure-directory-architecture, unify-status-presentation, etc.).

**Sequencing vs `restructure-directory-architecture`.** That change (0/6, not yet
implemented) plans to move `report-shell/` under `src/shared/` and dissolve
`lib/mappers/` — every hard-coded path and line ref here would then break. Land
`web-shared-idioms` **before** the restructure moves the web slice; if the
restructure lands first, re-verify each path/line at implementation time (the
symbols move, they do not disappear). The evidence paths above are HEAD as of
2026-07-05, where `report-shell/`, `lib/mappers/`, and `lib/role-home.ts` still
live at the cited locations.

**Shared homes.** `ROLE_LABEL` and the role→route map go next to `roleSchema` in
`packages/shared/src/schemas/auth.ts` (the actual home of the role enum —
`packages/shared/src/auth/index.ts` re-exports only `saml-profile`, NOT the role
enum), so both api and web consume one typed source keyed on the role enum. If a
dedicated constants module is preferred over co-locating data with schemas, it
MUST import the enum from `schemas/auth.ts` and be re-exported from the package
entry; it must not re-declare the role union. CardSurface and RotatingChevron are
web/UI primitives; the date exports extend the existing `format-date.ts`; the
URL-state hook is web-only.

**Role→route map backs all three web/api landing surfaces.** The one shared map
becomes the source for `DEV_LOGIN_REDIRECT_BY_ROLE` (api fallback arg),
`DEFAULT_FOR_ROLE` (web login), AND `roleHomePath` (web brand-link / role-gate /
`/`-redirect). `roleHomePath` stays a function for its call sites but its body
returns `SHARED_MAP[role]` (a thin re-export), so the three cannot diverge.

**Shared map is exhaustively typed, no runtime fallback.** The map is
`Record<Role, string>` keyed on the role enum — adding a role is a compile error
until an entry exists, so no `?? FALLBACK` belongs at the shared home (that would
re-hide whether the value is mandatory, violating the no-silent-fallback rule).
The existing web `defaultRedirectFor`'s `?? FALLBACK_REDIRECT` guard for
persisted/retired runtime roles stays at the web call site — it handles a value
that is not a valid `Role` at all, which is a web concern, not a gap in the map.

**Dev-login map is the post-sanitizer fallback, not the redirect itself.** In
`resolveDevLoginRedirectUrl` (dev-login.routes.ts:95-101) the role→route value is
passed as `fallbackPath` and used only when `safeRedirectPath(candidate, …)`
returns null — i.e. when the user-supplied `redirect` param is absent or fails
the open-redirect check. Web `devLoginHref` always passes an explicit `redirect`,
so the map is the effective target only for a param-less dev-login (e.g. the dev
`role-switcher`). The shared map replaces only the `fallbackPath` argument;
`safeRedirectPath` precedence and ordering are unchanged.

**Viewer route value = `/reports/latest`.** Two-step grounding, stated explicitly
because the maps being unified are _post-login landing_ maps, not the nav entry:

1. `viewer-report-navigation` grounds `/reports/latest` as the viewer's **primary
   (Status) navigation entry** — "a stable server-resolved target (the
   `/reports/latest` redirect), never a hard-coded report id."
2. `/reports?tab=published` is the reports **list** surface filtered to the
   published tab — not a report, and not governed by `report-routing` (which
   covers `/…/report/[reportId]` pages). So it is not spec-forbidden the way a
   query-param report _identity_ would be; it is simply the wrong target for "take
   the viewer to their report."
3. Post-login landing coheres to the primary nav entry, so the unified target is
   `/reports/latest`. The api `/reports?tab=published` value is the divergent,
   stale copy — the bug.

Alternative considered: keep both values and only dedup the label map. Rejected —
the divergence _is_ the bug the brief calls out; homing the map without converging
the value would leave it live.

## Risks / Trade-offs

- **Extraction changes rendered output** → each consumer keeps its existing render
  test; add before/after snapshot parity where a source-scan guard is retired.
- **CardSurface tone injection** → some callers inject ad-hoc tokens
  (`titleColor`, `badgeStyle`). The idiom must expose a closed variant surface, not
  an open style hole; out-of-scope tone cleanups stay with those callers.
- **Viewer value flips for real users** → the corrected route sends viewers to
  `/reports/latest`; verify the redirect resolves to a readable report (the
  `viewer-report-navigation` resolver already handles empty/fallback), not a 404.
- **Cross-tier shared import** → adding web-facing constants to `packages/shared`
  must not pull web-only deps into the shared build; keep the maps pure data.

**Shell URL-state hook takes a strip-list, not a viewer fork.** The head and
viewer blocks are NOT identical: the viewer's `buildQuery`
(`components/viewer/viewer-report-shell.tsx:63-83`) deletes `source` and
`recovery` from the params **inside the setter, on every in-shell navigation** —
a load-bearing one-shot-marker strip (its comment: these markers live only on the
entry redirect; carrying them forward re-triggers the Status-bounce recovery
loop). So `useReportShellUrlState` MUST accept a `stripParams` list that the
setter deletes on **every** call; the head passes `[]`, the viewer passes
`["source", "recovery"]`. "Viewer concerns layer on top" is realised as this
argument, not as an override that could skip the strip and reintroduce the bug.

## Migration Plan

Per-idiom, each independently shippable: (1) create the shared home; (2) point
every copy at it; (3) delete the copies; (4) move/retire the source-scan guard to
the new home; (5) run the web unit suite + a live viewer-login check for (e).
Order is free except (e), which must land the shared map and both consumers in one
step so the two tiers never briefly disagree. Rollback = revert the per-idiom
commit; no data migration.

## Resolved Decisions

- **Viewer post-login landing = `/reports/latest` (owner decision already on
  record in code, not open).** The earlier draft flagged this as a pending owner
  question. It is not: `lib/role-home.ts` — the self-described "single source of
  truth" for per-role landing — already lands the viewer on `/reports/latest`, and
  its own comment records the rationale citing the **viewer-live-status** decision:
  "viewer-live-status made the viewer a status observer, so the Status target —
  not the History list — is the viewer's landing page." Two of the three existing
  maps (`DEFAULT_FOR_ROLE`, `roleHomePath`) already encode `/reports/latest`; only
  the api dev-login copy still carries the stale `/reports?tab=published`. So
  `/reports/latest` is the owner-decided value the other two maps already ship, and
  this change converges the api copy onto it — no fresh owner confirmation needed.

- **Canonical head label = `Head`.** Two of the three sources already render
  `Head` (`login-page-roles.ts` `ROLE_LABEL`, `lib/mappers/lead-form.ts:915`);
  only the dev `role-switcher` drifted to `Department Head`. The shared
  `ROLE_LABEL` fixes `head → "Head"` and the role-switcher converges onto it.
