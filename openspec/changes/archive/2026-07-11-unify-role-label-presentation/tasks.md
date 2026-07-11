## 1. Role-label presentation

- [x] 1.1 `nav-bar.tsx`: replace the hardcoded `getRoleLabel` switch with a
      `ROLE_LABEL[role]` lookup; update/add a test pinning nav renders
      "Head" (not "Group Head") for the head role
- [x] 1.2 `users-tab.tsx`: derive `ROLE_OPTIONS` labels from `ROLE_LABEL`
      instead of the hand-written array; keep the `""` / "All roles" entry
      as the one non-role option
- [x] 1.3 `users-tab.tsx`: `RoleBadge` renders `ROLE_LABEL[role]` instead of
      the raw token + CSS `capitalize`; add/update a test asserting the
      rendered text
- [x] 1.4 `dashboard.ts`: retype `LeadInfo.role` from `string` to `Role`;
      fix any resulting type errors in `dashboard-leads.ts`
- [x] 1.5 `lead-summary-table.tsx`: render `ROLE_LABEL[lead.role]` instead
      of the raw `lead.role` value; add/update a test asserting the
      rendered label

## 2. Schema-derived role guards

- [x] 2.1 Read the existing guard-parity tests
      (`login-page-roles.test.ts`, `last-role.test.ts`) to confirm current
      `isRole`/`VALID_ROLES` behavior for non-role and non-string inputs —
      these tests must keep passing unchanged
- [x] 2.2 `login-page-roles.ts`: reimplement `isRole` as
      `sessionRoleSchema.safeParse(value).success` (import
      `sessionRoleSchema` from `@customreport/shared`); remove the
      hand-written literal chain
- [x] 2.3 `last-role.ts`: reimplement `VALID_ROLES` as
      `new Set<Role>(sessionRoleSchema.options)`; remove the hand-written
      literal array
- [x] 2.4 Run both test files plus the full web unit suite to confirm no
      behavior change

## 3. Lint-gate coverage for the role vocabulary

- [x] 3.1 Add a `ROLE` pattern (the four literal role tokens) to
      `scripts/find-status-literal-unions.mjs`'s vocabulary list, following
      the existing `TRAFFIC`/`REPORT`/`CANONICAL`/`Z_UNION` pattern shape
- [x] 3.2 Add `packages/shared/src/schemas/auth.ts` to the scanner's SSOT
      exemption list
- [x] 3.3 Extend the scanner's own `node --test` suite with a role-union
      positive case (staged file re-declaring all four role tokens is
      flagged) and a negative case (a legal subset/composition passes)
- [x] 3.4 Run `node scripts/find-status-literal-unions.mjs --all` over the
      whole tree — confirm zero unexpected hits (the four fixed sites from
      section 1/2 must no longer contain a raw literal role array; the
      exemptions must cover any documented remaining mirror)

## 4. Gates and verification

- [x] 4.1 `pnpm --filter @customreport/api db:generate` (regenerate Prisma
      client before typecheck)
- [x] 4.2 `pnpm typecheck && pnpm lint && pnpm test` — all green
- [x] 4.3 `openspec validate --all --strict` — passes
- [x] 4.4 Adversarial review of the diff (independent read against the
      proposal/design/specs) before archiving
- [x] 4.5 Archive the change with delta-spec sync
      (`openspec archive unify-role-label-presentation`)
