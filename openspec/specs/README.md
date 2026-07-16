# CustomReport capability map

This index maps every durable capability to one canonical home. Product capabilities are organized by the primary user outcome and lifecycle stage; role tags name every role that experiences the behavior. Mixed capabilities stay in Product when the user outcome is primary. Architecture, security, operations, data integrity, testing, and repository rules live under Engineering governance.

## Product capabilities

### Shared

#### Configure

- [deferred-feature-pattern](./deferred-feature-pattern/spec.md) — Visible inert UI controls and loud backend stubs make deferred work explicit without pretending it is implemented. `[roles: Lead, Head, Viewer, Admin]`
- [landing-page-hero](./landing-page-hero/spec.md) — The public landing hero presents the Weekly Report brand and rotates curated taglines without layout shift or decorative motion. `[roles: Shared]`
- [saml-provisioning](./saml-provisioning/spec.md) — First SAML login creates a least-privilege viewer while later logins never overwrite locally governed identity or access fields. `[roles: Shared, Admin]`
- [ui-role-route-access](./ui-role-route-access/spec.md) — Role denials use one in-page wall and return each visitor to the correct role home without redundant nested gates. `[roles: Lead, Head, Viewer, Admin]`
- [user-name-display](./user-name-display/spec.md) — Each surface uses its canonical full or short user-name form, including cross-author owner labels. `[roles: Lead, Head, Viewer, Admin]`

#### Prepare

- [archive-history-ia](./archive-history-ia/spec.md) — Navigation distinguishes current-report history from the archive of past closed reports. `[roles: Lead, Head, Viewer, Admin]`
- [report-routing](./report-routing/spec.md) — Report URLs carry stable path-segment identifiers so bookmarks and history resolve the intended report. `[roles: Lead, Head, Viewer, Admin]`
- [stage-label-canonicalization](./stage-label-canonicalization/spec.md) — Stored stage identifiers and displayed record labels stay aligned to the canonical stage vocabulary. `[roles: Lead, Head, Viewer, Admin]`
- [status-color-semantics](./status-color-semantics/spec.md) — Status UI uses named tokens, one alarm hue, reserved accents, and consistent per-status color meaning. `[roles: Lead, Head, Viewer, Admin]`
- [status-presentation-model](./status-presentation-model/spec.md) — One model owns canonical status vocabulary, tones, icons, dots, badges, and empty states. `[roles: Lead, Head, Viewer, Admin]`
- [ui-control-density](./ui-control-density/spec.md) — Grouped controls share a target height and pipeline arrows align without bypassing the visual-research gate. `[roles: Lead, Head, Admin]`

#### Draft

- [dialog-listbox-a11y](./dialog-listbox-a11y/spec.md) — Dialogs, period listboxes, popups, and expanders share correct focus, close, and ARIA behavior. `[roles: Lead, Head, Viewer, Admin]`
- [list-empty-state-fidelity](./list-empty-state-fidelity/spec.md) — Filtered-list counts and empty states derive from the same rows the user can see. `[roles: Lead, Head, Viewer, Admin]`
- [report-badge-resolution](./report-badge-resolution/spec.md) — Risk and decision badges resolve product names report-wide instead of falling back to Unknown. `[roles: Lead, Head, Viewer, Admin]`
- [report-toolbar-layout](./report-toolbar-layout/spec.md) — Header actions and context controls remain stable, grouped, reachable, and accessible across roles and viewport widths. `[roles: Lead, Head, Viewer, Admin]`
- [report-toolbar-parity](./report-toolbar-parity/spec.md) — Lead, head, and viewer report surfaces share one toolbar vocabulary without leaking mutations to viewers. `[roles: Lead, Head, Viewer, Admin]`
- [toolbar-polish](./toolbar-polish/spec.md) — Lead and head toolbars keep consistent control shapes, spacing, PDF behavior, and mode-safe toggles. `[roles: Lead, Head, Admin]`
- [web-polish-lows](./web-polish-lows/spec.md) — Small web correctness fixes keep autosave, dialogs, pagination, routes, validation, reminders, and form clears behaviorally sound. `[roles: Lead, Head, Viewer, Admin]`

#### Consume/Search

