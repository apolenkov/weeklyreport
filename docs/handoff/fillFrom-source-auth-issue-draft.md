# Draft GitHub issue — fillFrom source-section authorization gap

Ready to file (the agent was blocked from creating it autonomously — outward
write). File with:

```bash
gh issue create --repo apolenkov/yourpulse \
  --title "fillFrom does not authorize the SOURCE section — a lead can copy another group's content into their own draft" \
  --body-file docs/handoff/fillFrom-source-auth-issue-draft.md
```

(Strip this header block first, or keep it — the body below is the issue text.)

---

## Summary

`LeadFormService.fillFrom` (`apps/api/src/modules/report-sections/lead-form.service.ts:51`)
authorizes only the **target** section, never the **source**. On an OPEN report
a lead can fill their own draft from any `sourceSectionId` — including a section
authored by a different reporting group — disclosing that group's
Item/Risk/Decision content into the lead's own draft.

## Current guards (target only)

- target exists
- `target.authorId === userId` (target ownership)
- target not `submitted`
- target period `periodStatus !== 'published'` (added by viewer-report-surface-parity P1)

The call then runs `repository.fillFromSection(targetSectionId, sourceSectionId)`
(`lead-form.service.ts:87`) with **zero** checks on `sourceSectionId`: no
ownership, no group-scope, no period gate on the source.

## Why this is independent of the viewer P1 fix

The viewer-report-surface-parity P1 fix blocked `fillFrom` on a **published
target** (so the viewer search/snapshot leak can't fire). That made source
provenance moot _for the viewer leak_ but did NOT close the source-authorization
gap on **open** reports, where fillFrom is still allowed. This is a separate,
pre-existing authorization defect.

## Impact

- Cross-group content disclosure to a lead (confidentiality).
- A lead can seed their draft with another group's items by referencing that
  group's section id.

## Suggested fix

Authorize the source before copying — at minimum require the source section to be
visible to the caller under the same group/own-section scope the lead read paths
already use (e.g. `getByPeriod` / `hasSharedProduct` logic), and reject
otherwise. Add an integration test: lead A attempts fillFrom with a source
section authored by group B → rejected.

## Refs

- `apps/api/src/modules/report-sections/lead-form.service.ts:51-93`
- `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:128` (`fillFromSection`)
- Context: `docs/handoff/session-wrap-2026-06-24.md` ("Separate pre-existing follow-up").

Found during the 2026-06-25 verify+archive pass for changes A/B.
