# Product-Ready Retrospective and Regression Hardening Plan

**Date:** 2026-05-08
**Status:** active plan
**Verdict:** product-ready gate is not closed yet
**Scope:** manual UAT feedback from 2026-05-08, current regression suite, domain model coverage, role-based automation, logs, screenshots, auth/session behavior.

## Executive Verdict

The latest manual UAT found real product issues that the automated regression pass did not catch. The failure is not just one missed selector. The regression approach was too page-oriented and not strict enough about the domain model:

- product ownership was mixed with reporting responsibility;
- project status was treated as product-level while the user flow is stage-level;
- the test suite checked that controls exist, but did not prove per-stage independence;
- role coverage existed, but not as a complete role/profile matrix with isolated browser sessions;
- screenshots existed, but hover/focus geometry and timestamped action logs were not first-class assertions;
- no-cookie/protected-route behavior was not covered as a product flow.

This plan upgrades the gate from tests passed to domain invariants passed under all roles with captured evidence.

## Current State

Current branch has uncommitted changes from the prior polish pass:

- UI polish around dashboard toggle labels, empty products, hover/collapsed report sections;
- manual UAT wipe mode changes;
- admin settings simplification around periods;
- test updates and documentation updates;
- manual browser evidence under .planning/regression/evidence/manual-uat-layout-polish/.

That means product-ready cannot be claimed until the functional fixes below are implemented, the diff is reclassified, and the full gate is rerun.

## Feedback Inventory

| ID     | User feedback                                                                                                             | Classification           | Current status                                               | Required outcome                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| FB-001 | Head report showed Page unavailable for your role in a valid head context                                                 | Auth/SSR/session         | Previously fixed in dev fallback path, but must stay covered | Protected SSR layouts must agree with auth.me; valid head/admin sessions render pages                       |
| FB-002 | Dashboard, Weekly Report, Archive, admin/static labels should remain English                                              | UI text policy           | Partially addressed, still needs full static-text audit      | Static chrome stays English; user/business content may be Russian                                           |
| FB-003 | Reminders looked empty or confusing                                                                                       | Product flow/docs        | Not in current focus                                         | Regression must cover reminders visibility and empty-state copy                                             |
| FB-004 | Need pointer cursor and clearer hover affordances                                                                         | UI/UX                    | Partially addressed                                          | Every clickable card/button has stable hover/focus and cursor:pointer                                       |
| FB-005 | Department rename did not apply everywhere                                                                                | Admin/config propagation | Needs regression coverage                                    | Department name updates propagate to report header/context                                                  |
| FB-006 | Hover padding looked uneven on report sections                                                                            | UI layout                | Partially addressed                                          | Hover must not change bounding box or push controls under headings                                          |
| FB-007 | Clicking a dashboard lead should deep-link to that lead's report section                                                  | Navigation               | Partially implemented earlier                                | Link opens report, scrolls to author section, expands it                                                    |
| FB-008 | PDF export button inactive                                                                                                | Feature gate             | Needs full verification                                      | PDF export enabled when report state allows it; disabled state explains why                                 |
| FB-009 | Two nav pills selected at once on /reports?tab=drafts                                                                     | Navigation bug           | Open                                                         | Active nav must consider query tab, not only pathname                                                       |
| FB-010 | Empty products should be grey, collapsed, and not expandable                                                              | Weekly report UI         | Partially addressed                                          | Empty products are muted, collapsed, non-interactive, and do not render empty body copy                     |
| FB-011 | Manual UAT wipe should preserve base users/products/settings but remove report data and assignments when needed           | Data reset               | Partially addressed                                          | Two explicit wipe modes: base-only and seeded-demo; both documented and tested                              |
| FB-012 | Product Status showed Шлюз безопасности for Dmitry because he owns product, but reporting should rely on SDLC assignments | Domain model bug         | Open                                                         | Reporting scope is StageAssignment, not Project.leadId; product owner is metadata/future notifications only |
| FB-013 | Selecting one SDLC stage marks several stages at once                                                                     | Domain model bug         | Open                                                         | Stage status is persisted and edited per reportSectionId, projectId, stageId                                |
| FB-014 | Lead could not switch stage back to On Track                                                                              | State/update bug         | Open                                                         | Status transitions unset/on-track/at-risk/blocked round-trip independently                                  |
| FB-015 | Current/Next/Risk/Decision/Priority cards need stage display                                                              | Domain/UI                | Open                                                         | Cards display selected SDLC stages or All assigned stages                                                   |
| FB-016 | Current/Next/Risk/Decision/Priority need optional multi-stage selection                                                   | Domain/UI                | Open                                                         | Stage selection supports 0..N stages; empty means all assigned stages                                       |
| FB-017 | SDLC Stage should not be required                                                                                         | Schema/UI                | Open                                                         | Field becomes optional; validation allows no stage selection                                                |
| FB-018 | Decision owner field is editable and modal layout breaks                                                                  | UI/domain                | Open                                                         | Owner is read-only/current user by default; layout is stable at desktop/mobile                              |
| FB-019 | Need user action registry/log                                                                                             | Observability/product    | Open                                                         | Persistent audit/action log with user-facing and admin views                                                |
| FB-020 | No cookie should redirect to login/landing, not show skeleton forever                                                     | Auth/UX                  | Open                                                         | Protected pages redirect unauthenticated users to landing/login with next                                   |
| FB-021 | Need logs, timestamps, forms, screenshots in regression evidence                                                          | QA process               | Open                                                         | Every scenario captures console/network/action log/screenshot/video as configured                           |
| FB-022 | Need role-based progressive testing with separate profiles                                                                | QA process               | Open                                                         | Playwright creates isolated contexts for lead/head/admin/viewer/anonymous                                   |
| FB-023 | Need Grafana/Prometheus/log views documented                                                                              | Observability/docs       | Partially planned                                            | Local compose exposes useful dashboards and credentials in docs                                             |
| FB-024 | Need product-ready status, not skipped scenarios                                                                          | Release gate             | Open                                                         | Skips require owner/reason/expiry; product-ready allows zero unexpected skips                               |

