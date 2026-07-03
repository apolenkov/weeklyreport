# Fix roadmap — full-repo audit (2026-07-02)

603 verified findings across 49 per-file reports, clustered by root cause into 80 work-items (from 83 raw; 3 cross-family duplicates merged below).
Each work-item is one change: one shared extraction, one sweep, or one fold into an existing backlog change.
Ordering is by (severity, fileCount) desc so cross-file high-impact wins land first; effort is S/M/L.
The owner's Your-verdict pass on the per-file reports is still pending — treat this as the execution shape, not a green light to start every row.

## Merges applied (cross-family dedup)

- **#45 (row 17) createServiceLogger** absorbs the old code-health "service-logger construction block" item and the config "no-fallback LOG_LEVEL" item — same helper, same five files.
- **#19 (row 19) consolidate web server helpers** absorbs the old "tRPC batch-decode + resolveApiUrl + dev-fallback" duplication item and the "centralize web API URL" no-fallback item — one shared module, `requireApiUrl` is the fail-loud half.
- **#45 (row 45) chart palette + time constants** merges the "chart palette + ONE_DAY_MS" duplication item into the "MS_PER_HOUR/DAY/WEEK + graceCutoff" constants item — the day-in-ms literal was double-counted.
- **`makeLimiter` dedup** in the "apps/api small dedups" sweep (row 74) folds into the infra refactor (row 18); the rate-limit constants (row 32) stay separate but touch the same file — do all three together.

## Priority order

