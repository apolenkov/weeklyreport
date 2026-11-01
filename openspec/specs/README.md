# WeeklyReport capability map

This index maps every durable capability to one canonical home. Product capabilities are organized by the primary user outcome and lifecycle stage; role tags name every role that experiences the behavior. Mixed capabilities stay in Product when the user outcome is primary. Architecture, security, operations, data integrity, testing, and repository rules live under Engineering governance.

## Product capabilities

### Shared

#### Configure

- [landing-page-hero](./landing-page-hero/spec.md) — The public landing hero presents the Weekly Report brand and rotates curated taglines without layout shift or decorative motion. `[roles: Shared]`
- [saml-provisioning](./saml-provisioning/spec.md) — First SAML login creates a least-privilege viewer while later logins never overwrite locally governed identity or access fields. `[roles: Shared, Admin]`
- [ui-role-route-access](./ui-role-route-access/spec.md) — Role denials use one in-page wall and return each visitor to the correct role home without redundant nested gates. `[roles: Lead, Head, Viewer, Admin]`
- [user-name-display](./user-name-display/spec.md) — Each surface uses its canonical full or short user-name form, including cross-author owner labels. `[roles: Lead, Head, Viewer, Admin]`
- [route-error-recovery](./route-error-recovery/spec.md) — Route and global error boundaries expose consistent recovery without promising unverified data preservation. `[roles: Lead, Head, Viewer, Admin]`
- [route-query-normalization](./route-query-normalization/spec.md) — Optional route query values remain scalar and predictable for deep links and repeated-parameter fallbacks. `[roles: Lead, Head, Viewer, Admin]`

#### Prepare

- [archive-history-ia](./archive-history-ia/spec.md) — Navigation distinguishes current-report history from the archive of past closed reports. `[roles: Lead, Head, Viewer, Admin]`
- [report-routing](./report-routing/spec.md) — Report URLs carry stable path-segment identifiers so bookmarks and history resolve the intended report. `[roles: Lead, Head, Viewer, Admin]`
- [stage-label-canonicalization](./stage-label-canonicalization/spec.md) — Stored stage identifiers and displayed record labels stay aligned to the canonical stage vocabulary. `[roles: Lead, Head, Viewer, Admin]`
- [status-presentation-model](./status-presentation-model/spec.md) — One model owns canonical status vocabulary, tones, icons, dots, badges, and empty states. `[roles: Lead, Head, Viewer, Admin]`
- [ui-control-density](./ui-control-density/spec.md) — Grouped controls share a target height, compact actions keep a 44 px touch floor, and pipeline arrows align without bypassing visual review. `[roles: Lead, Head, Admin]`

#### Draft

- [authenticated-product-feedback](./authenticated-product-feedback/spec.md) — Authenticated users capture contextual or page-level feedback while server-owned identity, role scope, diagnostics, inbox actions, and annotation deep links stay protected. `[roles: Lead, Head, Viewer, Admin]`
- [feedback-capture-and-lifecycle](./feedback-capture-and-lifecycle/spec.md) — Defines bounded role-scoped feedback capture, inbox triage, explicit lifecycle actions, safe dismissal, durable admin deletion and focus handling after removal. `[roles: Lead, Head, Viewer, Admin]`
- [agentation-integration](./agentation-integration/spec.md) — Defines how the Agentation toolbar, submission confirmation, event stream and thread ordering behave over the PostgreSQL-backed feedback adapter. `[roles: Lead, Head, Viewer, Admin]`
- [dialog-listbox-a11y](./dialog-listbox-a11y/spec.md) — Dialogs, period listboxes, popups, and expanders share correct focus, close, and ARIA behavior. `[roles: Lead, Head, Viewer, Admin]`
- [shared-confirm-delete-dialog](./shared-confirm-delete-dialog/spec.md) — The shared confirm-delete dialog confirms once while pending, keeps focus inside the panel, describes its consequence and ignores a disconnected trigger. `[roles: Lead, Head, Admin]`
- [list-empty-state-fidelity](./list-empty-state-fidelity/spec.md) — Filtered-list counts and empty states derive from the same rows the user can see. `[roles: Lead, Head, Viewer, Admin]`
- [report-badge-resolution](./report-badge-resolution/spec.md) — Risk and decision badges resolve product names report-wide instead of falling back to Unknown. `[roles: Lead, Head, Viewer, Admin]`
- [dashboard-record-count](./dashboard-record-count/spec.md) — Review-dashboard totals count each persisted product item, risk, and decision exactly once. `[roles: Head, Admin]`
- [weekly-progress-denominator](./weekly-progress-denominator/spec.md) — Head and Admin see one weekly submission-progress figure computed over the period's expected active leads. `[roles: Head, Admin]`
- [report-toolbar-layout](./report-toolbar-layout/spec.md) — Header actions and context controls remain stable, grouped, reachable, and accessible across roles and viewport widths. `[roles: Lead, Head, Viewer, Admin]`
- [compact-overflow-containment](./compact-overflow-containment/spec.md) — Dense report content stays usable without horizontal overflow. `[roles: Lead, Head, Viewer, Admin]`
- [desktop-surface-composition](./desktop-surface-composition/spec.md) — Desktop report surfaces preserve their intended composition and hierarchy. `[roles: Lead, Head, Viewer, Admin]`
- [loading-layout-stability](./loading-layout-stability/spec.md) — Loading states reserve the layout needed by the eventual report surface. `[roles: Lead, Head, Viewer, Admin]`
- [main-content-focus-presentation](./main-content-focus-presentation/spec.md) — Main content focus remains visible and correctly presented. `[roles: Lead, Head, Viewer, Admin]`
- [stage-step-shared-component](./stage-step-shared-component/spec.md) — Stage steps share one consistent accessible presentation. `[roles: Lead]`

