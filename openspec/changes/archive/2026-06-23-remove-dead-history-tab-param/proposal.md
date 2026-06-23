# Remove the dead `tab` query param from History nav links

## Why

The 2026-06-23 lead demo feedback asked to remove the dead `?tab` parameter.
The `lead-history-and-submit-label` change closed it on the redirect pages
(`/lead/history`, `/head/history` now 307 to `/reports` with no `tab`) and the
`reports/page.tsx` no longer reads `tab` at all — the existing
`lead-history-summary` spec already states the page "carries no tab state".

But the NavBar still emits the dead param: the History links point to
`/reports?tab=drafts` (lead) and `/reports?tab=published` (head, viewer). The
page ignores the param, so it is pure dead weight on every History link — the
exact thing the feedback wanted gone. This change finishes the cleanup at the
source.

## What Changes

- NavBar History links target `/reports` with no `tab` query parameter, for
  all three roles (lead, head, viewer).
- The `isActiveLink` / `NavIcon` branches keyed on the `/reports?tab=...`
  href strings switch to the bare `/reports` href; active-state behavior is
  unchanged (History highlights on `/reports` and published report paths).
- Tests update their expected hrefs from `/reports?tab=drafts` /
  `/reports?tab=published` to `/reports`; active-state assertions are preserved
  (a stray `?tab` in the address bar still highlights History — back-compat).

## Impact

- Affected spec: `lead-history-summary` (adds a nav-link requirement).
- Affected code: `apps/web/src/components/navigation/nav-bar.tsx` and its test.
- No behavior change for users beyond a cleaner History URL; the page already
  ignored `tab`.
