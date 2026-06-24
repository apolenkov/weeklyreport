# Design — user-record overhaul (ФИО, position, display, SAML create-only)

## Context

`User.name` is a single `String` and the canonical display name. Hard
constraints:

1. **SAML supplies only `displayName`** (`saml-profile.ts:29`, written at
   `auth.routes.ts:213-231`) — no name parts, and (per the grilling) no role.
2. **`name` is read in 30+ places** plus the **session** user
   (`SessionUser`, `session-provider.tsx:30`), which carries only `name`.
3. **Bug:** `initialsFromName` (`nav-bar.tsx:141`) = first-word + last-word →
   surname+patronymic for an ФИО string.

## Decision 1 — `name` stays stored, denormalized (NOT derived)

Unchanged from the original change. `name` is a real column; the admin form
recomputes it from the parts on save; SAML writes it directly from
`displayName` with parts `null`. Deriving `name` would blank SAML users.

## Decision 2 — display order ФИО, surname-first

`name = [lastName, firstName, middleName].filter(Boolean).join(" ").trim()`.
Short form = `surname + " " + initials(firstName[, middleName])`, e.g.
«Баленков А.В.», or «Баленков А.» without a patronymic.

## Decision 3 — initials from parts, with a name-string fallback

A single shared helper computes initials and the short form. It PREFERS
structured parts (`lastName[0] + firstName[0]` → «БА»). Records without parts
(SAML stubs — the common production case, parts are `null`) fall back to a
name-string heuristic: split on whitespace and take the **first + second**
token under the surname-first convention (not first + last). Single-token →
first two letters. This guarantees the avatar never regresses to "??" for SAML
users while giving correct initials once an admin fills the parts.

To use parts in the nav avatar, the parts are plumbed through `auth.me`
(`auth.routes.ts:265`) into `SessionUser`. The Users table and stage chip read
parts directly from the admin snapshot (`adminUserSchema`), so they need no
session plumbing.

## Decision 4 — position is independent of role

`position` is a free-text HR title, admin-owned, nullable, never sourced from
the IdP. `role` remains the access level. They are separate columns and
separate form fields; the spec keeps them in distinct capabilities
(`user-position` vs the access role) to prevent the conceptual merge the user
explicitly warned against.

## Decision 5 — SAML is create-only, role-free, viewer-default

- **Create-only:** an existing user is the source of truth after first login;
  the IdP never overwrites `name`/`role`/`reportingGroupId`/parts/position.
  This is what makes admin-authored ФИО, role, and position durable.
- **Role removed from the assertion:** Keycloak has no role; requiring it (the
  current `SamlProfileSchema`) is impossible to satisfy. Default `viewer` is the
  least-privilege posture — strictly safer than trusting an IdP-asserted role.
  The threat-model comment is updated to record the rationale flip.
- **dev-login untouched:** it sets role from a query param and does not use
  `SamlProfileSchema`, so the dev role switcher (the UAT mechanism) keeps
  working.
- **Admin bootstrap:** seeds set `role=admin`, so viewer-default never locks
  everyone out of admin.
- **Account key:** corporate email == `samlId`; no separate username, no
  domain allow-list.

## Decision 6 — English UI labels, no FTS, read sites unchanged

Form labels stay English (`Last name` / `First name` / `Middle name` /
`Position`) per the repo UI-strings rule. `User` has no `searchTsv` (FTS is on
`Project`), so no FTS work. The 30+ `name` read sites are out of scope — the
payoff of keeping `name` stored.

## Migration posture

MVP "Database Is Disposable": reshape `prisma/schema.prisma` directly, keep the
single init migration in sync, `migrate reset` + reseed. No alter-table
backfill. One pass for all four parts of this change.