## Retrospective: Why Regression Missed This

### 1. The scenario inventory was broad but not invariant-driven

The regression scenario file is large, but many rows are phrased as page renders or button visible. These tests can pass while the domain meaning is wrong. Example: Product Status rendered stages, but the suite did not assert that Dmitry sees exactly the products where Dmitry owns SDLC stages.

Fix: every core domain object must have explicit invariants and negative cases.

### 2. Product ownership and reporting responsibility were conflated

The schema has both:

- Project.leadId: product owner;
- StageAssignment: who is responsible for a stage of a product.

Manual UAT proved these are different business concepts. Regression did not include the negative case:

User owns product A but has no SDLC stage assignment on A. The product must not block that user's report submission.

Fix: reporting tests must use StageAssignment as source of truth. Product owner is for metadata and future notification flows.

### 3. Stage status was modeled as aggregate product status

The current report input has project status at product level. The UI displays stage chips, so the user reasonably expects each chip to be independently editable. Tests did not check round-trip independence.

Fix: add a persistent stage-status model, or equivalent normalized representation, and assert that setting Dev does not mutate Testing/DevOps.

### 4. Role coverage was not isolated enough

Tests covered routes under different roles, but not as a complete product flow with independent browser storage. Manual testing exposed state leakage and SSR/client disagreement risks.

Fix: use separate Playwright storage states and contexts:

- lead-dmitry;
- lead-other;
- head-anton;
- admin;
- viewer;
- anonymous-no-cookie.

### 5. No-cookie behavior was treated as an implementation edge case

The product expectation is clear: unauthenticated users should land on a login/landing page, not a loaded shell with skeletons or a role-forbidden card.

Fix: no-cookie is a P0 journey. Test every protected route in anonymous context.

### 6. Evidence captured screenshots, but not enough interaction proof

Static screenshots do not catch hover displacement, double active nav, or after-click state transitions unless the test measures them.

Fix: for UI surfaces, capture:

- before screenshot;
- hover/focus screenshot;
- bounding box before/after;
- console log;
- network failures;
- user action log events;
- final screenshot.

### 7. Logs existed but were not product-facing or scenario-correlated

The backend has structured audit/mutation logging, but manual UAT needs a user-visible action history and scenario-correlated logs. The existing audit stream is not enough for what did this user press/change and when.

