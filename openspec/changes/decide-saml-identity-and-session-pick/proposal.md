## Why

`buildUserSession` in `apps/api/src/modules/auth/user-session.ts:121` resolves
the calling identity with an email-first lookup:

```ts
const existing =
  (await prisma.user.findFirst({ where: { email: profile.email } })) ??
  (await prisma.user.findFirst({ where: { samlId: profile.samlId } }));
```

Because email is checked first and alone, a profile whose IdP-issued `samlId`
does not match the stored user's `samlId` is still accepted as long as the
email string matches. If a real-world email is ever reassigned to a different
person (a common IdP/HR event — someone leaves, the address is recycled, an
alias is repointed), the new SAML identity silently inherits the old account:
its role, its `reportingGroupId`, its history. This is a security-relevant
identity-binding gap, not a cosmetic one, and it requires a product decision
(not just a code fix) because seed/dev-login users have no `samlId` at all and
must keep working through the email path.

Separately, at line 140 the session's active section/report pick has no
ordering or period filter:

```ts
const existingSection = await prisma.reportSection.findFirst({
  where: { authorId: user.id, report: { status: "draft" } },
  select: { id: true, reportId: true },
});
```

and the report-only fallback at line 163 does order by `createdAt: "desc"`,
but the section lookup above does not order at all. `status: "draft"` is
expected to be a "the" active report, but the code does not verify that
invariant — if more than one report is ever in `draft` for a lead's sections,
`findFirst` returns Prisma's default row order (insertion order), which is
not guaranteed to be the current period. This needs verification before it
can be called correct, and a fix if the assumption doesn't hold.

## What Changes

- Ratify (owner decision, blocking): when BOTH the profile and the stored
  user carry a `samlId`, require strict equality on `samlId` before accepting
  the email match as the same identity. When either side lacks a `samlId`
  (seed/dev-login users), keep the current email-only path unchanged.
- On a `samlId` mismatch for a matched email, treat the profile as a new/
  distinct identity for provisioning purposes (exact reconciliation behavior —
  create vs. reject vs. flag — is part of the ratification, not pre-decided
  here).
- Add a regression/characterization pin for the current email-first behavior
  before any change, so the exact old behavior is on record.
- Verify whether `apps/api/src/modules/auth/user-session.ts:140`'s
  `reportSection.findFirst` can return a stale or non-current draft section
  when more than one report has `status: "draft"`. If it can, add the same
  `orderBy: { report: { createdAt: "desc" } }` ordering the report-only
  fallback already uses, so both paths agree on "the" active report.

## Capabilities

### Modified Capabilities

- `jwt-session-integrity` — session construction adds a `samlId` cross-check
  to the identity match so a reused email cannot silently inherit another
  account's role and access.

## Impact

- `apps/api/src/modules/auth/user-session.ts` — identity lookup (`buildUserSession`)
  and active-section lookup (`existingSection`).
- `openspec/specs/jwt-session-integrity/spec.md` — new requirement for
  samlId-aware identity matching.
- Any existing unit tests covering `buildUserSession` (add pins first).

## Non-goals

- No change to the email-only path used by seed/dev-login users without a
  `samlId`.
- No change to `writeProvisionedUser`'s create-then-catch-unique-violation
  recovery path beyond what the identity-match decision requires.
- No implementation happens in this change — it is a proposal awaiting
  product-owner ratification of the identity-matching rule; only the
  active-report ordering fix (once verified as a real bug) may ship without
  further sign-off, since it does not change identity semantics.
