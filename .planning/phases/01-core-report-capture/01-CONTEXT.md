# Phase 01: Core Report Capture - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Recovered discuss/session context + roadmap + research

<domain>
## Phase Boundary

Phase 1 delivers the first usable workflow for weekly report capture:

- SAML login through Keycloak
- role-aware protected access for lead/head/viewer
- lead report section entry for current period data
- draft persistence with autosave
- section submission with immutable submitted state
- head dashboard showing who has submitted and who is still drafting

Phase 1 does **not** include publication, PDF export, carry-over automation,
email reminders, report history, or admin CRUD.

</domain>

<decisions>
## Implementation Decisions

### Locked Decisions

- **D-01:** Lead section draft saving uses **auto-save with debounce** and a
  visible status indicator with exact Russian UI text: `Сохраняется...` while a
  save is in flight and `Сохранено` when the latest save succeeds.
- **D-02:** Submitting a lead section requires a confirmation dialog with exact
  Russian copy `Вы уверены?`. After a successful submit, the section becomes
  read-only until the next report period.
- **D-03:** Submit validation rules are mandatory: every project must have a
  traffic-light status; every project must have at least one **Current Week**
  item; Top 3 priorities must be filled before submit succeeds.
- **D-04:** Continue planning immediately from recovered context. Do not reopen
  the same save/submit discovery questions.

### Agent's Discretion

- **A-01:** Head dashboard layout, sorting, and navigation labels were not
  finalized in discuss mode. Use the simplest review-first layout that makes it
  obvious who submitted and who did not.
- **A-02:** Role-aware navigation structure may be minimal in Phase 1 as long
  as lead and head users can reach their primary pages directly and unauthorized
  users are redirected correctly.
- **A-03:** Autosave debounce interval, optimistic UI details, and polling vs
  cache invalidation strategy may be chosen pragmatically if they preserve the
  locked save/submit behavior above.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and phase scope

- `.planning/PROJECT.md` — product goals, roles, monorepo shape, and data model
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and requirement IDs
- `.planning/REQUIREMENTS.md` — requirement definitions for AUTH-01..04,
  ENTRY-01..07, PUB-02
- `.planning/STATE.md` — confirmed decisions, risks, and current milestone

### Technical architecture

- `.planning/research/SUMMARY.md` — recommended stack and roadmap implications
- `.planning/research/ARCHITECTURE.md` — monorepo boundaries, shared-schema
  pattern, async-job architecture, and validation rules
- `.planning/research/PITFALLS.md` — backend validation, stateless cache, and
  SAML/PDF/carry-over pitfalls to avoid while shaping Phase 1

</canonical_refs>

<specifics>
## Specific Ideas

- Preserve exact Russian UX copy for the autosave status and submit
  confirmation dialog.
- Plan for a lead-centric entry experience first; head experience in this phase
  is operational visibility rather than full report editing.
- Use TDD-oriented execution so form validation, auth/session behavior, and
  submission locking are proven before wiring UI polish.

</specifics>

<deferred>
## Deferred Ideas

- PDF export and report publication (Phase 2)
- Portfolio overview aggregation beyond submission-status dashboard (Phase 2)
- Email reminders, carry-over logic, admin CRUD, and history browsing (Phase 3)
- Analytics, Slack/Telegram, Jira/GitLab sync, and other v2 ideas

</deferred>

---

_Phase: 01-core-report-capture_
_Context gathered: 2026-04-06 via recovered discuss/session state_