| #   | Work-item                                                                                    | Sev    | Files | Effort | Home                                    |
| --- | -------------------------------------------------------------------------------------------- | ------ | ----- | ------ | --------------------------------------- |
| 1   | Relocate over-budget load-bearing JSDoc headers to specs/ADRs                                | high   | 40    | L      | tighten-comment-policy                  |
| 2   | Single-home rationale duplicated across interface+impl+files                                 | high   | 22    | M      | tighten-comment-policy                  |
| 3   | Unify status vocabulary (tone/label/icon/dot) — one presentation map                         | high   | 12    | L      | new: unify-status-presentation          |
| 4   | Extract shared card-surface primitive                                                        | high   | 10    | M      | tighten-code-quality-ratchet            |
| 5   | Complete env.schema coverage; route ad-hoc process.env through ENV_CONFIG                    | high   | 9     | L      | new: complete-env-schema-coverage       |
| 6   | Move embedded roadmap notes / future-hook TODOs / dated decisions to backlog/ADR             | high   | 9     | M      | tighten-comment-policy                  |
| 7   | Split oversized report-shell / nav components; extract shared toolbar-state                  | high   | 9     | L      | sweep: apps/web/report-shell-and-nav    |
| 8   | Replace hand-rolled SVG icons with lucide + RotatingChevron                                  | high   | 8     | M      | code-health-and-test-cleanup            |
| 9   | Split mock-data.ts; move production presentation types out of fixtures                       | high   | 8     | M      | code-health-and-test-cleanup            |
| 10  | Period lifecycle: break monolithic runOnce/factory; kill push-accumulators/positional params | high   | 8     | L      | sweep: apps/api/modules/period          |
| 11  | Split oversized API data-access methods and >250-line repo files                             | high   | 8     | L      | tighten-code-quality-ratchet            |
| 12  | Immutability: kill let/reassignment/param-mutation; add prefer-const ratchet                 | high   | 8     | M      | tighten-code-quality-ratchet            |
| 13  | Split oversized dashboard page/cards; extract load-watchdog hook                             | high   | 7     | L      | sweep: apps/web/components/dashboard    |
| 14  | One QueueRegistry + RawBullMqProcessor base (queue handles opened 3×)                        | high   | 6     | L      | observability-and-perf-hardening        |
| 15  | Centralize date/timestamp formatting (4 local copies + duplicate month table)                | high   | 6     | S      | code-health-and-test-cleanup            |
| 16  | buildRedisConnectionOptions; kill `?? "localhost"`/6379 fallbacks                            | high   | 6     | M      | new: centralize-redis-connection-config |
| 17  | createServiceLogger + split logger.ts file-sink concern                                      | high   | 6     | M      | observability-and-perf-hardening        |
| 18  | Break oversized infra bootstrap/processor/factory bodies + duplicated branches               | high   | 5     | M      | observability-and-perf-hardening        |
| 19  | Consolidate web server helpers (batch-decode + requireApiUrl + dev-fallback)                 | high   | 5     | M      | new: centralize-web-api-url             |
| 20  | Make period scheduler/service deps required (no null-object defaults)                        | high   | 5     | M      | new: require-period-scheduler-deps      |
| 21  | One guarded compare-and-set publish helper (CAS implemented twice)                           | high   | 3     | M      | make-publish-atomic                     |
| 22  | Delete orphaned/dead code (api-readiness stub, getDialogPreset, shutdownOtel wiring)         | high   | 3     | S      | code-health-and-test-cleanup            |
| 23  | Shared useReportShellUrlState hook (head/viewer shells duplicated)                           | high   | 3     | M      | head-surface-parity-declutter           |
| 24  | Dedup published-snapshot assembly (pdf-export vs snapshot module)                            | high   | 3     | M      | code-health-and-test-cleanup            |
| 25  | Split slides mega-module (section-slide-utils 1180 lines) + mutable aggregation              | high   | 3     | L      | sweep: apps/web/components/slides       |
| 26  | One ROLE_LABEL map in packages/shared (three drifted sources)                                | high   | 3     | S      | code-health-and-test-cleanup            |
| 27  | Extract createRedisReadThroughCache (analytics/telemetry caches near-clones)                 | high   | 2     | M      | observability-and-perf-hardening        |
| 28  | Merge two confirmation modals onto ConfirmationDialog + useDialogFocus                       | high   | 2     | M      | code-health-and-test-cleanup            |
| 29  | Extract findCurrentEditableReport (current-period query duplicated)                          | high   | 2     | M      | unified-activity-entry                  |
| 30  | Search service: call computeAllowedGroupIds instead of re-deriving group scope               | high   | 2     | S      | scope-analytics-to-group                |
| 31  | SEARCH_LANGUAGE / snippet-marker constants (cross api↔web contract)                         | high   | 2     | M      | tighten-code-quality-ratchet            |
| 32  | Name rate-limit config magic numbers                                                         | high   | 1     | S      | tighten-code-quality-ratchet            |
| 33  | Split print report template (725 lines) behind eslint-disable                                | high   | 1     | M      | sweep: apps/web/app/print               |
| 34  | Read PDF-export JWT secret + path via validated config                                       | high   | 1     | S      | route-pdfs-and-authz                    |
| 35  | Strip ticket/phase/change-name archaeology prefixes from comments repo-wide                  | medium | 60    | L      | tighten-comment-policy                  |
| 36  | Name self-contained inline magic numbers/strings (per-file)                                  | medium | 16    | M      | sweep: name-inline-magic-numbers        |
| 37  | Shared Prisma P2002 constant + isUniqueViolation guard                                       | medium | 15    | M      | map-domain-errors                       |
| 38  | Unify at-risk/warning colors on existing design tokens                                       | medium | 12    | M      | new: unify-web-status-color-tokens      |
| 39  | apps/web scattered small dedups                                                              | medium | 12    | M      | sweep: apps/web small dedups            |
| 40  | ToolbarPillButton + variant constants (toolbar/pill strings copy-pasted)                     | medium | 11    | M      | code-health-and-test-cleanup            |
| 41  | PageShell/PageContainer primitive + createRoleGateLayout factory                             | medium | 11    | M      | responsive-compact-layout               |
| 42  | Period module internal dedup (transition types, scheduler skeleton, DI, EnsuredPeriod)       | medium | 11    | M      | sweep: apps/api/modules/period          |
| 43  | Shared symbols for cross-file string/URL contracts (web+api)                                 | medium | 10    | M      | tighten-code-quality-ratchet            |
| 44  | Fix names/comments that outlived their meaning + dead export/alias                           | medium | 10    | M      | code-health-and-test-cleanup            |
| 45  | Shared chart palette + time-unit constants (MS_PER_HOUR/DAY/WEEK) + graceCutoff              | medium | 8     | M      | tighten-code-quality-ratchet            |
| 46  | Correct stale/drifted comments that state false facts                                        | medium | 8     | M      | tighten-comment-policy                  |
| 47  | Central BullMQ queue-name constants                                                          | medium | 8     | S      | tighten-code-quality-ratchet            |
| 48  | Web a11y correctness sweep (hidden focusables, accessible names, live regions)               | medium | 7     | M      | sweep: web-a11y-correctness             |
| 49  | Collapse 3+/boolean/same-typed API params to options objects                                 | medium | 7     | M      | sweep: parameter-objects                |
| 50  | DEFAULT_QUERY_STALE_TIME_MS constant                                                         | medium | 6     | S      | tighten-code-quality-ratchet            |
| 51  | Extract ComingSoonControl primitive (chrome duplicated across 5 sites)                       | medium | 6     | M      | new: shared-coming-soon-control         |
| 52  | Delete dead/speculative/redundant code (runTransition, ConfirmationDialog variants)          | medium | 6     | S      | code-health-and-test-cleanup            |
| 53  | createWebVitalHistogram + shared on-time-ratio query (metrics boilerplate)                   | medium | 5     | M      | observability-and-perf-hardening        |
| 54  | useOnClickOutside hook (listener reimplemented 5×)                                           | medium | 5     | S      | code-health-and-test-cleanup            |
| 55  | Remove dead pointers in comments (nonexistent paths, commit hashes, rotted refs)             | medium | 5     | S      | tighten-comment-policy                  |
| 56  | Group optional cross-cutting DI deps into one options param (no undefined holes)             | medium | 5     | S      | code-health-and-test-cleanup            |
| 57  | Single-home re-narrated rationale (D1, CAS, backup-window)                                   | medium | 4     | S      | tighten-comment-policy                  |
| 58  | ORGANIZATION_SINGLETON_ID constant                                                           | medium | 4     | S      | tighten-code-quality-ratchet            |
| 59  | Extract isOpenBoundaryConflict + openBoundaryGuarded (scattered/re-hand-rolled)              | medium | 3     | S      | fix-manual-publish-archive-race         |
| 60  | Shared styled ErrorFallback for route error boundaries                                       | medium | 3     | S      | input-and-error-hardening               |
| 61  | Single home for DEADLINE_HOUR + business-date day-boundary consts                            | medium | 3     | S      | fix-period-datetime-tz                  |
| 62  | EDITABLE_PERIOD_STATUSES shared constant                                                     | medium | 3     | S      | tighten-code-quality-ratchet            |
| 63  | Options object for review acknowledge / isDesignatedReviewer (transposable params)           | medium | 3     | S      | review-acknowledgement                  |
| 64  | Remove unnecessary state-syncing useEffects                                                  | medium | 3     | M      | code-health-and-test-cleanup            |
| 65  | Delete dead code / redundant idioms / lint suppressions in web components                    | medium | 3     | S      | code-health-and-test-cleanup            |
| 66  | ProjectActivityWriteFields type (write shape retyped 4×)                                     | medium | 2     | S      | project-activity-reporting              |
| 67  | MIN_SECRET_LENGTH shared constant                                                            | medium | 2     | S      | tighten-code-quality-ratchet            |
| 68  | pdfArtifactPath(jobId) helper (path shape repeated)                                          | medium | 2     | S      | route-pdfs-and-authz                    |
| 69  | Make allowedScopes/mode required on shared toggles (no silent defaults)                      | medium | 2     | S      | code-health-and-test-cleanup            |
| 70  | Fix pdf-export status coercion + lying `as "pending"` assertion                              | medium | 1     | S      | input-and-error-hardening               |
| 71  | Delete JSDoc/doc-blocks on non-exported app-internal helpers                                 | low    | 20    | M      | tighten-comment-policy                  |
| 72  | Extract errorMessage(error) helper (copy-pasted 8×)                                          | low    | 8     | S      | code-health-and-test-cleanup            |
| 73  | De-duplicate ROUTE_ROLE_MAP against per-layout REQUIRED roles                                | low    | 5     | S      | code-health-and-test-cleanup            |
| 74  | apps/api scattered small dedups                                                              | low    | 4     | S      | sweep: apps/api small dedups            |
| 75  | REQUEST_ID_HEADER + CORRELATION_ID_CLS_KEY constants                                         | low    | 4     | S      | observability-and-perf-hardening        |
| 76  | Extract magic-number literals surfaced during comment cleanup                                | low    | 3     | S      | tighten-code-quality-ratchet            |
| 77  | Move review error classes to shared review-errors.ts                                         | low    | 2     | S      | review-acknowledgement                  |
| 78  | Guard auto-archive vs reopen race + fail-loud on NULL publishedAt                            | low    | 2     | S      | fix-manual-publish-archive-race         |
| 79  | Thread stable id through UnifiedSectionRow (slide lists key by index)                        | low    | 2     | M      | key-charts-by-id                        |
| 80  | Don't fabricate an org name when session organization is missing                             | low    | 1     | S      | head-surface-parity-declutter           |

