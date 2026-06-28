## Why

A lead who co-owns even one product with a co-lead can today read that
co-lead's ENTIRE weekly section — items, risks, and decisions on products they
do NOT co-own. `LeadFormService.getByPeriod` gates a cross-author view on a
single global boolean (`hasSharedProduct`) and then returns the full mapped
section with no per-product filter
(`apps/api/src/modules/report-sections/lead-form.service.ts:157`). The sibling
`getCrossAuthorContent` deliberately scopes foreign records to shared products,
and the archived `scope-lead-report-to-own-contribution` change explicitly
rejected cross-product disclosure. This read path leaks past that posture.

## What Changes

- The cross-author branch of `getByPeriod` (a `lead` viewing another author's
  section) MUST restrict the returned section's items, risks, decisions, and
  per-stage statuses to products the two leads share — mirroring
  `getCrossAuthorContent`'s `sharedIds` filter.
- The lead's OWN section is unchanged (full section, no filter).
- `head` and `admin` cross-author reads are unchanged (full section): their
  scope is group-level, not product co-ownership, and is enforced elsewhere.
- A contract test asserts that for a shared-product co-lead view, records on
  unshared products are excluded while shared-product records remain.

## Non-goals

- No change to the Mine / Everyone visibility lens or `getCrossAuthorContent`.
- No change to group-scope guards (`repository-scope-guard`) or the
  cross-group audit event (`scope-accessed-audit`) — this is intra-group,
  author-to-author scoping on a different read path.
- No change to head/admin authorization or to write/submit paths.

## Capabilities

### New Capabilities

- `leadform-section-read-scope`: least-privilege scoping of the cross-author
  section read in `getByPeriod`, so a co-lead view returns only the records on
  products the two leads share, never the foreign author's whole section.

### Modified Capabilities

<!-- none: repository-scope-guard governs group-scope on findReports/period
     queries with ScopeGuardError semantics; scope-accessed-audit governs the
     cross-group audit event. Neither governs this intra-group, per-product
     foreign-section read; this is a new read-path invariant. -->

## Impact

- `apps/api/src/modules/report-sections/lead-form.service.ts` — filter the
  cross-author section before returning.
- `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts` —
  surface the shared-product ids for the viewer/author pair (reuse the
  `getCrossAuthorContent` co-ownership query) so the service can filter.
- New contract test in the report-sections test suite.