#### Consume/Search

- [analytics-query-correctness](./analytics-query-correctness/spec.md) — Analytics results and cache keys stay correct under lead scoping, republished periods, and nested inputs. `[roles: Head, Admin]`
- [pdf-export-integrity](./pdf-export-integrity/spec.md) — PDF export state, generation, access and delivery integrity; render readiness, recovery and client status are in the split pdf-export-* capabilities. `[roles: Lead, Head, Viewer, Admin]`
- [pdf-export-render-readiness](./pdf-export-render-readiness/spec.md) — Defines how the print template, the PDF worker and the printed layout prove a report rendered completely before it is captured and mapped onto job outcomes. `[roles: Lead, Head, Viewer, Admin]`
- [pdf-export-state-integrity](./pdf-export-state-integrity/spec.md) — Defines how terminal queue states, completion persistence and artifact publication stay consistent, immutable and fail closed for every PDF export row. `[roles: Lead, Head, Viewer, Admin]`
- [pdf-export-recovery-generations](./pdf-export-recovery-generations/spec.md) — Defines the monotonic export generation, quarantine of aged pending exports and the Head-only retry and recovery listing that depend on it. `[roles: Lead, Head, Viewer, Admin]`
- [pdf-export-client-status](./pdf-export-client-status/spec.md) — Defines how the export button recovers from status-query errors, keeps polling to a terminal result, survives a control remount and opens no blank tab. `[roles: Lead, Head, Viewer, Admin]`
- [trends-query-window](./trends-query-window/spec.md) — Trends derives its date window from the current date and shows an explicit empty state when no results exist. `[roles: Head, Admin]`
- [trends-chart-semantics](./trends-chart-semantics/spec.md) — Trends shows history, lead submissions and comparison as accessible tables with status badges, full period dates and keyboard-scrollable regions. `[roles: Head, Admin]`

### Lead

#### Prepare

- [carry-over-automation](./carry-over-automation/spec.md) — Unfinished prior-period work carries into the next period through one race-safe automatic write. `[roles: Lead]`
- [lead-form-data-loading](./lead-form-data-loading/spec.md) — One tested hook owns lead-form queries, enablement, visibility gating, cache purges, and redirects. `[roles: Lead]`

#### Draft

