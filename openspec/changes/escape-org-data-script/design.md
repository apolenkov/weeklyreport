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
(`session-provider.tsx`). A grep of `apps/web/src` confirms **no** production code
reads the `__org_data` script via `getElementById` — only `layout.test.tsx`
asserts its presence. The landing page already receives org identity on first
paint through the RSC prop `initialOrg` (`page.tsx` passes it as `initialData` to
`login-page.client.tsx`), so the inline script is a dead zero-flash optimization,
not a hard dependency, and can be removed without touching any first-paint path.

## Goals / Non-Goals

**Goals:**

- The dead `__org_data` inline-script sink is removed, so no org string value can
  break out of it; any future inline script embedding server data must encode
  against breakout.
- Defence-in-depth: admin-supplied org strings reject HTML-dangerous characters
  at the Zod write boundary.
- Preserve the zero-flash first paint of the brand, already supplied via the RSC
  prop on the landing page.

**Non-Goals:**

- No site-wide Content-Security-Policy (separate, larger effort).
- No change to `getOrgPublic` fetch/caching or the `org.getPublic` procedure.
- No change to the landing-page brand-rendering path itself.

## Decisions

### Decision: Remove the dead `__org_data` inline script

Primary fix: delete the `<script id="__org_data">` element from
`apps/web/src/app/layout.tsx` outright. The investigation confirms no production
code reads it (grep of `apps/web/src` finds only `layout.test.tsx`); the landing
page already receives org identity on first paint through the RSC prop
`initialOrg` (`page.tsx` → `login-page.client.tsx` `initialData`) and the chrome
reads it from the `auth.me` session. Removing the script therefore changes no
first-paint data path and reintroduces no "ORG" flash.

Rationale: removing the sink eliminates the entire breakout class outright rather
than mitigating one instance of it — strictly simpler and safer than hardening
dead code. The `react/no-danger` eslint-disable and the `__org_data` presence
assertion in `layout.test.tsx` are removed with it, and the now-unused `orgPublic`
fetch in `RootLayout` is dropped (`generateMetadata` keeps its own `getOrgPublic`
call for the document title).

**Alternatives considered:**

- **Encode the inline payload (keep the script)** — replace the raw
  `JSON.stringify` with a serializer that runs `JSON.stringify` then escapes the
  breakout-class characters to their `\uXXXX` JSON escapes: `<` to `\u003C`,
  `>` to `\u003E`, `/` to `\u002F`, U+2028 to `\u2028`, U+2029 to `\u2029`. These
  escapes are valid inside a JS string literal and `JSON.parse` recovers the exact
  strings. Rejected as the primary fix — it hardens a sink that nothing reads,
  shipping an encoded-but-unused script. Retained here as the required shape **if**
  a future inline script must embed server data; the general encoding invariant in
  the spec governs that case.
- **`serialize-javascript` (hardened serializer)** — proven and battle-tested,
  but adds a runtime dependency for a few-line need; `dependency-currency` spec
  discourages incidental deps. Rejected for this scope.

### Decision: Add a charset constraint at the org write schema boundary

Add a `.regex(...)` (or `.refine(...)`) on `shortName`/`fullName` in
`organizationUpdateSchema` rejecting `<` and `>` (the HTML tag delimiters),
without loosening the existing length bounds. This is defence in depth — even if
a future inline-injection site forgets to encode, the dangerous value never
reaches the database.

Rationale: org strings are brand identifiers (letters, digits, spaces, common
punctuation) — angle brackets carry no legitimate brand meaning. Applying the
constraint to the update (write) schema keeps the stored data clean; the public
projection inherits clean data.

The read/projection schemas (`organizationSchema`, `organizationPublicSchema`) are
deliberately left unconstrained: they `.parse()` values read FROM the database
(`organization.prisma-repository.ts`, `organization.service.ts`), so adding the
same regex there would throw on any legacy stored value and break reads instead of
failing safe. The write boundary is the single chokepoint where untrusted admin
input enters, so the constraint belongs there alone.

**Alternative considered:** validate only at render time. Rejected — leaves the
database holding markup, and any new consumer would re-inherit the risk.

## Risks / Trade-offs

- **[Over-strict charset rejects a legitimate brand]** → restrict the deny-list to
  `<` and `>` only (the actual tag delimiters); do not block ampersands, quotes,
  slashes, or unicode, which appear in real names.
- **[Removing the script reintroduces a flash]** → the landing first paint already
  reads org identity from the RSC prop (`page.tsx` `initialData`), not the script;
  a render test asserts the brand paints without the "ORG" placeholder.
- **[`layout.test.tsx` brittleness]** → the test drops the `__org_data` presence
  and round-trip assertions and instead asserts the script is absent and the brand
  still renders, including under a `</script>`-breakout `fullName`.
- **Invariants:** preserves the deferred-feature, role-coverage, period dual-state,
  and destructive-db-guard invariants (none are touched). No migration, no schema
  reshape — the change is code + Zod validation only.

## Migration Plan

- No data migration. Pure code + schema-validation change.
- Existing stored org rows are seed/demo data (ASCII brand strings) and already
  satisfy the new charset constraint.
- Rollback is a straight revert of the edited files; no state to unwind.

## Open Questions

- Resolved: confirmed via grep of `apps/web/src` and a read of `layout.tsx`,
  `page.tsx`, and `login-page.client.tsx` that no runtime path reads `__org_data`;
  the script is removed by this change. The spec retains a general encoding
  invariant for any future inline script that must embed server data.
