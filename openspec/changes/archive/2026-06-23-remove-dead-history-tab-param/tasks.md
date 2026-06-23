# Tasks — remove the dead `tab` nav param

## 1. NavBar links

- [x] 1.1 In `apps/web/src/components/navigation/nav-bar.tsx`, change the three
      History `NAV_LINKS` hrefs from `/reports?tab=drafts` (lead) and
      `/reports?tab=published` (head, viewer) to `/reports`.
- [x] 1.2 Update the `isActiveLink` branch keyed on `href.startsWith("/reports?")`
      to key on the bare `/reports` href; preserve the active-state behavior
      (active on `/reports` and `isPublishedReportPath`).
- [x] 1.3 Update the `NavIcon` switch cases `/reports?tab=drafts` /
      `/reports?tab=published` to the bare `/reports` href (Clock icon).
- [x] 1.4 Update the stale `?tab` comments to describe the bare `/reports` link.

## 2. Tests

- [x] 2.1 In `apps/web/src/components/navigation/nav-bar.test.tsx`, change the
      expected History hrefs from `/reports?tab=drafts` /
      `/reports?tab=published` to `/reports` (link-presence assertions).
- [x] 2.2 Keep the active-state assertions: History highlights on `/reports`
      and on a stray `?tab` URL, and stays inactive on unrelated routes.

## 3. Gates

- [x] 3.1 `pnpm typecheck && pnpm lint && pnpm test && openspec validate
  remove-dead-history-tab-param --strict` — all green.
- [x] 3.2 Live-verify on `:3000`: the History nav link href is `/reports`
      (no `?tab`) for lead and head; clicking it lands on `/reports`.
