# Tasks

## 1. Product decision (BLOCKING)

- [x] 1.1 Confirm the identity-matching decision with the product owner: when
      both the profile and the stored user carry a `samlId`, require strict
      `samlId` equality before accepting an email match as the same identity;
      when either side lacks a `samlId` (seed/dev-login users), keep the
      current email-only path. **RATIFIED 2026-07-17 (product owner): strict
      `samlId` equality when both sides carry one; a mismatch is a login
      refusal, not a re-link. Email-only path stays for users without a
      stored `samlId`.** Change is unblocked; implementation may proceed.

## 2. Characterization pins (write before any behavior change)

- [ ] 2.1 Add a unit test pinning current `buildUserSession` behavior: an
      email match with a mismatched `samlId` is accepted today (the exact
      case this change intends to close) — pin it as-is first, so the diff
      that changes it is visible.
- [ ] 2.2 Add a unit test pinning current `existingSection` behavior: with
      more than one `draft`-status report existing, document which section
      `findFirst` returns today (insertion order), to prove whether the bug
      is real before touching ordering.

## 3. Identity cross-check (only after 1.1 is ratified)

- [ ] 3.1 Implement the ratified samlId cross-check in `buildUserSession`
      (`apps/api/src/modules/auth/user-session.ts`), keeping the email-only
      path for either side missing a `samlId`.
- [ ] 3.2 Update or replace the pin from 2.1 to assert the new, ratified
      behavior; keep the old-behavior case as a comment/reference only if the
      ratified decision says the mismatch case must now diverge.

## 4. Active-report/section ordering fix (independent of 1.1; may ship first)

- [ ] 4.1 If 2.2 shows the current row order is not guaranteed to be the
      current-period draft, add `orderBy: { report: { createdAt: "desc" } }`
      to the `existingSection` query so it agrees with the report-only
      fallback's ordering.
- [ ] 4.2 Update the test from 2.2 to assert the now-deterministic pick.

## Gates

- [ ] 5.1 `pnpm typecheck`
- [ ] 5.2 `pnpm lint`
- [ ] 5.3 `pnpm test`
- [ ] 5.4 `pnpm --filter @customreport/api test:integration`