Fix: add persistent UserActionLog and include scenarioId/correlationId in automated tests.

## Domain Model Invariants

These are the rules regression must prove.

### Organization and Users

| Entity     | Invariant                                                   |
| ---------- | ----------------------------------------------------------- |
| User       | Has one role for current session: lead, head, admin, viewer |
| Department | Has name and settings used in UI headers/reports            |
| Role       | Controls route access and action permissions                |
| Session    | SSR and client auth.me must agree                           |

### Products and SDLC

| Entity            | Invariant                                                                 |
| ----------------- | ------------------------------------------------------------------------- |
| Project/Product   | Has owner metadata via leadId; this does not define report responsibility |
| SDLC Stage        | Stable dictionary of stages                                               |
| StageAssignment   | Defines who reports on a product stage                                    |
| StageStatus       | Status is per report section, product, and stage                          |
| Product aggregate | Derived from stage statuses, not edited as a hidden replacement for them  |

### Reports

| Entity               | Invariant                                                                     |
| -------------------- | ----------------------------------------------------------------------------- |
| Report               | Belongs to a period and contains lead sections                                |
| ReportSection        | Belongs to one author and one report                                          |
| Project in lead form | Included only when the author has at least one assigned stage on that project |
| Submit validation    | Validates only assigned products/stages for that author                       |
| Published report     | Read-only and visible according to role rules                                 |
| PDF export           | Available only for valid report states; disabled state is explicit            |

### Report Content

| Entity            | Invariant                                                        |
| ----------------- | ---------------------------------------------------------------- |
| Current Week Item | May apply to all assigned stages or selected stages              |
| Next Week Item    | May apply to all assigned stages or selected stages              |
| Risk              | May apply to all assigned stages or selected stages              |
| Decision          | May apply to all assigned stages or selected stages              |
| Priority          | May apply to all assigned stages or selected stages              |
| Stage selector    | Optional; empty means all assigned stages                        |
| Stage display     | Cards display selected stages, or All assigned stages when empty |

### Observability

| Entity            | Invariant                                                   |
| ----------------- | ----------------------------------------------------------- |
| Audit log         | Security and mutation events are structured and sanitized   |
| User action log   | User-visible actions are persisted with timestamp and actor |
| Scenario evidence | Automated tests capture logs, screenshots, and scenario IDs |

## Required Work Plan

### Phase A - Scope and Source-of-Truth Fixes

**Goal:** make reporting responsibility match the business model.

Tasks:

1. Change lead report read model assembly so products come from StageAssignment for the section author.
2. Keep Project.leadId as product owner metadata only.
3. Update submit validation to validate only products/stages assigned to the section author.
4. Update manual UAT wipe modes:
   - base-only: preserve users, products, stages, department settings; delete reports/content/statuses/assignments;
   - seeded-demo: preserve or recreate known demo assignments for automated tests.
5. Add backend tests for:
   - assigned product appears;
   - product owned by user but without assigned stage does not appear;
   - unassigned product does not block submit;
   - head/admin can still read assembled reports.

Acceptance:

- Dmitry sees DevOps-инструменты when assigned to its stages.
- Dmitry does not see or get blocked by Шлюз безопасности unless he has an assigned stage there.
- Product owner still displays where useful, but does not drive reporting validation.

### Phase B - Per-Stage Status Model

**Goal:** one SDLC stage click changes exactly one stage.

Tasks:

1. Add a persistent representation for stage status:
   - preferred table: StageStatus(reportSectionId, projectId, stageId, status);
   - unique key on reportSectionId, projectId, stageId.
2. Keep product-level status as derived aggregate for overview/report display.
3. Update shared schemas:
   - keep backward compatibility during migration if needed;
   - add stage status input/read model.
4. Update lead UI mapper so each stage reads its own status.
5. Update autosave payload to persist changed stage statuses.
6. Update report overview aggregation:
   - blocked if any assigned stage is blocked;
   - at-risk if any assigned stage is at-risk and none blocked;
   - on-track if all assigned stages are on-track;
   - unset/no content if no assigned stage has content/status.

Acceptance:

- Setting Dev to Blocked does not mark Testing or DevOps.
- Setting Testing back to On Track works after reload.
- Overview colors are derived and stable.

### Phase C - Optional Multi-Stage Tagging

**Goal:** report content can be tied to zero, one, or many SDLC stages.

Tasks:

1. Replace single stageName write path with stageNames: string[].
2. Preserve legacy read fallback from stageName during migration.
3. Make stage selection optional in:
   - Current Week item;
   - Next Week item;
   - Risk/Blocker;
   - Decision;
   - Priority.
4. UI behavior:
   - no selected stage means All assigned stages;
   - selected stages render as compact badges;
   - only stages assigned to current user for that product are selectable.
5. Make Decision owner read-only:
   - default from current session/user directory;
   - do not show it as free text input;
   - keep backend ownership validation.
6. Fix modal layout at desktop and mobile widths.

Acceptance:

- Item with no stage saves and displays as all assigned stages.
- Item with Dev + Testing saves, reloads, and displays both tags.
- Same behavior exists for risks, decisions, and priorities.
- Decision owner cannot be accidentally edited in the modal.

### Phase D - Navigation, Hover, and Static Text Policy

**Goal:** remove manual UAT UI regressions that tests missed.

Tasks:

1. Fix nav active-state logic for query tabs:
   - /reports?tab=drafts activates only My History;
   - /reports?tab=published activates only Archive.
2. Replace remaining misleading Toggle All labels with explicit labels:
   - Expand all;
   - Collapse all.
3. Stabilize hover geometry:
   - no translate that moves cards under section headers;
   - hover uses shadow/border/background only;
   - bounding box is stable before/after hover.
4. Empty product behavior:
   - grey/muted;
   - collapsed;
   - not expandable;
   - no empty body with broken spacing.
5. Static text policy:
   - navigation, tabs, buttons, system labels in English;
   - business/user-entered content can be Russian;
   - add regression assertions for the known static labels.

Acceptance:

- No route shows two active nav items.
- Hover screenshots show no overlap/geometry jump.
- Empty products are visually lower priority and cannot be expanded.

### Phase E - Auth and No-Cookie Flow

**Goal:** unauthenticated users get a clear login path.

Tasks:

1. Define one canonical unauthenticated behavior:
   - protected SSR page with no session redirects to landing/login with next;
   - forbidden page is only for authenticated user with wrong role.
2. Update Next layouts/server helpers to avoid indefinite skeleton states.
3. Dev login:
   - landing login can route to dev login in dev mode;
   - default dev login role is explicit and documented;
   - no accidental admin impersonation without clear dev-only behavior.
4. Add tests for every protected surface:
   - /lead/report;
   - /head/dashboard;
   - /head/report/...;
   - /admin;
   - /reports?....

Acceptance:

- Anonymous context redirects to landing/login.
- Wrong-role authenticated context sees forbidden page.
- Valid role context loads the page.

### Phase F - Persistent User Action Log

**Goal:** make user actions traceable for debugging, support, and audits.

Tasks:

1. Add database table, suggested name UserActionLog:
   - id;
   - createdAt;
   - userId;
   - role;
   - action;
   - entityType;
   - entityId;
   - route;
   - correlationId;
   - scenarioId nullable;
   - source: client or server;
   - metadata JSONB, sanitized.
2. Event taxonomy:
   - auth.login;
   - auth.logout;
   - nav.open;
   - ui.click;
   - report.autosave;
   - report.stage_status.changed;
   - report.item.created;
   - report.item.updated;
   - report.risk.created;
   - report.decision.created;
   - report.priority.updated;
   - report.submit.opened;
   - report.submit.confirmed;
   - report.version.restored;
   - pdf.export.requested;
   - admin.stage_assignment.changed;
   - admin.department.updated;
   - admin.user.updated.
3. Backend:
   - extend mutation audit or add action-log service;
   - never store secrets, tokens, raw SAML, or oversized content;
   - store safe summaries and entity references.
4. Frontend:
   - log high-value clicks and route opens;
   - include correlation ID in requests.
5. UI:
   - My Activity or Log for a lead to see own actions;
   - Admin > Logs for admin/head filters.
6. Tests:
   - every critical scenario asserts expected action log rows.

Acceptance:

