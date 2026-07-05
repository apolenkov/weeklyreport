## 1. CardSurface primitive

- [ ] 1.1 Create the shared card-surface idiom (a `CardSurface` wrapper or a
      Tailwind component class) next to `packages/ui` `card.tsx`, encapsulating the
      border + white-gradient + layered-shadow + hover-shadow chrome
- [ ] 1.2 Replace the inline mega-literal in `accordion-section.tsx:65` and each
      other copy site (product-accordion, portfolio-overview-table,
      lead-summary-table, blocked-at-risk-table, weekly-report-skeleton ×2,
      lead-form-skeleton, lead-history-skeleton, lead-history-list) with the idiom
- [ ] 1.3 Expose a closed tone/variant surface for the callers that currently
      inject `titleColor`/`badgeStyle`, not an open style hole
- [ ] 1.4 Add or move a source-scan guard rejecting a reintroduced inline copy;
      verify render parity for each consumer

## 2. RotatingChevron

- [ ] 2.1 Create one shared `RotatingChevron` wrapping `lucide-react`'s
      `ChevronDown` with the rotate transition and single `aria-hidden`
- [ ] 2.2 Replace and delete the three hand-rolled _rotating_ copies (all `h-4 w-4`
      with an `expanded` prop): `report-shell/accordion-section.tsx:5`,
      `weekly-report/product-accordion.tsx:173`,
      `dashboard/blocked-at-risk-table.tsx:32`
- [ ] 2.3 Separately, delete the _static_ local `ChevronDown` in
      `lead/fill-from-button.tsx:61` and render `lucide-react`'s `ChevronDown`
      directly at `h-3 w-3` — do NOT route it through `RotatingChevron` (no
      rotation, no size change); verify the split-button glyph renders unchanged
- [ ] 2.4 Update the report-shell chevron a11y tests to target the shared component

## 3. Short date/timestamp home

- [ ] 3.1 Export `MONTHS_SHORT` and add `formatTimestampShort` in
      `apps/web/src/lib/format-date.ts`
- [ ] 3.2 Replace the local month arrays / timestamp logic in
      `components/admin/reminders-tab-format.ts:153`,
      `lib/mappers/lead-form.ts:227`, `lib/mappers/lead-history.ts:58` with the
      shared exports
- [ ] 3.3 Confirm no private short-month array remains outside `format-date.ts`;
      run the affected unit tests

## 4. Single ROLE_LABEL

- [ ] 4.1 Add one exhaustively-typed `ROLE_LABEL` map (keyed on the role enum) next
      to `roleSchema` in `packages/shared/src/schemas/auth.ts`, and export it from
      the package entry (NOT `auth/index.ts`, which re-exports only `saml-profile`)
- [ ] 4.2 Consume it in `app/login-page-roles.ts`, `components/dev/role-switcher.tsx`
      (dropping "Department Head"), and the inline derivation at
      `lib/mappers/lead-form.ts:915`
- [ ] 4.3 Set the canonical head label to `Head` (the value 2 of 3 sources already
      render — `login-page-roles.ts` + `lead-form.ts`; only the role-switcher
      drifted) and verify all three sources render it

## 5. Single role→route map (viewer bug fix)

- [ ] 5.0 Record the viewer-target decision in design (done): `/reports/latest`,
      citing `lib/role-home.ts`'s own comment + the `viewer-live-status` decision
      ("the Status target — not the History list — is the viewer's landing page").
      No fresh owner confirmation needed — 2 of the 3 existing maps already ship it
- [ ] 5.1 Add one role→route landing map next to `roleSchema` in
      `packages/shared/src/schemas/auth.ts` with viewer target `/reports/latest`;
      exhaustively typed on the role enum, NO runtime fallback at the shared home;
      export from the package entry
- [ ] 5.2 Replace api `DEV_LOGIN_REDIRECT_BY_ROLE` (`dev-login.routes.ts:45`) with
      the shared map — passed as the `fallbackPath` arg to
      `resolveDevLoginRedirectUrl`; leave `safeRedirectPath` precedence/ordering
      untouched (the map is the post-sanitizer fallback, not the redirect itself)
- [ ] 5.3 Replace web `DEFAULT_FOR_ROLE` (`login-page-roles.ts:10`) with the shared
      map; land 5.2 + 5.3 together so the tiers never briefly disagree. Keep the
      `defaultRedirectFor` `?? FALLBACK_REDIRECT` guard at the web call site for
      non-`Role` runtime values (documented) — do NOT copy it into the shared map
- [ ] 5.4 Reroute `roleHomePath` (`lib/role-home.ts`) to return the shared map's
      value (thin re-export) so the brand-link / role-gate home cannot diverge;
      update its stale viewer-target comment if needed
- [ ] 5.5 Remove the now-stale "must stay in sync" comments from all former sites
- [ ] 5.6 Live-verify: viewer dev-login lands on `/reports/latest` and the redirect
      resolves to a readable report (or the resolver's empty state), not a 404

## 6. useReportShellUrlState hook

- [ ] 6.1 Extract `useReportShellUrlState` owning the search-params reader, the
      `URLSearchParams` setter, and the archive/scope derivations; give it a
      `stripParams` argument whose members the setter deletes on EVERY call
- [ ] 6.2 Consume it in `head-report-shell.tsx` (`stripParams = []`) and
      `viewer-report-shell.tsx` (`stripParams = ["source", "recovery"]`), deleting
      the duplicated blocks; the viewer's one-shot-marker strip is realised through
      the strip-list, NOT by re-forking the setter into the head shell
- [ ] 6.3 Run the head + viewer shell tests; confirm archive-toggle and scope
      behaviour is unchanged on both

## 7. Validation

- [ ] 7.1 `openspec validate web-shared-idioms --strict` prints "is valid"
- [ ] 7.2 Full web unit suite green; api auth tests green
