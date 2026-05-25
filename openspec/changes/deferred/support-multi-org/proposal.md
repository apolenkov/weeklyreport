# Support multi-org

## Problem

CustomReport currently assumes a single hardcoded organization (singleton
`id='singleton'` in organization table). Users in different teams/companies
need separate report instances. Phase 59 roadmap includes multi-org support:
users belong to one or more organizations; each org has independent report
cycles and leads.

## Solution

1. Lift singleton org assumption: add `orgId` FK to users, groups, report
   periods, and reports.
2. Update auth middleware to extract org context from JWT or session and
   inject into `groupScope`.
3. Migrate existing data to `orgId = 'default'` or prompt user to assign
   organization.
4. Add org switcher to UI for users in multiple orgs.

## Activation trigger

**Phase 59 milestone** — Multi-org is a Phase 59 scope item. Activate only
when Phase 59 is unlocked and schema migration is approved.

## Non-goals

- Implement org admin dashboard or org settings UI.
- Change pricing or billing model.

## Status

Deferred — TODO(Phase-59-multi-org) in multiple files: `organization.service.ts:36`,
`login-page.client.tsx:161`, `group-scope.ts:4`.
