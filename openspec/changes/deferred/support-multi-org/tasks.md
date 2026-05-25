# Tasks

## Schema migration + context injection

- **ORG-T1** Create Prisma migration: add `orgId` string FK to User, Group,
  ReportPeriod, Report; backfill existing rows with `orgId='default'`
- **ORG-T2** Update `RoleBasedAccessGuard` middleware to extract org context
  from JWT/session and pass to `groupScope`
- **ORG-T3** Migrate all repository queries to filter by `groupScope.orgId`
- **ORG-T4** Add org switcher UI component (button/dropdown) in nav bar for
  multi-org users
- **ORG-T5** Integration test: verify user can switch orgs, queries filter by
  org, unauthorized org access returns 403
- **ORG-T6** Data migration script to assign existing users to default org or
  prompt for assignment
- **ORG-T7** Commit: `feat(org): lift singleton assumption, support
multi-org (Phase 59)`

## Verification

```bash
pnpm --filter @customreport/api test -- \
  src/modules/organization/__tests__/multi-org.test.ts
pnpm prisma migrate status
```