- [activity-reporting-unit](./activity-reporting-unit/spec.md) — Activity-parented records, links, and derived status behave consistently across lead, slide, head-report, and admin surfaces without changing product health. `[roles: Lead, Head, Admin]`
- [tracked-work-continuation](./tracked-work-continuation/spec.md) — Leads continue and develop the same tracked work across weekly report projections while results, comments and published history are preserved. `[roles: Lead]`
- [weekly-activity-presentation](./weekly-activity-presentation/spec.md) — A lead describes an Activity for a report week without changing the shared catalogue or another report's published presentation. `[roles: Lead]`
- [lead-dialog-lifecycle](./lead-dialog-lifecycle/spec.md) — Editable lead sections share one dialog lifecycle so view transitions cannot reopen or strand editors. `[roles: Lead]`
- [lead-form-cross-author-scope](./lead-form-cross-author-scope/spec.md) — The cross-author lens never reveals more than the curated Everyone scope. `[roles: Lead]`
- [lead-form-draft-merges](./lead-form-draft-merges/spec.md) — Draft merges preserve record identity, quick-add behavior, and blocker routing behind one tested boundary. `[roles: Lead]`
- [lead-form-draft-orchestration](./lead-form-draft-orchestration/spec.md) — Draft state and optimistic-lock versions stay current, with stale conflicts refetched and explained. `[roles: Lead]`
- [lead-form-overview-activation](./lead-form-overview-activation/spec.md) — Defines how Overview acknowledgements, asynchronous writes and lineage responses stay bound to the section activation and report that issued them. `[roles: Lead]`
- [lead-form-loaded-view-model](./lead-form-loaded-view-model/spec.md) — One view model derives cross-author visibility, activity alarms, and loaded lead-form affordances. `[roles: Lead]`
- [lead-form-write-actions](./lead-form-write-actions/spec.md) — Lead writes share one action boundary while preserving conflicts, optimistic locking, and user-visible side effects. `[roles: Lead]`
- [lead-item-card-uniformity](./lead-item-card-uniformity/spec.md) — Lead item cards keep uniform height and expose truncated content through a full-text tooltip. `[roles: Lead]`
- [lead-plan-verdict](./lead-plan-verdict/spec.md) — Each prior-week planned item gets a one-action verdict recorded on the selected week without editing the prior week, with confirm-all and a review counter. `[roles: Lead]`
- [lead-pipeline-card](./lead-pipeline-card/spec.md) — Product health remains risk-derived and distinct from the lead's own stage completeness; Mine-scope lives in lead-pipeline-mine-scope. `[roles: Lead]`
- [lead-pipeline-mine-scope](./lead-pipeline-mine-scope/spec.md) — Defines which stages the lead pipeline shows in Mine mode, how the completeness counter labels them and which unassigned stages it excludes. `[roles: Lead]`
- [lead-report-controls-integrity](./lead-report-controls-integrity/spec.md) — Lead report controls avoid no-ops, accidental dialogs, clipped popovers, stale busy states, and mismatched summary populations. `[roles: Lead]`
- [unified-report-authoring](./unified-report-authoring/spec.md) — Lead report authoring keeps inline editing, lineage, recovery, and progress semantics coherent across sections. `[roles: Lead]`
- [lead-report-health-pulse](./lead-report-health-pulse/spec.md) — A read-only, problem-first pulse opens contextual unit health without interrupting report authoring. `[roles: Lead]`
- [lead-status-overview](./lead-status-overview/spec.md) — Lead Overview groups reporting units clearly and keeps the reading grid, temporal sources and canonical health vocabulary coherent. `[roles: Lead]`
- [lead-status-overview-actions](./lead-status-overview-actions/spec.md) — Lead Overview edits and creates Current and Next items through one canonical editor, composer and progress-interaction path. `[roles: Lead]`
- [lead-product-accordion-identity](./lead-product-accordion-identity/spec.md) — Repeated lead-scope product accordions keep stable, instance-local accessible identity. `[roles: Lead]`
- [lead-surface-name-resolution](./lead-surface-name-resolution/spec.md) — Lead cards resolve every report-known product name without placeholder fallback. `[roles: Lead]`
- [record-dialog-layout](./record-dialog-layout/spec.md) — Item, risk, and decision editors share one consistent two-column layout. `[roles: Lead]`
- [record-status-derivation](./record-status-derivation/spec.md) — Item alarms derive from covering risks while blocker creation, escalation counts and week-placement moves stay coherent. `[roles: Lead, Head]`
- [item-progress-lifecycle](./item-progress-lifecycle/spec.md) — One stored item progress vocabulary governs pause reasons and inline Overview status resolution across week placements. `[roles: Lead, Head]`
- [risk-stage-integrity](./risk-stage-integrity/spec.md) — Product-parented risks and report records carry concrete stages; activity-parented records carry none. `[roles: Lead, Head]`
- [status-risk-unification](./status-risk-unification/spec.md) — Risk rows are the source of at-risk and blocked stage state, completeness floors, item alarms, and product escalation. `[roles: Lead, Head]`

#### Submit

- [lead-completion-guidance](./lead-completion-guidance/spec.md) — A compact end-of-form summary explains whether submission is possible, what to fix, and which unset statuses will become On Track. `[roles: Lead]`
- [report-section-write-gates](./report-section-write-gates/spec.md) — Save, submit, and revoke writers decide editability from canonical period and archive state and reject concurrent closure. `[roles: Lead]`