- [analytics-query-correctness](./analytics-query-correctness/spec.md) — Analytics results and cache keys stay correct under lead scoping, republished periods, and nested inputs. `[roles: Head, Admin]`
- [pdf-export-integrity](./pdf-export-integrity/spec.md) — PDF workers capture only a successfully rendered print report, never a loading or error state. `[roles: Lead, Head, Viewer, Admin]`
- [trends-query-window](./trends-query-window/spec.md) — Trends derives its date window from the current date and shows an explicit empty state when no results exist. `[roles: Head, Admin]`

### Lead

#### Prepare

- [carry-over-automation](./carry-over-automation/spec.md) — Unfinished prior-period work carries into the next period through one race-safe automatic write. `[roles: Lead]`
- [lead-form-data-loading](./lead-form-data-loading/spec.md) — One tested hook owns lead-form queries, enablement, visibility gating, cache purges, and redirects. `[roles: Lead]`

#### Draft

- [activity-reporting-unit](./activity-reporting-unit/spec.md) — Activity-parented records, links, and derived status behave consistently across lead, slide, head-report, and admin surfaces without changing product health. `[roles: Lead, Head, Admin]`
- [lead-dialog-lifecycle](./lead-dialog-lifecycle/spec.md) — Editable lead sections share one dialog lifecycle so view transitions cannot reopen or strand editors. `[roles: Lead]`
- [lead-form-cross-author-scope](./lead-form-cross-author-scope/spec.md) — The cross-author lens never reveals more than the curated Everyone scope. `[roles: Lead]`
- [lead-form-draft-merges](./lead-form-draft-merges/spec.md) — Draft merges preserve record identity, quick-add behavior, and blocker routing behind one tested boundary. `[roles: Lead]`
- [lead-form-draft-orchestration](./lead-form-draft-orchestration/spec.md) — Draft state and optimistic-lock versions stay current, with stale conflicts refetched and explained. `[roles: Lead]`
- [lead-form-loaded-view-model](./lead-form-loaded-view-model/spec.md) — One view model derives cross-author visibility, activity alarms, and loaded lead-form affordances. `[roles: Lead]`
- [lead-form-write-actions](./lead-form-write-actions/spec.md) — Lead writes share one action boundary while preserving conflicts, optimistic locking, and user-visible side effects. `[roles: Lead]`
- [lead-item-card-uniformity](./lead-item-card-uniformity/spec.md) — Lead item cards keep uniform height and expose truncated content through a full-text tooltip. `[roles: Lead]`
- [lead-pipeline-card](./lead-pipeline-card/spec.md) — Product health remains risk-derived and distinct from the lead's own Mine-scope stage completeness. `[roles: Lead]`
- [lead-report-controls-integrity](./lead-report-controls-integrity/spec.md) — Lead report controls avoid no-ops, accidental dialogs, clipped popovers, stale busy states, and mismatched summary populations. `[roles: Lead]`
- [lead-surface-name-resolution](./lead-surface-name-resolution/spec.md) — Lead cards resolve every report-known product name without placeholder fallback. `[roles: Lead]`
- [record-dialog-layout](./record-dialog-layout/spec.md) — Item, risk, and decision editors share one consistent two-column layout. `[roles: Lead]`
- [record-status-derivation](./record-status-derivation/spec.md) — Item alarms derive from covering risks while progress, blocker creation, pause reasons, and escalation counts remain coherent. `[roles: Lead, Head]`
- [risk-stage-integrity](./risk-stage-integrity/spec.md) — Risks and report records carry concrete stages, and legacy stage-less rows remain explicit until repaired. `[roles: Lead, Head]`
- [status-risk-unification](./status-risk-unification/spec.md) — Risk rows are the source of at-risk and blocked stage state, completeness floors, item alarms, and product escalation. `[roles: Lead, Head]`

#### Submit

- [report-section-write-gates](./report-section-write-gates/spec.md) — Draft save and submit decide editability from canonical period state and reject writes after publication. `[roles: Lead]`

#### Consume/Search

