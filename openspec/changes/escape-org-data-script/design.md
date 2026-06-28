## Context

`apps/web/src/app/layout.tsx` (UFB-070) inlines the org identity into the
document `<head>` so the landing page brand paints without an "ORG" flash:

```tsx
<script
  id="__org_data"
  type="application/json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(orgPublic) }}
/>
```

`orgPublic` comes from `getOrgPublic()` (server-only tRPC GET to
`org.getPublic`). The strings originate from the admin-editable `Organization`
singleton (`shortName` ≤ 16, `fullName` ≤ 200 — `packages/shared/.../organization.ts`).

`JSON.stringify` produces a valid JS string but does NOT HTML-encode `<` or `/`.
A `fullName` of `</script><img src=x onerror=...>` therefore closes the `<script>`
element in the parsed HTML and the trailing markup executes. `type="application/json"`
does not change HTML tokenization — the parser still honours `</script>`. The
write surface is admin-only, so this is a privileged stored XSS, but it fires for
every visitor on every page including the anonymous landing page.

Note: the brand strings the landing page actually renders come from the
`trpc.org.getPublic` query (`login-page.client.tsx`) and the `auth.me` session
(`session-provider.tsx`); no production code currently reads the `__org_data`
script via `getElementById` (only `layout.test.tsx` asserts its presence). The
inline script is a zero-flash optimization, not a hard dependency.

## Goals / Non-Goals

**Goals:**

- The inline org-data script can never be broken out of by any org string value.
- Defence-in-depth: admin-supplied org strings reject HTML-dangerous characters
  at the Zod write boundary.
- Preserve the zero-flash intent and the round-trip parseability of the payload.

**Non-Goals:**

- No site-wide Content-Security-Policy (separate, larger effort).
- No change to `getOrgPublic` fetch/caching or the `org.getPublic` procedure.
- No change to the landing-page brand-rendering path itself.

## Decisions

### Decision: Encode the inline payload rather than drop the script

Primary fix: HTML-encode the breakout-class characters before injection.
Replace the raw `JSON.stringify` with a small serializer that runs
`JSON.stringify` then escapes `<` → `<`, `>` → `>`, `/` → `/`,
U+2028 → ` `, U+2029 → ` `. These `\uXXXX` escapes are valid inside a
JSON/JS string literal and decode back to the original characters, so a client
`JSON.parse` recovers the exact strings.

Rationale: smallest, lowest-risk change; keeps the zero-flash optimization and
the `type="application/json"` shape; the `eslint-disable react/no-danger`
comment is updated to state the value is now breakout-encoded.

**Alternatives considered:**

- **`serialize-javascript` (hardened serializer)** — proven and battle-tested,
  but adds a runtime dependency for a 5-line need; `dependency-currency` spec
  discourages incidental deps. Rejected for this scope; the inline helper is
  trivial and single-use.
- **Pass org identity as a React prop / data attribute** — removes the inline
  script entirely (React escapes attribute/child text). Cleanest long-term and
  attractive because no production reader of `__org_data` exists today, but it
  changes the first-paint data path and the `layout.test.tsx` contract, widening
  blast radius. Recorded as the preferred follow-up if the script is later found
  to be dead; out of scope for this P0 fix.

### Decision: Add a charset constraint at the org schema boundary

Add a `.regex(...)` (or `.refine(...)`) on `shortName`/`fullName` in
`organizationUpdateSchema` rejecting `<` and `>` (the HTML tag delimiters),
without loosening the existing length bounds. This is defence in depth — even if
a future inline-injection site forgets to encode, the dangerous value never
reaches the database.

Rationale: org strings are brand identifiers (letters, digits, spaces, common
punctuation) — angle brackets carry no legitimate brand meaning. Applying the
constraint to the update (write) schema keeps the stored data clean; the public
projection inherits clean data.

**Alternative considered:** validate only at render time. Rejected — leaves the
database holding markup, and any new consumer would re-inherit the risk.

## Risks / Trade-offs

- **[Over-strict charset rejects a legitimate brand]** → restrict the deny-list to
  `<` and `>` only (the actual tag delimiters); do not block ampersands, quotes,
  slashes, or unicode, which appear in real names.
- **[Encoder diverges from `JSON.parse` expectations]** → the escapes are standard
  `\uXXXX` JSON escapes; a round-trip unit test asserts parse equality, and the
  layout test asserts no literal `</script>` survives.
- **[`layout.test.tsx` brittleness]** → keep the existing presence assertion; add
  a breakout-attempt case rather than rewriting the test.
- **Invariants:** preserves the deferred-feature, role-coverage, period dual-state,
  and destructive-db-guard invariants (none are touched). No migration, no schema
  reshape — the change is code + Zod validation only.

## Migration Plan

- No data migration. Pure code + schema-validation change.
- Existing stored org rows are seed/demo data (ASCII brand strings) and already
  satisfy the new charset constraint.
- Rollback is a straight revert of the two edited files; no state to unwind.

## Open Questions

- Is the `__org_data` inline script read by any runtime path, or is it fully
  superseded by the `org.getPublic` query + `auth.me` session? If confirmed dead,
  a follow-up should remove it (the preferred prop alternative above) rather than
  carry an encoded-but-unused script.