## Cross-cutting wins (do first)

Each collapses many files behind ONE shared artifact. Land these before the per-file sweeps — they shrink every downstream diff.

- **#4 CardSurface primitive** — one `.card-surface`/`.card-surface-hover` class (or wrapper) next to `packages/ui/card.tsx`. Collapses the border+gradient+shadow mega-literal across **10** files.
- **#3 status-presentation module** — one canonical tone-token map + label/className/icon/dot helper + SlideStatusBadge/SlideEmptyState. Collapses the status vocabulary across **12** files. (Build on #38 tokens; #38 is the CSS-var layer, #3 the presentation layer that reads it.)
- **#8 RotatingChevron + lucide imports + one animate-spin spinner** — collapses hand-rolled SVG duplicates across **8** files.
- **#37 PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE + isUniqueViolation guard** — one guard (must read driverAdapterError message under the pg adapter, not meta.target). Collapses the ad-hoc P2002 detection across **~15** files.
- **#45 time-constants module (MS_PER_HOUR/DAY/WEEK) + graceCutoff + CHART_SERIES_COLORS** — collapses ms-conversion and palette literals across **~8** files.
- **#15 formatTimestampShort + exported MONTHS_SHORT** in lib/format-date.ts — collapses 4 local formatters + duplicate month table across **6** files.
- **#26 ROLE_LABEL map** in packages/shared — collapses 3 already-drifted role-label sources.
- **#51 ComingSoonControl/ComingSoonIconButton** next to ComingSoonBadge — collapses inert coming-soon chrome across **5** sites and retires the source-scan guards.
- **#54 useOnClickOutside hook** — collapses the ref-contains/mousedown idiom across **5** components.
- **#17 createServiceLogger** — collapses the ~12-line logger-init block across **5** services (fail-loud on invalid LOG_LEVEL via validated env).
- **#19 requireApiUrl + decodeTrpcBatchPayload** — collapses the `?? "http://localhost:3002"` chain + superjson batch-decode across **5** web/server files.
- **#16 buildRedisConnectionOptions** — collapses the `?? "localhost"`/6379 fallback across **6** Redis consumers.
- **#14 QueueRegistry + RawBullMqProcessor base** — collapses 3 duplicate queue-handle sites + 2 duplicate worker lifecycles.

