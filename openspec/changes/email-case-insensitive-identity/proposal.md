# Proposal

## Why

Snapshot integrity already treats `User.email` as a case-insensitive identity,
but live writes did not: `adminUserSchema` accepted `Admin@example.test` and
`admin@example.test` unchanged, the admin/SAML writers persisted them verbatim,
the SAML email lookup matched exact case, and PostgreSQL enforced only an
exact-case unique. Legitimate admin writes could therefore build a live graph
that can never round-trip through snapshot recovery (duplicate email rejects
restore), and a case-variant SAML assertion could silently create a second
account for one person.

## What Changes

- One shared `normalizeEmail` (trim + lowercase, identical to the snapshot
  comparator) is the canonical email identity for every server-owned write:
  admin create/update, snapshot restore, and SAML provisioning.
- The SAML email lookup compares case-insensitively so a stored mixed-case
  account stays reachable; the stored `samlId` remains a verbatim external
  identity — never trimmed, case-folded, or rewritten on admin update.
- PostgreSQL enforces the invariant with a unique `lower("email")` index
  (`User_email_lower_key`); the existing exact-case unique stays for Prisma
  lookup compatibility. The migration refuses to proceed while case-only
  duplicates exist, listing the conflicting user ids without merging anything.
- No domain allow-list on email is introduced; the
  immutable-`samlId`-on-admin-update contract is preserved.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `admin-entity-write-integrity`: live user writes persist the canonical
  case-insensitive email identity; case-variant collisions surface as the
  existing typed conflict.
- `admin-snapshot-restore`: snapshot restore writes the same canonical email
  form it validates, so restored state can always round-trip.
- `saml-provisioning`: email lookup is case-insensitive; SAML provisioning
  cannot mint a case-variant second account.
