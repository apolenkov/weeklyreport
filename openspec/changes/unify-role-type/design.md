## Context

`packages/shared/src/schemas/auth.ts` deliberately holds TWO role enums:
`roleSchema` (`DbRole`, "DB-bound writes MUST validate against this set",
lockstep with Prisma `enum Role`) and `sessionRoleSchema` (`Role`, the
session axis), kept as separate aliases "so the session axis and the DB Role
column can diverge later without touching every call site". They are
structurally identical today, so every axis assignment below is intent, not
compile-necessity — the payoff is that divergence becomes a compile-time
event at exactly the sites that would need a decision.

Inventory (verified by both council seats independently): full-union
re-declarations at `login-page-roles.ts:8`, `weekly-report-page.tsx:297`,
`lead-form.ts:188,831`, `lead-cross-author.ts:65`, `admin-types.ts:16`,
`role-switcher.tsx:20`, `admin-mock-data.ts:8`, `last-role.ts:23`,
`session-provider.tsx:40` (web); `lead-form-shared.ts:192`,
`lead-form.prisma-repository.ts:634` (api); 8 unit-test fixtures; seed and
e2e mirrors. `DbRole` has zero consumers. `Role` has ~20.

Two-seat council grilling (deep-reasoning adviser + Codex seat, both
verifying independently) adjudicated by the orchestrator:

- Full sweep over the backlog's switcher-only naming (both seats): the
  report-status precedent swept all parity sites for the same reason.
- Axis split over all-`Role` (both seats): all-`Role` would silently admit a
  session-only role into DB-persisted fields the day the axes diverge; the
  split turns that day into type errors at the right sites.
- Bridge sites take the DB side (Codex seat, adopted over the adviser's
  session-axis reading): the switcher's rows come from `prisma.user.findMany`
  via `dev.listUsers`, and `DEV_EMAIL_FOR_ROLE`/`devLoginHref` feed the
  dev-login endpoint that validates with `roleSchema` — these are DB→session
  bridges, so their inputs type as `DbRole` while the session-side guards
  (`isRole`, `getSessionRole`, `defaultRedirectFor`) stay `Role`.
- Type-position-only (both seats): runtime guards (`isRole`, `VALID_ROLES`)
  keep their literal values — a type predicate enumerating values is input
  validation, not a type re-declaration. Parity tests (Codex seat) pin them
  to `sessionRoleSchema.options` without changing production code paths.
- `ROLE_LABEL: Record<Role | DbRole, string>` (Codex seat): the map is
  consumed by both axes (login page/switcher on the session side, the
  lead-form author mapper on the DB side); the union type keeps it total over
  both without pinning the axes equal.

Load-bearing invariants:

- The two Zod enums and their literals stay VERBATIM. A mechanical "collapse
  duplicate literals" pass (e.g. `sessionRoleSchema = z.enum(roleSchema.options)`)
  would defeat the divergence design. One literal home PER AXIS.
- Wire/DB compatibility: `authorRole` is validated by `roleSchema` on the
  wire (`section.schema.ts:336`); Prisma `enum Role` matches `roleSchema`;
  the swap is type-position-only, zero runtime delta.
- The client permission layer (`role-predicates.ts`) already imports `Role`
  and is untouched; enforcement stays the API role-coverage gate.

## Goals / Non-Goals

**Goals:**

- Zero full-union role re-declarations in web/api source and unit fixtures;
  every site imports `Role` or `DbRole` per axis.
- The four bare duplicate exported types die.
- `DbRole` ↔ `$Enums.Role` pinned by an identity test; guard parity pinned
  against `sessionRoleSchema.options`.
- Backlog updated with corrected inventory and named follow-ups.

**Non-Goals:**

- No label consolidation (nav "Group Head" at `nav-bar.tsx:110`, users-tab
  option labels, RoleBadge raw token, dashboard `string`-widened roles) —
  named follow-up under the role-label drift heading.