#### Consume/Search

- [lead-report-assistant](./lead-report-assistant/spec.md) — Leads ask bounded questions over authorized report evidence through a grounded, fail-closed assistant. `[roles: Lead]`
- [lead-history-summary](./lead-history-summary/spec.md) — Lead history is period-ordered, aggregates only completed periods, and never fabricates a missing submission for compiled reports. `[roles: Lead]`
- [lead-slide-by-product-grid](./lead-slide-by-product-grid/spec.md) — One auto-height by-product slide article renders lead, head, and viewer content with priorities, contributors, stages, and full record order. `[roles: Lead, Head, Viewer]`
- [by-lead-referenced-content](./by-lead-referenced-content/spec.md) — Read-only by-lead reports preserve referenced-product contributions without changing ownership or mixing authors. `[roles: Lead, Head, Viewer]`
- [slide-inline-record-editing](./slide-inline-record-editing/spec.md) — Leads edit or delete their own slide rows through the existing form write path while read-only rows ignore activation. `[roles: Lead]`
- [status-slide-rendering](./status-slide-rendering/spec.md) — Lead slides preserve fullscreen exit, Mine/Everyone scope, row-state language, and selected-index safety. `[roles: Lead, Head, Viewer]`

#### Archive/Reopen

- [reopen-requests](./reopen-requests/spec.md) — A lead can file one scoped request for a head or admin to decide race-safely from the dashboard. `[roles: Lead, Head, Admin]`

### Head

#### Review

- [head-dashboard-clarity](./head-dashboard-clarity/spec.md) — The dashboard emphasizes triage through one activity feed, compact period summaries, actionable reminders, and deduplicated product-grouped risks. `[roles: Head, Admin]`
- [head-report-visibility](./head-report-visibility/spec.md) — Heads see live drafts before submission while submission continues to gate publish and rollback. `[roles: Head, Admin]`
- [report-card-clarity](./report-card-clarity/spec.md) — Product cards remain scannable, scope-correct, aligned, owner-attributed, and free of duplicated attention signals. `[roles: Lead, Head, Viewer]`
- [review-verdict-integrity](./review-verdict-integrity/spec.md) — Every verdict records the reviewed section version and rejects concurrent resubmission races. `[roles: Head, Admin]`

#### Publish

- [period-lifecycle-ui](./period-lifecycle-ui/spec.md) — Only heads and admins receive confirmed publish and reopen controls backed by canonical period status. `[roles: Head, Admin]`
- [review-acknowledge-placement](./review-acknowledge-placement/spec.md) — Review acknowledgement sits inside publish-and-lock as supporting context rather than a separate gate. `[roles: Head, Admin]`

#### Consume/Search

- [head-slide-density](./head-slide-density/spec.md) — Head deck chrome adds carousel navigation, fullscreen exit, and single status presentation around the shared slide article. `[roles: Head, Admin, Viewer]`
- [head-surface-parity](./head-surface-parity/spec.md) — Head slides, dashboard, and report toolbar remove redundant chrome while sharing the report control vocabulary. `[roles: Head, Admin]`
- [dashboard-interaction-stability](./dashboard-interaction-stability/spec.md) — Dashboard interactions keep their controls stable and actionable. `[roles: Head, Admin]`

### Viewer

#### Consume/Search

- [viewer-report-navigation](./viewer-report-navigation/spec.md) — Viewer Status resolves to the current allowed report, defaults live content to submitted sections, and exposes an explicit Show all control. `[roles: Viewer]`
- [viewer-published-search](./viewer-published-search/spec.md) — Viewer Search returns only published content the viewer can open and routes results inside the viewer surface. `[roles: Viewer]`

Authority model:

- `viewer-report-navigation` defines Status authority and the live submission-state boundary: submitted by default, Show all only for the current period.
- `viewer-published-search` keeps Search authority published-only.
- The durable specifications above are the complete authority contract; this index does not duplicate their requirements.

### Admin

#### Configure

