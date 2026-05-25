# Add Prisma typecheck gate

## Problem

Broken seed or migration scripts (`.ts` files under `prisma/`) are not caught
until runtime. `prisma/wipe-manual-uat.ts:187` has TODO(PRISMA-TYPECHECK-01)
marking a stale destructive call. A CI gate that typechecks Prisma scripts
before deployment prevents prod mistakes.

## Solution

1. Add `tsconfig.prisma.json` extending the root config, scoped to `prisma/`
   directory.
2. Add CI job `lint:prisma:typecheck` that runs `tsc --project
tsconfig.prisma.json`.
3. Extend `pnpm lint` to include `lint:prisma:typecheck`.

## Non-goals

- Change existing migration structure or require migration naming convention.
- Modify seed data or destructive guards.

## Status

Open — TODO(PRISMA-TYPECHECK-01) in codebase.
