## Why

BL-16 (P1) from `docs/reviews/repo-excellence-review-2026-07-14.md`:
production SMTP transport hardcodes `secure: false` and omits `requireTLS`.

`EmailService`'s constructor (`apps/api/src/infrastructure/email/email.service.ts:53-72`)
builds the production nodemailer transport as:

```ts
this.transporter = nodemailer.createTransport({
  host,
  port: env.SMTP_PORT ?? DEFAULT_SMTP_PORT,
  secure: false,
  auth: env.SMTP_USER
    ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
    : undefined,
});
```

`secure: false` is a hardcoded literal, not derived from `SMTP_PORT`
(`DEFAULT_SMTP_PORT = 587`), and no `requireTLS` option is set anywhere in
the 144-line file. Two consequences:

- With auth configured and no `requireTLS`, nodemailer only upgrades via
  opportunistic STARTTLS; if the relay omits STARTTLS or an active MITM
  strips it, the base64 `AUTH LOGIN` credentials go out in cleartext.
- `secure: false` is fixed regardless of port, so an operator cannot point
  `SMTP_PORT` at 465 (implicit-TLS/SMTPS) — nodemailer would attempt
  plaintext/STARTTLS negotiation on a port that expects immediate TLS,
  breaking delivery outright.

`apps/api/src/infrastructure/config/env.schema.ts:76-81` declares
`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`, all `.optional()`
(intentional — absence triggers the dev `jsonTransport` fallback at
`email.service.ts`'s `else` branch, `isDev = true`). No `SMTP_SECURE` var
exists; this change does not need to add one — both fixes derive from
existing config (`port`, whether `auth` is present).

## What Changes

- `EmailService`'s constructor derives `secure` from the configured port:
  `secure: (env.SMTP_PORT ?? DEFAULT_SMTP_PORT) === 465`, replacing the
  hardcoded `false`.
- The constructor sets `requireTLS: true` whenever `auth` is configured
  (i.e. `env.SMTP_USER` is set), so a failed STARTTLS upgrade aborts the
  send instead of silently falling back to cleartext AUTH.
- No new env var is added — both fixes are computed from `SMTP_PORT` and the
  existing `env.SMTP_USER` presence check; the dev `jsonTransport` fallback
  path (`isDev = true` branch) is untouched.

## Claim disposition table

| Sub-claim                                           | Review evidence                                              | Disposition                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `secure: false` is hardcoded, not derived from port | `email.service.ts:53-72`, literal `secure: false`            | CONFIRMED — fix                                                                   |
| No `requireTLS` anywhere in the file                | full 144-line read, no match for `requireTLS`                | CONFIRMED — fix                                                                   |
| Port-465 (implicit TLS) relays cannot be used today | `secure: false` fixed regardless of `SMTP_PORT` value        | CONFIRMED — fix                                                                   |
| No `SMTP_SECURE` env var exists                     | `env.schema.ts:76-81`, 5 SMTP vars, none named `SMTP_SECURE` | CONFIRMED, but no new var needed — fix derives `secure` from `SMTP_PORT` directly |

## Non-goals

- Not adding a `SMTP_SECURE` env var — the port-derived rule
  (`port === 465`) covers the two real-world cases (587 STARTTLS, 465
  implicit TLS) without another knob to keep in sync with `SMTP_PORT`.
- Not changing the dev `jsonTransport` fallback path or its `.optional()`
  env vars — dev mode has no network transport to secure.
- Not adding TLS certificate pinning, custom CA handling, or `tls.rejectUnauthorized`
  overrides — out of scope; this change only closes the STARTTLS-downgrade
  and wrong-`secure`-flag gaps the review flagged.
- Not touching `email-reminder.processor.ts` or any `EmailPort` consumer —
  the fix is entirely inside `EmailService`'s transporter construction.

## File manifest

- `apps/api/src/infrastructure/email/email.service.ts` — `EmailService`
  constructor (lines 53-72)
- `apps/api/src/infrastructure/config/env.schema.ts` — read-only reference,
  confirms no new var needed (lines 76-81)
- Tests:
  - `apps/api/src/infrastructure/email/email.service.test.ts` (new — no test
    file exists for `email.service.ts` today; `EmailPort` behavior is
    currently exercised only indirectly through
    `email-reminder.processor.test.ts`'s test double)

## Verification

- `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- `cd apps/api && pnpm test:integration` — no dedicated SMTP integration
  path exists (dev/test environments use the `jsonTransport` fallback), so
  this is primarily a unit-test verification; run integration to confirm no
  regression in `email-reminder.processor` wiring.
- **Operational smoke task** (required for this change per the P1
  verification bar — proves the fix live against a real relay, not just
  nodemailer's option object): stand up a local SMTP-over-TLS test relay
  (e.g. `docker run --rm -p 587:587 -p 465:465 -e SMTP_USER=test -e SMTP_PASS=test <a STARTTLS+implicit-TLS-capable test SMTP image, e.g. maildev or a minimal swaks/openssl s_server pairing>`),
  point `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` at it, boot the API
  with `NODE_ENV=production`-shaped config, and:
  1. On port 587: confirm the connection log shows a STARTTLS upgrade before
     `AUTH LOGIN`, and that killing STARTTLS support on the test relay makes
     the send fail loud (not fall back to cleartext) — this is what
     `requireTLS: true` proves.
  2. On port 465: confirm the client connects with implicit TLS
     (`secure: true` computed) and the send succeeds — this is what the
     port-derived `secure` flag proves.
     Capture both outcomes in the PR description as the live-verify evidence.

## Sequencing

No dependency on the other four changes in this batch — `email.service.ts`
is not touched by any of them. Can land independently.