- [ai-prompt-management](./ai-prompt-management/spec.md) — Admin-managed feature prompt revisions remain typed, immutable, versioned, and fail closed at runtime. `[roles: Admin]`
- [ai-provider-configuration](./ai-provider-configuration/spec.md) — One organization-wide AI provider follows an administrator-only draft, test, activation, disable, and restore lifecycle. `[roles: Admin]`
- [ai-provider-admin-layout](./ai-provider-admin-layout/spec.md) — The top-level Admin AI surface keeps provider configuration compact, accessible, aligned, responsive, and free of horizontal overflow. `[roles: Admin]`
- [admin-dialog-focus-management](./admin-dialog-focus-management/spec.md) — Admin CRUD dialogs move focus inside on open and restore it to the initiating control on close. `[roles: Admin]`
- [admin-reminders-ui](./admin-reminders-ui/spec.md) — Admins configure reminder policies through plain-language cards, inline editing, presets, and explicit permanent removal. `[roles: Admin]`
- [admin-settings-ui](./admin-settings-ui/spec.md) — Admin Settings provides honest live policy controls and resilient unsaved form state. `[roles: Admin]`
- [admin-navigation-responsive](./admin-navigation-responsive/spec.md) — Defines Admin tab and primary navigation, Settings secondary navigation and the responsive access to operational alerts and records on every supported viewport. `[roles: Admin]`
- [admin-snapshot-restore](./admin-snapshot-restore/spec.md) — Admin snapshot restore recovers selected admin entities, reminder delivery state, and immutable published report documents while preserving reporting-group head assignments. `[roles: Admin]`
- [admin-stage-assignment](./admin-stage-assignment/spec.md) — Stage-to-lead assignment saves atomically against the composite uniqueness rule. `[roles: Admin]`
- [slide-capacity-signals](./slide-capacity-signals/spec.md) — Product assignment warns an admin when a lead's ownership load becomes presentation-heavy. `[roles: Admin]`
- [admin-user-group-form](./admin-user-group-form/spec.md) — Admin user forms preserve explicit group absence while keeping role-specific validation and payloads consistent. `[roles: Admin]`
- [structured-user-name](./structured-user-name/spec.md) — Admin-managed surname, given name, patronymic, display name, short form, and initials derive consistently. `[roles: Admin, Shared]`
- [user-position](./user-position/spec.md) — Admins maintain a user's job title in the contract, table, and edit form. `[roles: Admin]`

#### Prepare

- [reliable-reminder-delivery](./reliable-reminder-delivery/spec.md) — Reminder retries use atomic claims and surface uncertain SMTP delivery explicitly under worker and database failures. `[roles: Admin, Lead, Head]`

## Engineering governance

### Architecture and module boundaries

- [module-import-boundaries](./module-import-boundaries/spec.md) — Keeps API modules and web slices on facade entrypoints and the domain layer free of infrastructure imports.
- [auth-module-layering](./auth-module-layering/spec.md) — Keeps authentication ownership narrow and delegates period creation to the sanctioned lifecycle writer.
- [api-shutdown-coordination](./api-shutdown-coordination/spec.md) — Coordinates API termination, fatal-error handling, ordered resource draining, and one bounded exit outcome.
- [api-boot-failure-capture](./api-boot-failure-capture/spec.md) — Captures a pre-bootstrap failure with Sentry before the bounded telemetry drain, keeping exit code 1 on every path.
- [api-logger-transport](./api-logger-transport/spec.md) — Isolates AppLogger calls from standard-stream and OTel transport failures so a log call never throws into its caller.
- [queue-worker-architecture](./queue-worker-architecture/spec.md) — Standardizes BullMQ worker bases and gives queue job defaults one production source.
- [report-section-prisma-payload](./report-section-prisma-payload/spec.md) — Types report-section mapping and post-save reads from generated Prisma payloads without nullable drift.
- [role-type](./role-type/spec.md) — Keeps role vocabulary, database enum, labels, and membership guards on shared sources of truth.
- [web-model-type-boundary](./web-model-type-boundary/spec.md) — Types web presentation modules against real domain models rather than mock or retired modules.
- [web-shared-idioms](./web-shared-idioms/spec.md) — Centralizes shared card chrome, chevrons, date formatting, role routing, and report-shell URL state.

### Security and authorization

