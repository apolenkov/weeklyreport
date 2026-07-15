## 1. Derive `secure` from port and require TLS when auth is configured

- [x] 1.1 `apps/api/src/infrastructure/email/email.service.ts`: replace the
      hardcoded `secure: false` in the production `nodemailer.createTransport`
      call with `secure: (env.SMTP_PORT ?? DEFAULT_SMTP_PORT) === 465`
- [x] 1.2 Same call: add `requireTLS: true` whenever `env.SMTP_USER` is set
      (i.e. whenever `auth` is configured), so a failed STARTTLS upgrade
      aborts the send instead of falling back to cleartext AUTH
- [x] 1.3 Confirm the dev `jsonTransport` fallback branch (`isDev = true`,
      no `host`) is unaffected

## 2. Tests

- [x] 2.1 Add `apps/api/src/infrastructure/email/email.service.test.ts` (new
      file): assert `createTransport` receives `secure: true` when
      `SMTP_PORT === 465` and `secure: false` when `SMTP_PORT === 587` (or
      unset, default 587)
- [x] 2.2 Same file: assert `requireTLS: true` is passed when `SMTP_USER` is
      set, and is absent/false when no auth is configured
- [x] 2.3 Same file: assert the dev `jsonTransport` fallback is untouched
      when `SMTP_HOST` is unset

## 3. Spec delta

- [x] 3.1 `smtp-transport-security` (new capability): ADD a requirement that
      production SMTP transport derives `secure` from the configured port
      and requires TLS when authentication is configured

## 4. Gates and verification

- [x] 4.1 `pnpm --filter @customreport/api db:generate`
- [x] 4.2 `pnpm typecheck && pnpm lint && pnpm test`
- [x] 4.3 `cd apps/api && pnpm test:integration`
- [ ] 4.4 Operational smoke: run the API against a local STARTTLS+implicit-TLS
      test SMTP relay on ports 587 and 465; confirm STARTTLS-then-AUTH on 587
      and implicit-TLS connect on 465 (see proposal.md Verification section
      for the exact procedure); capture both outcomes as live-verify evidence
- [x] 4.5 `openspec validate smtp-transport-tls --strict`