## Routes to existing backlog

These fold INTO the named change's implementation — not a separate diff.

- **tighten-comment-policy**: #1, #2, #6, #35, #46, #55, #57, #71 (JSDoc relocation, single-home rationale, roadmap-notes-out, archaeology-prefix strip + lint guard, stale-fact fixes, dead pointers, re-narrated rationale, non-exported JSDoc deletion).
- **tighten-code-quality-ratchet**: #4, #11, #12, #31, #32, #43, #45, #47, #50, #58, #62, #67, #76 (card-surface, oversized data-access split + per-function size lint, immutability ratchet, search-language consts, rate-limit consts, cross-file symbols, chart+time consts, queue-name consts, staleTime const, org-singleton id, editable-period-statuses, min-secret-length, comment-cleanup magic numbers).
- **code-health-and-test-cleanup**: #8, #15, #22, #24, #26, #28, #40, #44, #52, #54, #56, #64, #65, #69, #72, #73 (SVG icons, date formatting, orphaned code, snapshot-assembly dedup, role-label map, confirmation-modal merge, toolbar-pill, misleading names + dead export, dead-code delete, useOnClickOutside, DI options param, state-syncing effects, web dead code, silent-default props, errorMessage helper, ROUTE_ROLE_MAP dedup).
- **observability-and-perf-hardening**: #14, #17, #18, #27, #53, #75 (QueueRegistry/processor base, createServiceLogger + logger split, infra bootstrap/processor/factory split incl makeLimiter, Redis read-through cache, web-vital-histogram + on-time query, correlation-id/CLS consts).
- **make-publish-atomic**: #21 (one guarded CAS publish helper both repositories call).
- **fix-manual-publish-archive-race**: #59, #78 (open-boundary conflict guard extraction, auto-archive reopen-race guard — confirm the archive-CAS with owner first).
- **head-surface-parity-declutter**: #23, #80 (shared report-shell URL-state hook, don't fabricate org name).
- **responsive-compact-layout**: #41 (PageShell/PageContainer + createRoleGateLayout).
- **unified-activity-entry**: #29 (findCurrentEditableReport shared query).
- **scope-analytics-to-group**: #30 (search service reuses computeAllowedGroupIds).
- **input-and-error-hardening**: #60, #70 (shared ErrorFallback, pdf-export status coercion fix).
- **project-activity-reporting**: #66 (ProjectActivityWriteFields type).
- **review-acknowledgement**: #63, #77 (acknowledge options object, review-errors.ts relocation).
- **fix-period-datetime-tz**: #61 (DEADLINE_HOUR + day-boundary consts, remove `?? "18"`).
- **map-domain-errors**: #37 (P2002 constant + isUniqueViolation guard).
- **route-pdfs-and-authz**: #34, #68 (PDF JWT secret via validated config, pdfArtifactPath helper).
- **key-charts-by-id**: #79 (stable id through UnifiedSectionRow — data-model change, not fixable locally).