- [lead-history-summary](./lead-history-summary/spec.md) — Lead history is period-ordered and aggregates only completed periods with matching denominators. `[roles: Lead]`
- [lead-slide-by-product-grid](./lead-slide-by-product-grid/spec.md) — One auto-height by-product slide article renders lead, head, and viewer content with priorities, contributors, stages, and full record order. `[roles: Lead, Head, Viewer]`
- [lead-toolbar-presentation](./lead-toolbar-presentation/spec.md) — Lead report and slide controls stay reachable, consistently shaped, and use an explicit Submit action. `[roles: Lead]`
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
- [head-toolbar-semantics](./head-toolbar-semantics/spec.md) — Head report controls use consistent toggle styling, visible labels, subordinate deferred actions, and unambiguous publish wording. `[roles: Head, Admin]`

### Viewer

#### Consume/Search

- [viewer-report-navigation](./viewer-report-navigation/spec.md) — Viewer Status resolves to the latest allowed report and exposes the current or published report read-only. `[roles: Viewer]`
- [viewer-published-search](./viewer-published-search/spec.md) — Viewer Search returns only published content the viewer can open and routes results inside the viewer surface. `[roles: Viewer]`

Authority model:

- `viewer-report-navigation` defines Status authority, including live drafts only for the current period.
- `viewer-published-search` keeps Search authority published-only.
- [Owned decision and implementation](../changes/sweep15-viewer-authority-labeling/proposal.md) labels those scopes explicitly; this index does not duplicate its delta requirements or tasks.

### Admin

#### Configure

- [admin-dialog-focus-management](./admin-dialog-focus-management/spec.md) — Admin CRUD dialogs move focus inside on open and restore it to the initiating control on close. `[roles: Admin]`
- [admin-reminders-ui](./admin-reminders-ui/spec.md) — Admins configure reminder policies through plain-language cards, inline editing, presets, and explicit permanent removal. `[roles: Admin]`
- [admin-settings-ui](./admin-settings-ui/spec.md) — Admin Settings provides client-side sub-tabs, honest live policy fields, safe deferred controls, and resilient unsaved form state. `[roles: Admin]`
- [admin-snapshot-restore](./admin-snapshot-restore/spec.md) — Whole-database snapshot restore preserves reporting-group head assignments. `[roles: Admin]`
- [admin-stage-assignment](./admin-stage-assignment/spec.md) — Stage-to-lead assignment saves atomically against the composite uniqueness rule. `[roles: Admin]`
- [slide-capacity-signals](./slide-capacity-signals/spec.md) — Product assignment warns an admin when a lead's ownership load becomes presentation-heavy. `[roles: Admin]`
- [structured-user-name](./structured-user-name/spec.md) — Admin-managed surname, given name, patronymic, display name, short form, and initials derive consistently. `[roles: Admin, Shared]`
- [user-position](./user-position/spec.md) — Admins maintain a user's job title in the contract, table, and edit form. `[roles: Admin]`

#### Prepare

- [reliable-reminder-delivery](./reliable-reminder-delivery/spec.md) — Scheduled reminders remain exactly-once under retries, enqueue failures, concurrent workers, and crashed pods. `[roles: Admin, Lead, Head]`

## Engineering governance

### Architecture and module boundaries

- [architecture-refactor-backlog](./architecture-refactor-backlog/spec.md) — Records the remaining decomposition, permission, status, repository-boundary, and type-centralization targets.
- [auth-module-layering](./auth-module-layering/spec.md) — Keeps authentication ownership narrow and delegates period creation to the sanctioned lifecycle writer.
- [code-quality-modernization](./code-quality-modernization/spec.md) — Requires characterization coverage and behavior preservation for hot-zone refactors while removing typed escape hatches.
- [directory-architecture-standard](./directory-architecture-standard/spec.md) — Machine-enforces deterministic API layers, web slice placement, shared primitives, and import boundaries.
- [queue-worker-architecture](./queue-worker-architecture/spec.md) — Standardizes BullMQ worker bases and gives queue job defaults one production source.
- [report-section-prisma-payload](./report-section-prisma-payload/spec.md) — Types report-section mapping and post-save reads from generated Prisma payloads without nullable drift.
- [repository-port-type-boundary](./repository-port-type-boundary/spec.md) — Prevents application port declarations from importing Prisma infrastructure types.
- [role-type](./role-type/spec.md) — Keeps role vocabulary, database enum, labels, and membership guards on shared sources of truth.
- [web-model-type-boundary](./web-model-type-boundary/spec.md) — Types web presentation modules against real domain models rather than mock or legacy modules.
- [web-shared-idioms](./web-shared-idioms/spec.md) — Centralizes shared card chrome, chevrons, date formatting, role routing, and report-shell URL state.

