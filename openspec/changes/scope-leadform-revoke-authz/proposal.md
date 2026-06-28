## Why

A head can revoke another group's submitted report sections. The
`leadForm.revoke` and `leadForm.revokeAllSubmitted` mutations are
`headProcedure`s, but they take a raw `reportSectionId` / `reportId` and pass it
straight to `LeadFormService` with no group-scope check. A head from group A can
craft a request with a group-B section id (or a report id whose sections span
other groups) and flip those submissions back to `draft`. This is a
broken-object-level-authorization (BOLA) write hole — the same class the read
path already closes via `repository-scope-guard` and that `respondReopenRequest`
already closes for the reopen-decision write path.

It surfaces only in production: dev/UAT seeds give every head a single group, so
local testing never exercises a cross-group head.

## What Changes

- `LeadFormService.revokeSubmission` MUST authorize the target section against
  the caller's allowed groups before the status flip; an out-of-group section is
  rejected as not-found (no existence oracle).
- `LeadFormService.revokeAllSubmitted` MUST restrict its `updateMany` to
  sections whose author is in the caller's allowed groups; a head revokes only
  their own group's submissions, never the whole org's.
- The caller's group scope (the `reportSection` `groupScopeFilter`) is threaded
  from `ctx.session` through the tRPC `revoke` / `revokeAllSubmitted` procedures
  into the service and repository, mirroring the `respondReopenRequest` pattern.
- Admin sessions stay global (no filter); a viewer/lead never reaches these
  head-only procedures.
- A regression test constructs a head in group A revoking a group-B section and
  asserts rejection plus zero rows mutated.

## Non-goals

- Read-path scope on `leadForm` queries (owned by `repository-scope-guard` /
  `scope-accessed-audit`); this change is write-path only.
- The reopen-decision write path (already scoped via `reopen-requests`).
- Any new error taxonomy or change to `trpc.error-mapper.ts` beyond reusing the
  existing not-found / forbidden mapping.

## Capabilities

### New Capabilities

- `leadform-revoke-scope`: group-scope authorization on the lead-form
  submission-revocation write path (`revokeSubmission` and
  `revokeAllSubmitted`), so a head can only revoke sections owned by their own
  reporting group while admin stays global.

### Modified Capabilities

<!-- none: the read-path guard (repository-scope-guard) and reopen-decision
     scope (reopen-requests) are untouched; this is a new write-path invariant -->

## Impact

- `apps/api/src/modules/report-sections/lead-form.service.ts` — both revoke
  methods take a scope argument and enforce it.
- `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts` —
  `revokeSectionSubmission` / `revokeAllSubmitted` filter on
  `author.reportingGroupId`.
- `apps/api/src/infrastructure/trpc/trpc.router.ts` — `revoke` /
  `revokeAllSubmitted` build the scope from `ctx.session` and pass it down.
- `apps/api/src/lib/group-scope.ts` — reused (`groupScopeFilter`), unchanged.
- New regression test under `apps/api/src/modules/report-sections/`.
- No schema or migration change; no client-facing contract change.