- Manual tester can answer what did I click/save and when from UI.
- Automated evidence ties screenshots to action-log rows via scenarioId.

### Phase G - Regression Harness v2

**Goal:** turn feedback into repeatable product-ready proof.

Tasks:

1. Build a scenario manifest:
   - one row per scenario;
   - id, role, route, fixture, action, assertions, evidence artifacts;
   - no unowned skips.
2. Isolated Playwright profiles:
   - lead-dmitry.storageState.json;
   - lead-other.storageState.json;
   - head-anton.storageState.json;
   - admin.storageState.json;
   - viewer.storageState.json;
   - anonymous context with no storage.
3. Before each scenario group:
   - run the correct wipe mode;
   - seed only the needed fixture;
   - record seed summary.
4. Evidence per scenario:
   - screenshot before;
   - screenshot after;
   - screenshot on hover/focus when relevant;
   - browser console JSON;
   - network failures JSON;
   - action-log export JSON;
   - server log slice with timestamp/correlation ID.
5. Add visual assertions:
   - bounding boxes for hover geometry;
   - active nav count;
   - disabled/enabled button state;
   - empty product non-expandability.
6. Add log assertions:
   - zero unexpected console errors;
   - zero 5xx network responses;
   - expected action events present.

Acceptance:

- Regression does not just produce screenshots; it fails on broken domain state, bad hover geometry, bad logs, or wrong role behavior.

### Phase H - Observability and Local Product-Ready Stack

**Goal:** local environment is enough for manual UAT and future Kubernetes portability.

Tasks:

1. Keep Docker Compose as the source for local product stack:
   - web;
   - api;
   - PostgreSQL;
   - Redis;
   - MailHog or compatible test SMTP;
   - Prometheus;
   - Grafana;
   - log viewer or structured log export.
2. Document credentials, ports, and dashboards.
3. Add baseline metrics:
   - API request count/latency;
   - tRPC procedure count/latency;
   - job queue depth;
   - PDF export duration/errors;
   - DB health;
   - Redis health.
4. Add useful Grafana dashboards:
   - API health;
   - report flow;
   - background jobs;
   - errors/log volume.
5. Ensure logs include correlation IDs and can be filtered by scenario ID.

Acceptance:

- A new developer can run one documented command and see app, health, email sink, metrics, logs, and dashboards.

## Regression Scenario Additions

These must be added as executable tests, not only documentation.

### Domain Scope

| ID            | Role  | Scenario                                           | Expected                                                         |
| ------------- | ----- | -------------------------------------------------- | ---------------------------------------------------------------- |
| DOM-STAGE-001 | lead  | User has product ownership but no stage assignment | Product does not appear in lead report and does not block submit |
| DOM-STAGE-002 | lead  | User has three stages on one product               | Only that product appears, with exactly three assigned stages    |
| DOM-STAGE-003 | lead  | User changes Dev only                              | Testing and DevOps remain unchanged                              |
| DOM-STAGE-004 | lead  | User changes Testing back to On Track              | Testing persists independently after reload                      |
| DOM-STAGE-005 | head  | Head opens assembled report                        | Sees derived product aggregate from stage statuses               |
| DOM-STAGE-006 | admin | Admin changes stage assignment                     | Lead report scope changes after reload                           |

### Content Stage Tags

| ID          | Role | Scenario                                    | Expected                                           |
| ----------- | ---- | ------------------------------------------- | -------------------------------------------------- |
| DOM-TAG-001 | lead | Create current item with no stages selected | Item saves and displays All assigned stages        |
| DOM-TAG-002 | lead | Create current item with Dev + Testing      | Item displays both stage tags                      |
| DOM-TAG-003 | lead | Create next item with DevOps only           | Item displays DevOps tag                           |
| DOM-TAG-004 | lead | Create risk with no stages selected         | Risk applies to all assigned stages                |
| DOM-TAG-005 | lead | Create decision with two stages             | Decision displays both tags and owner is read-only |
| DOM-TAG-006 | lead | Create priority with one stage              | Priority displays selected stage                   |

### Roles and Sessions