### Security and authorization

- [destructive-db-guard](./destructive-db-guard/spec.md) — Blocks destructive Prisma scripts against production-looking targets unless an explicit guarded escape hatch is present.
- [jwt-session-integrity](./jwt-session-integrity/spec.md) — Pins JWT verification algorithms, enforces secret strength, and documents stateless logout semantics.
- [prod-security-hardening](./prod-security-hardening/spec.md) — Enforces production CSP, immutable base-image digests, and safe dev-auth build defaults.
- [public-endpoint-resource-limits](./public-endpoint-resource-limits/spec.md) — Bounds unauthenticated API request rate and body size per public ingress surface.
- [repository-scope-guard](./repository-scope-guard/spec.md) — Repositories fail closed when a read attempts to cross the caller's authorized product-group scope.
- [role-coverage-gate](./role-coverage-gate/spec.md) — Requires every tRPC procedure to use one of the canonical middleware builders by reference identity.
- [role-model-consistency](./role-model-consistency/spec.md) — Keeps route role declarations aligned with the API authorization gate.
- [section-save-payload-bounds](./section-save-payload-bounds/spec.md) — Applies the shared array-size bound to every client-supplied section-save collection.
- [session-endpoint-hardening](./session-endpoint-hardening/spec.md) — Protects logout and cache revalidation from cross-origin or unauthorized use and redirects only after confirmed logout.

### Observability, reliability, and performance

- [client-error-policy](./client-error-policy/spec.md) — Routes query load failures through one exactly-once reporting seam with consistent retry and message behavior.
- [error-trace-correlation](./error-trace-correlation/spec.md) — Correlates request, browser, queue, worker, and redacted application logs with one trace context.
- [hot-path-query-performance](./hot-path-query-performance/spec.md) — Parallelizes independent reads, batches ownership and reconciliation, paginates archives, and removes write-on-read hot paths.
- [manual-publish-telemetry](./manual-publish-telemetry/spec.md) — Emits publish counters only after a successful manual transition and records the real prior state.
- [operational-logger-wiring](./operational-logger-wiring/spec.md) — Injects the shared operational logger into service factories instead of silently falling back to a null logger.
- [period-scheduler-wiring](./period-scheduler-wiring/spec.md) — Makes scheduler dependencies mandatory and emits real audit events from scheduled period transitions.
- [prod-trace-sampling](./prod-trace-sampling/spec.md) — Configures production OTLP export, parent-aware sampling, and loud untraced boot logging.
- [queue-reliability-monitoring](./queue-reliability-monitoring/spec.md) — Monitors DLQs, Redis memory, terminal Telegram failures, retention, and queue shutdown behavior.
- [scope-accessed-audit](./scope-accessed-audit/spec.md) — Audits legitimate cross-group weekly-report reads without changing returned data.

### Deployment and configuration

- [dependency-currency](./dependency-currency/spec.md) — Records and gates coordinated dependency upgrades, runtime alignment, image sync, and deliberate deprecated pins.
- [deploy-caddy-config](./deploy-caddy-config/spec.md) — Keeps staging and production proxy security headers and API routing behavior aligned.
- [deploy-healthchecks](./deploy-healthchecks/spec.md) — Exercises real PgBouncer and API dependency paths rather than process-only liveness.
- [env-schema-coverage](./env-schema-coverage/spec.md) — Declares every consumed environment variable, removes silent defaults, and fails boot when mandatory production config is missing.
- [health-indicator-service-migration](./health-indicator-service-migration/spec.md) — Uses the supported health-indicator API while preserving live and ready response contracts.
- [redis-connection-config](./redis-connection-config/spec.md) — Routes all Redis consumers through one validated, fail-loud host and port builder.
- [web-api-url-config](./web-api-url-config/spec.md) — Resolves the web API base URL and tRPC response decoding through explicit fail-loud seams.
- [web-env-validation](./web-env-validation/spec.md) — Validates client environment values at build time and centralizes typed, inline-safe access.