## New changes needed

- **new: unify-status-presentation** (#3) — one canonical status tone-token map + label/icon/dot helper + SlideStatusBadge/SlideEmptyState; every slide/dashboard/print surface reads from it.
- **new: unify-web-status-color-tokens** (#38) — replace raw at-risk/success hex with existing `--color-status-*` tokens, drop hex var-fallbacks, add `--color-border-subtle`. Prerequisite for #3.
- **new: shared-coming-soon-control** (#51) — ComingSoonControl/ComingSoonIconButton primitive; compose the 5 sites, extract nav-bar's two, retire source-scan tests.
- **new: centralize-redis-connection-config** (#16) — buildRedisConnectionOptions(env) reading validated ENV_CONFIG; delete every `?? "localhost"`/6379 across the 5 consumers.
- **new: centralize-web-api-url** (#19) — one server module exporting requireApiUrl (fail-loud) + decodeTrpcBatchPayload + shouldUseDevAuthFallback; delete the api-readiness dead-code file.
- **new: complete-env-schema-coverage** (#5) — declare every ad-hoc process.env var in envSchema, route all reads through ENV_CONFIG/requireEnv, add isTelegramConfigured(env).
- **new: require-period-scheduler-deps** (#20) — make auditLogger/readReopenPolicy/listSectionIds required, wire real sinks at the composition root (Symbol token + useFactory); drop the runtime existence guards.

## Per-folder sweeps

Gated on a clean `git status` + the **tighten-comment-policy** and **tighten-code-quality-ratchet** standards landing first (they set the comment rules and the size/immutability ratchets these sweeps must satisfy). One folder per sweep; stage only that folder's paths.

- **apps/api/modules/period**: #10 (monolithic runOnce/factory, push-accumulators, positional params), #42 (transition types, scheduler skeleton, DI single-home, EnsuredPeriod builder). Run together — overlapping files.
- **apps/web/report-shell-and-nav**: #7 (split shells + nav-bar; shared toolbar-state/period-list hooks; AccordionHeader; segmented-toggle options).
- **apps/web/components/dashboard**: #13 (useDashboardLoadWatchdog hook; row/section subcomponents; renderBody takes the query object).
- **apps/web/components/slides**: #25 (split section-slide-utils into model/pagination/unified/product-scoped/foreign-content; reduce over sections; useLeadSlidesDeck; drop max-lines disables).
- **apps/web/app/print**: #33 (split print template into portfolio/lead-section/loading-shell + subcomponents; remove eslint-disable).
- **apps/web small dedups**: #39 (devLoginHref reuse, ROLE_HISTORY_CONFIG lookup, ChartSlot, shouldRenderDevRoleSwitcher export, PRINT_PAGE_STYLE/chipBase, isInvalidLinkTrpcCode, delete duplicate ArchiveToggle test/impl).
- **apps/api small dedups**: #74 (drop redundant service re-parse, makeLimiter folds into #18, logDevSend helper, toCycleDateUtc).
- **name-inline-magic-numbers**: #36 (hoist self-contained per-file literals to documented module consts / HttpStatus enum / Tailwind tokens; share SYSTEM_ACTOR spread + AUTHOR_NAME_LOCALE).
- **parameter-objects**: #49 (collapse 3+/boolean/same-typed positional signatures to options objects across interface+impl+call site).
- **web-a11y-correctness**: #48 (inert collapsed content, parameterized scope-toggle label + roving-tabindex guard, real tabpanel for product-chips, accessible role-switcher name, aria-live tagline, visible lock attribution).

## Not-yet-audited (wave 3)

Parallel-session folders still pending audit — do not assume clean; re-check `git status` before building near them (a parallel session holds uncommitted feature work in several):

- **apps/api**: auth, admin, period (further passes), carry-over, report-sections, trpc infrastructure.
- **apps/web**: admin surface, lead surface, weekly-report surface, lib/mappers.
- **packages/shared**.

Wave-3 findings may add items to the homes above or spawn new ones; re-run the priority sort after they land.
