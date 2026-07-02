## Why

`apps/web/src/app/layout.tsx` inlines the organization identity into a
`<script id="__org_data" type="application/json">` via
`dangerouslySetInnerHTML={{ __html: JSON.stringify(orgPublic) }}`. `JSON.stringify`
does not escape `<` or `/`, so an admin-editable `fullName`/`shortName` containing
`</script><img onerror=...>` breaks out of the script element and executes for every
visitor — including the anonymous landing page. The `type="application/json"`
attribute does not prevent the breakout. This is the P0-8 finding
(`BL-XSS-ORG-INJECTION` / `AR-2`) from the 2026-06-28 repo-excellence review.

## What Changes

- Remove the dead inline `<script id="__org_data">` org-identity sink from
  `layout.tsx`: a grep confirms no production code reads it, and the landing page
  already receives org identity via the server-rendered RSC prop path
  (`page.tsx` → `login-page.client.tsx` `initialData`). Deleting the sink removes
  the breakout class entirely. (Any future inline script that must embed
  server data has to encode the breakout-class characters to `\uXXXX` escapes —
  the durable invariant carried in the spec.)
- Add defence-in-depth charset validation to the org identity write schema in
  `@customreport/shared` so admin-supplied `shortName`/`fullName` reject
  HTML-dangerous characters at the write boundary.
- Add tests proving a malicious org string is neutralised at both layers
  (the layout no longer emits an injectable script, and the write-schema
  validator rejects the dangerous value).

## Capabilities

### New Capabilities

- `inline-data-script-safety`: server data embedded into inline HTML
  `<script>` tags is encoded so attacker-controlled strings cannot terminate
  the script element or inject markup — and the dead `__org_data` sink that
  carries org strings today is removed rather than hardened; org identity strings
  are charset-validated at the write schema boundary as defence in depth.

### Modified Capabilities

<!-- None: no existing capability governs output-encoding or injection safety. -->

## Impact

- `apps/web/src/app/layout.tsx` — remove the dead inline `<script id="__org_data">`
  and the now-unused `orgPublic` fetch in `RootLayout`.
- `apps/web/src/app/layout.test.tsx` — drop the presence/round-trip assertions;
  assert the script is gone and the brand still renders, including under a
  breakout-attempt `fullName`.
- `packages/shared/src/schemas/organization.ts` — charset constraint on
  `shortName`/`fullName` at the admin write boundary (`organizationUpdateSchema`
  only). The read/projection schemas (`organizationSchema`,
  `organizationPublicSchema`) parse DB output and stay unconstrained to avoid
  throwing on stored data.
- Blast radius is every page including the anonymous landing page; the write
  surface is admin-only (privileged stored XSS). Standard, low-risk fix; no
  data migration needed.

## Non-goals

- A site-wide Content-Security-Policy is out of scope (tracked separately).
- The `getOrgPublic` fetch/caching path is unchanged.
- No other inline-script injection sites are introduced by this change.