- [authorized-report-retrieval](./authorized-report-retrieval/spec.md) — The Lead Report Assistant validates one strict search plan and applies server-owned period and authorization boundaries before projection.
- [destructive-db-guard](./destructive-db-guard/spec.md) — Allows destructive developer flows only for exact loopback disposable database names with explicit per-run consent; production restore stays separate.
- [jwt-session-integrity](./jwt-session-integrity/spec.md) — Pins JWT verification algorithms, enforces secret strength, and documents stateless logout semantics.
- [prod-security-hardening](./prod-security-hardening/spec.md) — Enforces production CSP, immutable base-image digests, and safe dev-auth build defaults.
- [public-endpoint-resource-limits](./public-endpoint-resource-limits/spec.md) — Bounds unauthenticated API request rate and body size per public ingress surface.
- [repository-scope-guard](./repository-scope-guard/spec.md) — Repositories fail closed when a read attempts to cross the caller's authorized product-group scope.
- [repository-security-controls](./repository-security-controls/spec.md) — Keeps automated checks least-privileged, requires explicit ownership of sensitive repository paths, and preserves a tested private vulnerability-response path.
- [role-coverage-gate](./role-coverage-gate/spec.md) — Requires every tRPC procedure to use one of the canonical middleware builders by reference identity.
- [role-model-consistency](./role-model-consistency/spec.md) — Keeps route role declarations aligned with the API authorization gate.
- [section-save-payload-bounds](./section-save-payload-bounds/spec.md) — Applies the shared array-size bound to every client-supplied section-save collection.
- [session-endpoint-hardening](./session-endpoint-hardening/spec.md) — Protects logout and cache revalidation from cross-origin or unauthorized use and redirects only after confirmed logout.

### Observability, reliability, and performance

- [api-health-indicators](./api-health-indicators/spec.md) — Keeps readiness and liveness probes on supported Terminus APIs with stable dependency details and HTTP semantics.
- [client-error-policy](./client-error-policy/spec.md) — Routes query load failures through one exactly-once reporting seam with consistent retry and message behavior.
- [error-trace-correlation](./error-trace-correlation/spec.md) — Correlates request, browser, queue, worker, and redacted application logs with one trace context.
- [hot-path-query-performance](./hot-path-query-performance/spec.md) — Parallelizes independent reads, batches ownership and reconciliation, paginates archives, and removes write-on-read hot paths.
- [lead-assistant-provider-resilience](./lead-assistant-provider-resilience/spec.md) — Bounds assistant context and provider retries while returning deterministic recovery outcomes without automatic failover.
- [manual-publish-telemetry](./manual-publish-telemetry/spec.md) — Emits publish counters only after a successful manual transition and records the real prior state.
- [operational-logger-wiring](./operational-logger-wiring/spec.md) — Injects the shared operational logger into service providers as a required dependency.
- [period-scheduler-wiring](./period-scheduler-wiring/spec.md) — Makes scheduler composition executable, rejects overlapping periods under concurrency, and emits committed transition audit events.
- [prod-trace-sampling](./prod-trace-sampling/spec.md) — Configures production OTLP export, parent-aware sampling, and loud untraced boot logging.
- [queue-reliability-monitoring](./queue-reliability-monitoring/spec.md) — Monitors DLQs, Redis memory, retention, and queue shutdown behavior.
- [scope-accessed-audit](./scope-accessed-audit/spec.md) — Audits legitimate cross-group weekly-report reads without changing returned data.
- [audit-target-coverage](./audit-target-coverage/spec.md) — Audited operations cover the intended event targets.
- [observability-metrics-coverage](./observability-metrics-coverage/spec.md) — Operational metrics use bounded names and cover the required runtime paths.
- [web-loading-performance](./web-loading-performance/spec.md) — Web loading behavior keeps critical surfaces responsive.

### Deployment and configuration

- [deploy-caddy-config](./deploy-caddy-config/spec.md) — Defines the production proxy security headers and API routing behavior.
- [deploy-kubernetes-chart](./deploy-kubernetes-chart/spec.md) — Defines the Helm chart for the Kubernetes deployment.
- [deploy-healthchecks](./deploy-healthchecks/spec.md) — Exercises real PgBouncer and API dependency paths rather than process-only liveness.
- [pdf-renderer-service](./pdf-renderer-service/spec.md) — Bounds the internal Gotenberg renderer: HTTP contract, readiness gating, credential transport, egress to the print origin, and deployment posture.
- [env-schema-coverage](./env-schema-coverage/spec.md) — Declares every consumed environment variable, removes silent defaults, and fails boot when mandatory production config is missing.
- [operations-local-readiness](./operations-local-readiness/spec.md) — Keeps repository-owned operations instructions executable and fails closed without external production read-back.
- [local-stand-provisioning](./local-stand-provisioning/spec.md) — Provisions the local stand atomically and preserves relationships during sequential replay.
- [redis-connection-config](./redis-connection-config/spec.md) — Routes all Redis consumers through one validated, fail-loud host and port builder.
- [sdlc-release-readiness](./sdlc-release-readiness/spec.md) — Separates evidence classes and keeps the first production point blocked until every external release, deployment, operation, and recovery control is proven.
- [web-api-url-config](./web-api-url-config/spec.md) — Resolves the web API base URL and tRPC response decoding through explicit fail-loud seams.
- [web-env-validation](./web-env-validation/spec.md) — Validates client environment values at build time and centralizes typed, inline-safe access.
- [deploy-config-integrity](./deploy-config-integrity/spec.md) — Deployment configuration remains complete, explicit, and internally consistent.
- [reset-script-redis-flush](./reset-script-redis-flush/spec.md) — Destructive Redis reset is restricted to the guarded logical database.
- [smtp-transport-security](./smtp-transport-security/spec.md) — SMTP transport configuration keeps delivery credentials and transport secure.