### Data integrity and schema

- [enum-state-hygiene](./enum-state-hygiene/spec.md) — Requires every persisted enum state to have a writer or be removed.
- [period-dual-state](./period-dual-state/spec.md) — Requires canonical and legacy Report period representations to change atomically through sanctioned lifecycle writers.
- [prisma-unique-violation-guard](./prisma-unique-violation-guard/spec.md) — Centralizes constraint-aware Prisma unique-violation detection and proves it against the real adapter shape.
- [publish-compare-and-set](./publish-compare-and-set/spec.md) — Publishes through one guarded compare-and-set and builds snapshots from a fresh in-transaction read.
- [reopen-compare-and-set](./reopen-compare-and-set/spec.md) — Guards reopen and manual archive transitions against zero-row and concurrent-writer races.
- [schema-conventions](./schema-conventions/spec.md) — Standardizes Zod string-format validators and index coverage for foreign-key and cascade columns.
- [seed-determinism](./seed-determinism/spec.md) — Keeps seed identifiers collision-free and covers the canonical item-status vocabulary.

### Testing and verification

- [a11y-regression-coverage](./a11y-regression-coverage/spec.md) — Requires behavior-level regression coverage for keyboard, focus, Escape, tabindex, and decorative-SVG accessibility changes.
- [ai-driver-coverage](./ai-driver-coverage/spec.md) — Drives every role catalog in a live browser and dispositions every confirmed behavioral finding.
- [behavioral-ui-regression-gate](./behavioral-ui-regression-gate/spec.md) — Defines the durable scenario catalog, swappable driver boundary, role sweeps, and deferred deterministic gate.
- [demo-seed-datasets](./demo-seed-datasets/spec.md) — Provides deterministic small, middle, and huge datasets that exercise realistic roles, statuses, co-ownership, and reminders.
- [driver-env-feedback](./driver-env-feedback/spec.md) — Correlates post-run environment failures with the drive timeline and never reports a blind channel as clean.
- [frontend-audit-memo](./frontend-audit-memo/spec.md) — Requires grounded frontend audit evidence before UI implementation or Core Web Vitals claims.
- [manual-uat-reseed](./manual-uat-reseed/spec.md) — Resets manual-UAT data in foreign-key-safe order to a known baseline.
- [scenario-catalog](./scenario-catalog/spec.md) — Maintains human-reviewed, outcome-checkable scenarios with code/test links, role validation, and drift detection.
- [sweep-runtime-correctness](./sweep-runtime-correctness/spec.md) — Requires role-reachable routes and shared controls to run without confirmed React, console, or axe regressions.
- [uat-quality-gates](./uat-quality-gates/spec.md) — Defines the full deterministic gate chain and zero-console-error role acceptance sweep.
- [web-test-timer-discipline](./web-test-timer-discipline/spec.md) — Keeps web tests deterministic by using framework timers and query primitives instead of hand-rolled tick loops.
- [web-trpc-test-harness](./web-trpc-test-harness/spec.md) — Gives component and hook tests one shared tRPC proxy factory and cache-filter contract.

### Lint, tooling, and repository process

- [ci-merge-gate](./ci-merge-gate/spec.md) — Defines the server-side merge gate and the local pre-push substitute required before production.
- [lint-max-strictness-standard](./lint-max-strictness-standard/spec.md) — Pins the type-aware lint baseline, size and complexity ratchets, import map, comment policy, and fix-first escalation path.
- [lint-toolchain-ownership](./lint-toolchain-ownership/spec.md) — Assigns logic linting to ESLint, formatting to Prettier, CSS to stylelint, and Prisma checks to scoped TypeScript.
- [status-type-ssot-gate](./status-type-ssot-gate/spec.md) — Rejects duplicated status literal unions through both lint paths.
- [surface-token-integrity](./surface-token-integrity/spec.md) — Prevents report UI from referencing undefined surface tokens.
- [web-status-color-tokens](./web-status-color-tokens/spec.md) — Keeps the web status-token set complete, named, and free of hex fallbacks or unrelated color domains.

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
