## Why

Six web-layer duplications were flagged by the report-shell audit pilot
(`docs/audit/report-shell-pilot-2026-07-02.md`) and the dedup roadmap but left
homeless when their originating changes archived. Each is a cross-file visual or
behavioural contract carried as copy-pasted source, so a single conceptual edit
becomes N synchronised edits — and one copy has already silently drifted into a
**live bug**: the viewer's post-login landing route diverges between the api and
web maps (`/reports?tab=published` vs `/reports/latest`). Homing each idiom once
removes the drift surface and closes the bug.

## What Changes

- **CardSurface primitive** — extract the border + white-gradient + layered-shadow
  - hover-shadow mega-literal (duplicated verbatim across ~10 files) into one
    shared surface idiom; every copy consumes it.
- **RotatingChevron** — replace the three hand-rolled rotating-`ChevronDown` SVGs
  (accordion-section, product-accordion, blocked-at-risk-table) with one shared
  component wrapping `lucide-react`'s `ChevronDown` (already imported by sibling
  files). The static `h-3 w-3` split-button glyph in `fill-from-button.tsx` is
  excluded — it does not rotate; it consumes lucide's `ChevronDown` directly at
  its own size instead of the rotating idiom.
- **Single date-format home** — add `formatTimestampShort` and export
  `MONTHS_SHORT` from `apps/web/src/lib/format-date.ts`; the three external local
  month/timestamp formatter copies consume them.
- **Single `ROLE_LABEL`** — one role→label map in `packages/shared`; the three
  drifted sources (one already shows "Department Head" vs "Head") consume it.
- **Single role→route map** — one map in `packages/shared` backs all three
  existing per-role landing surfaces: api `DEV_LOGIN_REDIRECT_BY_ROLE`, web
  `DEFAULT_FOR_ROLE`, and web `roleHomePath` (`lib/role-home.ts`, the brand-link /
  role-gate home). This **fixes the live viewer-landing divergence**, converging
  on `/reports/latest`. Map is exhaustively typed with no runtime fallback;
  unknown-role handling stays at the web call site.
- **`useReportShellUrlState` hook** — extract the identical shell URL-state logic
  duplicated between the head and viewer report shells.

## Capabilities

### New Capabilities

- `web-shared-idioms`: The set of shared extraction contracts for the web layer —
  each duplicated visual or behavioural idiom (card surface, rotating chevron,
  short date/timestamp formatting, role label, role→route map, report-shell
  URL-state) MUST have exactly one canonical home, and every former copy MUST
  consume it. Includes the requirement that the role→route map has a single
  cross-tier home with one non-divergent viewer target.

### Modified Capabilities

<!-- None. The viewer route value is grounded in the existing
     viewer-report-navigation spec (read, not modified); this change adds the
     single-home requirement rather than altering that spec's behaviour. -->

## Impact

- **Web**: `apps/web/src/lib/format-date.ts` (new export + fn),
  `apps/web/src/app/login-page-roles.ts` (`DEFAULT_FOR_ROLE`, `ROLE_LABEL`),
  `apps/web/src/lib/role-home.ts` (`roleHomePath` → thin re-export of shared map),
  report-shell / weekly-report / dashboard / lead components (CardSurface +
  chevron consumers), `head-report-shell.tsx` + `viewer-report-shell.tsx`
  (URL-state hook), the four label/formatter copy sites.
- **API**: `apps/api/src/modules/auth/dev-login.routes.ts`
  (`DEV_LOGIN_REDIRECT_BY_ROLE` → shared map, as the post-sanitizer fallback arg)
  — **the viewer value changes**.
- **Shared**: `packages/shared/src/schemas/auth.ts` (next to `roleSchema`) gains
  the `ROLE_LABEL` and role→route maps consumed by both tiers.
- **No product behaviour change** except the corrected viewer landing route.
  Extraction otherwise preserves rendered output; existing source-scan / route
  tests move to the new homes.