### Data integrity and schema

- [enum-state-hygiene](./enum-state-hygiene/spec.md) — Requires every persisted enum state to have a writer or be removed.
- [period-dual-state](./period-dual-state/spec.md) — Requires the canonical Report period state and companion lifecycle tuple to change atomically through sanctioned lifecycle writers.
- [prisma-unique-violation-guard](./prisma-unique-violation-guard/spec.md) — Centralizes constraint-aware Prisma unique-violation detection and proves it against the real adapter shape.
- [publish-compare-and-set](./publish-compare-and-set/spec.md) — Publishes through one guarded compare-and-set and builds snapshots from a fresh in-transaction read.
- [report-delete-integrity](./report-delete-integrity/spec.md) — Deletes only lifecycle-eligible reports through one atomic guard and preserves data when publication wins a race.
- [reopen-compare-and-set](./reopen-compare-and-set/spec.md) — Guards reopen and manual archive transitions against zero-row and concurrent-writer races.
- [schema-conventions](./schema-conventions/spec.md) — Standardizes Zod string-format validators and index coverage for foreign-key and cascade columns.
- [semantic-embedding-cache](./semantic-embedding-cache/spec.md) — Activates content-addressed embedding scopes only after complete, current-source preparation and race-safe verification.
- [seed-determinism](./seed-determinism/spec.md) — Keeps seed identifiers collision-free and covers the canonical item-status vocabulary.
- [archive-published-floor](./archive-published-floor/spec.md) — Archive transitions preserve the published-data floor.
- [fill-from-write-lock](./fill-from-write-lock/spec.md) — Fill operations preserve write-lock ownership and concurrency guarantees.
- [group-scope-isolation-gaps](./group-scope-isolation-gaps/spec.md) — Group-scoped reads and writes remain isolated at every repository boundary.
- [published-portfolio-snapshot](./published-portfolio-snapshot/spec.md) — Published portfolio content is frozen and recoverable as one snapshot.
- [portfolio-content-presence](./portfolio-content-presence/spec.md) — Portfolio navigation remains enabled for products with meaningful detailed content, including decisions, priorities, and attention text.
- [published-section-order-determinism](./published-section-order-determinism/spec.md) — Published section order is deterministic across reads and recovery.
- [report-record-ordering](./report-record-ordering/spec.md) — Report records retain deterministic ordering across lifecycle operations.

### Testing and verification

- [behavioral-ui-regression-gate](./behavioral-ui-regression-gate/spec.md) — Keeps human and model product review advisory rather than making it a second acceptance authority.
- [demo-seed-datasets](./demo-seed-datasets/spec.md) — Provides deterministic small, middle, and huge datasets that exercise realistic roles, statuses, co-ownership, and reminders.
- [test-evidence-integrity](./test-evidence-integrity/spec.md) — Requires fail-hard disposable integration and explicit stock Vitest coverage thresholds in CI.
- [web-test-timer-discipline](./web-test-timer-discipline/spec.md) — Keeps web tests deterministic by using framework timers and query primitives instead of hand-rolled tick loops.
- [web-trpc-test-harness](./web-trpc-test-harness/spec.md) — Gives component and hook tests one shared tRPC proxy factory and cache-filter contract.
- [dependency-vulnerability-scanning](./dependency-vulnerability-scanning/spec.md) — Requires a recurring server-side dependency-vulnerability scan independent of push and branch-protection state.
- [dependency-integrity](./dependency-integrity/spec.md) — Installs and runs published dependency artifacts without repository-local rewrites of third-party package contents.
- [ui-crawl](./ui-crawl/spec.md) — The tester-kit crawler walks the running UI in quick and full modes and reports exercised controls, lifecycle states and unexplored coverage. `[roles: Shared]`
- [ui-crawl-evidence](./ui-crawl-evidence/spec.md) — Defines how the tester-kit crawler keeps diagnostic causes, confirmed screenshot and video references and response statistics honest in its report. `[roles: Shared]`
- [ui-crawl-request-ledger](./ui-crawl-request-ledger/spec.md) — Defines how the tester-kit crawler keeps reused XHR observations and its shared request ledger honest, so corrupt history and lock failures fail closed. `[roles: Shared]`
- [tester-kit-coverage](./tester-kit-coverage/spec.md) — The tester-kit proves its own coverage with guarded lifecycle fixtures, per-procedure success evidence and reset between runs. `[roles: Shared]`