| ID           | Role      | Scenario                 | Expected                            |
| ------------ | --------- | ------------------------ | ----------------------------------- |
| ROLE-CTX-001 | anonymous | Open /head/dashboard     | Redirect to landing/login with next |
| ROLE-CTX-002 | lead      | Open /head/dashboard     | Authenticated forbidden page        |
| ROLE-CTX-003 | head      | Open /head/dashboard     | Dashboard loads                     |
| ROLE-CTX-004 | admin     | Open /admin              | Admin loads                         |
| ROLE-CTX-005 | viewer    | Open /admin              | Authenticated forbidden page        |
| ROLE-CTX-006 | anonymous | Open /reports?tab=drafts | Redirect to landing/login           |

### UI Geometry

| ID         | Role | Scenario                          | Expected                                                  |
| ---------- | ---- | --------------------------------- | --------------------------------------------------------- |
| UI-GEO-001 | head | Hover a portfolio card            | Bounding box top/height unchanged; no overlap with header |
| UI-GEO-002 | lead | Open /reports?tab=drafts          | Exactly one nav item active                               |
| UI-GEO-003 | lead | Open /reports?tab=published       | Exactly one nav item active                               |
| UI-GEO-004 | head | Empty product in assembled report | Muted, collapsed, no expand button/body                   |
| UI-GEO-005 | lead | Decision modal at desktop width   | Owner display and fields do not overlap                   |
| UI-GEO-006 | lead | Decision modal at mobile width    | Fields stack without clipping                             |

### Logs and Evidence

| ID         | Role  | Scenario               | Expected                                                           |
| ---------- | ----- | ---------------------- | ------------------------------------------------------------------ |
| LOG-EV-001 | lead  | Create item            | report.item.created action log row with timestamp                  |
| LOG-EV-002 | lead  | Change stage status    | report.stage_status.changed row with old/new status                |
| LOG-EV-003 | lead  | Submit report          | submit opened and confirmed events exist                           |
| LOG-EV-004 | admin | Change assignment      | admin action log row exists                                        |
| LOG-EV-005 | any   | Scenario run completes | console log has no unexpected errors; network has no 5xx           |
| LOG-EV-006 | any   | Scenario run completes | evidence folder includes screenshots and logs named by scenario ID |

## Product-Ready Gate

Product-ready can be declared only when all of these are true:

1. Working tree contains only intentional, reviewed changes.
2. Domain fixes are implemented:
   - reporting scope from StageAssignment;
   - per-stage status persistence;
   - optional multi-stage content tags;
   - product owner no longer blocks reporting.
3. UI fixes are implemented:
   - single active nav item;
   - stable hover geometry;
   - empty products muted and non-expandable;
   - static text policy checked.
4. Auth fixes are implemented:
   - anonymous redirect;
   - wrong-role forbidden;
   - valid-role render.
5. Observability exists:
   - persistent user action log;
   - scenario-correlated logs;
   - local metrics/log dashboard documented.
6. Automated gates pass:
   - rtk pnpm lint;
   - rtk pnpm test;
   - rtk pnpm build;
   - API integration tests;
   - Playwright role matrix;
   - visual/hover assertions;
   - log/evidence assertions.
7. Skips are controlled:
   - zero unexpected skips;
   - every intentional skip has owner, reason, and expiry.
8. Evidence is archived under .planning/regression/evidence/<run-id>/.
9. graphify update . is run after code changes.
10. Final diff is committed atomically and pushed only after the gate is green.

## Immediate Execution Order

1. Freeze and classify current diff.
2. Decide whether to keep prior polish changes or split them into a separate commit.
3. Implement Phase A and Phase B first; they are the root domain bugs.
4. Implement Phase C because it changes schema and all content dialogs.
5. Implement Phase D/E for the visible UAT failures.
6. Implement Phase F action log.
7. Implement Phase G regression harness.
8. Run full gate and evidence capture.
9. Update planning state and graph.
10. Commit and push.

## Notes for Future Work

- Full i18n can be a separate milestone. Current rule is simpler: static UI chrome in English, business content can be Russian.
- Product owner notifications are useful later, but should not affect current weekly reporting validation.
- PDF export, reminders, Grafana dashboards, and Kubernetes readiness remain product-ready-adjacent gates. They must be either completed or explicitly scoped as non-blocking before release.