- No api auth bridge edits (`roles.guard.ts` uses `roleSchema` to validate
  session roles; `user-session.ts`/`dev-login.routes.ts` type internals with
  Prisma `Role`) — infrastructure internals are exempt, and the guard is
  authz-adjacent; named follow-up.
- No runtime derivation of `VALID_ROLES`/`isRole` from schema options —
  named follow-up merged with the literal-union lint-gate follow-up.
- No dev-email value centralization (3 sync points), no catalog YAML
  validation — named follow-ups.

## Decisions

### D1: One literal home per axis, two homes total

The rule the spec pins: the four role literals may appear in type positions
only inside `auth.ts`'s two Zod enums; everywhere else composes `Role` or
`DbRole`. Exemptions: runtime validators keep literal VALUES (not type
unions), the Prisma seed toolchain keeps one documented mirror
(`tsconfig.prisma.json` cannot resolve workspace packages), e2e stays
self-contained (isolated tsconfig with no `@customreport/shared` path — a
type-only resolution seam was considered and rejected as new toolchain
surface for an eslint-ignored tree), and catalog YAML role tokens are
behavioral data.

### D2: Axis assignment is by data provenance

Session-sourced values (`auth.me` session, its localStorage echo, login
session guards) type as `Role`. Persistence-sourced values (admin user rows,
`authorRole` mirrors of the read model, Prisma-sourced switcher rows,
dev-login request payloads) type as `DbRole`. Where one module holds both
(login-page-roles, role-switcher), each declaration follows its own operand —
the explicit `DbRole`-in/`Role`-out shape IS the documentation of the bridge.

### D3: Bare aliases die, compositions survive

`UserRole` (admin-types, admin-mock-data), login-page `Role`, and `LastRole`
are identical re-spellings and are deleted; consumers import shared types.
`CurrentRole = Role | null`, `LastRoleRecord`, and every deliberate subset
(`mode: "lead" | "head"`, `scope: "lead" | "product"`, narrowed test
scenario types) survive — same compose-don't-re-literal rule the
traffic-light change ratified. Adjacent debt flagged, not folded: `MockUser`
is declared in both admin files; not a role union, left alone.

### D4: Completeness pins are tests, not runtime rewrites

`ROLE_ORDER` keeps its hand-written UI order but is typed
`readonly DbRole[]` with a type-level completeness check
(`(typeof ROLE_ORDER)[number]` equals `DbRole`); `isRole` gains a parity
test iterating `sessionRoleSchema.options`; last-role storage gains a
round-trip test over every session role plus the existing unknown-token
rejection. Production code paths byte-identical.

## Risks / Trade-offs

- Hidden re-declaration in another member order → residual sweep greps all
  four members in any order plus `z.enum` forms; calibrated on a
  known-positive file before trusting a clean result.
- Axis mis-assignment is invisible today (identical unions) → design lists
  every site's axis explicitly; the adversarial verifiers check assignments
  against data provenance, not compile success.
- `Record<Role | DbRole, string>` reads as pinning the axes equal → it does
  the opposite (requires totality over both unions if they diverge); noted in
  the shared comment.
- Test-fixture churn reads as behavior change → fixture edits are
  import + annotation lines only; called out for review.

## Migration Plan

1. Shared: widen `ROLE_LABEL`'s type; no value changes.
2. Api: identity test; swap the two `authorRole` sites to `DbRole`; convert
   the six trpc test fixtures per asserted axis.
3. Web: delete the four aliases; convert the nine source sites per axis;
   convert the two test fixtures; add parity + completeness tests.
4. Prisma: single documented mirror in `seed-constants.ts`; `seed.ts`'s
   `toRole` types from `SeedUser["role"]`.
5. Backlog delta + strict validation; full gates; residual sweep.

Rollback is a normal git revert; no persisted data or API surface changes.

## Open Questions

- None blocking.