### Lint, tooling, and repository process

- [ci-merge-gate](./ci-merge-gate/spec.md) — Defines the GitLab CI lint/test gate for `main` and the acceptance evidence collected outside CI.
- [developer-ui-feedback-tooling](./developer-ui-feedback-tooling/spec.md) — Developer visual review uses one shared user-level onUI interface on canonical origins, with annotation closure tied to evidence. `[roles: Shared]`
- [repository-file-accountability](./repository-file-accountability/spec.md) — Requires a complete one-off file disposition and a residue-free worktree without tracking campaign tooling.
- [git-hook-installation](./git-hook-installation/spec.md) — Keeps prepare-time Git hook installation owned by the permanent checkout so disposable linked worktrees cannot redirect shared hooks.
- [surface-token-integrity](./surface-token-integrity/spec.md) — Prevents report UI from referencing undefined surface tokens.
- [web-status-color-tokens](./web-status-color-tokens/spec.md) — Keeps the web status-token set complete, named, and free of hex fallbacks or unrelated color domains.
- [admin-action-log-details](./admin-action-log-details/spec.md) — Admin action logs retain the structured details needed for diagnosis.
- [admin-entity-write-integrity](./admin-entity-write-integrity/spec.md) — Admin entity writes enforce their current invariants atomically.
- [admin-user-identity-integrity](./admin-user-identity-integrity/spec.md) — Defines how Admin user writes keep identity, publisher and reviewer history, activity assignments and the last administrator intact.
- [admin-assignment-group-integrity](./admin-assignment-group-integrity/spec.md) — Defines how Admin writes keep project-activity group moves, report assignments, the last active reporting group and product ownership consistent.
- [lead-form-draft-module](./lead-form-draft-module/spec.md) — Lead draft composition stays within the canonical module boundary.
- [lead-section-draft-payload](./lead-section-draft-payload/spec.md) — Lead draft payloads remain bounded and contract-valid.
- [period-fill-from-ui](./period-fill-from-ui/spec.md) — Period fill actions use the sanctioned current write path.
- [rate-limit-store-readiness](./rate-limit-store-readiness/spec.md) — Rate limiting fails closed and reports readiness honestly.
- [record-comment-save-coordination](./record-comment-save-coordination/spec.md) — Record comments save against the correct concurrent record version.
- [reminder-policy-timezone-validation](./reminder-policy-timezone-validation/spec.md) — Reminder policies validate timezone and schedule inputs before persistence.
- [report-item-display-integrity](./report-item-display-integrity/spec.md) — Report item display preserves identity, scope, and ordering.
- [search-contract-precision](./search-contract-precision/spec.md) — Search contracts constrain fields, scope, and result destinations.
- [session-hydration-error-scoping](./session-hydration-error-scoping/spec.md) — Session hydration errors stay scoped to the affected surface.

## Verification

Run this deterministic check from the repository root. It reports duplicate or unindexed capability directories and every broken relative Markdown link; no output means the index is complete and linkable.

```bash
index=openspec/specs/README.md
inventory=$(mktemp)
indexed=$(mktemp)
find openspec/specs -mindepth 2 -maxdepth 2 -name spec.md -exec dirname {} \; | xargs -n1 basename | sort > "$inventory"
sed -nE 's#.*\(\./([^/]+)/spec\.md\).*#\1#p' "$index" | sort > "$indexed"
uniq -d "$indexed" | sed 's/^/duplicate: /'
comm -23 "$inventory" "$indexed" | sed 's/^/unindexed: /'
sed -nE 's#.*\]\(([^)]+)\).*#\1#p' "$index" | while IFS= read -r link; do test -f "openspec/specs/$link" || echo "broken: $link"; done
rm -f "$inventory" "$indexed"
```
