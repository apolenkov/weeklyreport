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

- Encode the org payload so it can never break out of the inline `<script>`:
  escape `<`, `>`, `/`, and the line/paragraph separators (or adopt a hardened
  serializer), OR remove the inline-script path in favour of passing the org
  identity as a prop / data attribute.
- Add defence-in-depth charset validation to the org identity Zod schemas in
  `@customreport/shared` so admin-supplied `shortName`/`fullName` reject
  HTML-dangerous characters at the write boundary.
- Add tests proving a malicious org string is neutralised at both layers
  (the inline-script encoder and the schema validator).

## Capabilities

### New Capabilities

- `inline-data-script-safety`: server data embedded into inline HTML
  `<script>` tags is encoded so attacker-controlled strings cannot terminate
  the script element or inject markup; org identity strings are charset-validated
  at the schema boundary as defence in depth.

### Modified Capabilities

<!-- None: no existing capability governs output-encoding or injection safety. -->

## Impact

- `apps/web/src/app/layout.tsx` — inline `<script id="__org_data">` encoding.
- `apps/web/src/app/layout.test.tsx` — add a breakout-attempt case.
- `packages/shared/src/schemas/organization.ts` — charset constraint on
  `shortName`/`fullName` (shared by `organizationSchema`,
  `organizationUpdateSchema`, `organizationPublicSchema`).
- Blast radius is every page including the anonymous landing page; the write
  surface is admin-only (privileged stored XSS). Standard, low-risk fix; no
  data migration needed.

## Non-goals

- A site-wide Content-Security-Policy is out of scope (tracked separately).
- The `getOrgPublic` fetch/caching path is unchanged.
- No other inline-script injection sites are introduced by this change.
