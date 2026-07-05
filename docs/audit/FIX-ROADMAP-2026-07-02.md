# Fix roadmap — full-repo audit (2026-07-02)

> **Refreshed 2026-07-05 after the completeness audit.** Wave-3a (api) landed —
> 7 reports, ~265 raw findings (~256 after refuted local-builder immutability
> findings), folded below as #81–#90. Ten work-items executed (see ✅ rows).
> **The old "Routes to existing backlog" section was stale and is replaced:**
> every home change it named is now archived, and several archived WITHOUT
> delivering their folded cleanup items — verified ABSENT in code:
> `useOnClickOutside` (#54), `ToolbarPillButton` (#40), `ConfirmationDialog`/
> `useDialogFocus` (#28), `errorMessage` (#72), `ROLE_LABEL`-in-shared (#26),
> `findCurrentEditableReport` (#29), search reuse of `computeAllowedGroupIds`
> (#30). So "archived home" does NOT mean "done." Survivors are re-homed to four
> new changes; the rest are classified by evidence, not assumption.

868 findings total: 603 across 49 wave-1/2 per-file reports (80 work-items, #1–#80),
plus ~265 across 7 wave-3a api reports (clustered into #81–#90).
Each work-item is one change: one shared extraction, one sweep, or one fold.
Ordering within each block is by (severity, fileCount) desc; effort is S/M/L.
**`#` is a stable ID, not a row rank** — the sweeps / new-changes / re-home
sections reference these numbers, so DONE rows are marked in place, never renumbered.
The owner's Your-verdict pass is still pending — execution shape, not a green light.

## Merges applied (cross-family dedup)

- **#45 (row 17) createServiceLogger** absorbs the old code-health "service-logger construction block" item and the config "no-fallback LOG_LEVEL" item — same helper, same five files.
- **#19 (row 19) consolidate web server helpers** absorbs the old "tRPC batch-decode + resolveApiUrl + dev-fallback" duplication item and the "centralize web API URL" no-fallback item — one shared module, `requireApiUrl` is the fail-loud half.
- **#45 (row 45) chart palette + time constants** merges the "chart palette + ONE_DAY_MS" duplication item into the "MS_PER_HOUR/DAY/WEEK + graceCutoff" constants item — the day-in-ms literal was double-counted.
- **`makeLimiter` dedup** in the "apps/api small dedups" sweep (row 74) folds into the infra refactor (row 18); the rate-limit constants (row 32) stay separate but touch the same file — do all three together.

## Priority order

| #   | Work-item                                                                                    | Sev    | Files | Effort | Home                                                           |
| --- | -------------------------------------------------------------------------------------------- | ------ | ----- | ------ | -------------------------------------------------------------- |
| 1   | Relocate over-budget load-bearing JSDoc headers to specs/ADRs                                | high   | 40    | L      | tighten-comment-policy                                         |
| 2   | Single-home rationale duplicated across interface+impl+files                                 | high   | 22    | M      | tighten-comment-policy                                         |
| 3   | ◑ Unify status vocabulary (tone/label/icon/dot) — one presentation map                       | high   | 12    | L      | unify-status-presentation ◑ partial 6c0f01c6+e6f012a4 (active) |
| 4   | Extract shared card-surface primitive                                                        | high   | 10    | M      | tighten-code-quality-ratchet                                   |
| 5   | Complete env.schema coverage; route ad-hoc process.env through ENV_CONFIG                    | high   | 9     | L      | ✅ api e9d90b1e · web → add-web-env-schema                     |
| 6   | Move embedded roadmap notes / future-hook TODOs / dated decisions to backlog/ADR             | high   | 9     | M      | tighten-comment-policy                                         |
| 7   | Split oversized report-shell / nav components; extract shared toolbar-state                  | high   | 9     | L      | sweep: apps/web/report-shell-and-nav                           |
| 8   | Replace hand-rolled SVG icons with lucide + RotatingChevron                                  | high   | 8     | M      | code-health-and-test-cleanup                                   |
| 9   | Split mock-data.ts; move production presentation types out of fixtures                       | high   | 8     | M      | code-health-and-test-cleanup                                   |
| 10  | Period lifecycle: break monolithic runOnce/factory; kill push-accumulators/positional params | high   | 8     | L      | sweep: apps/api/modules/period                                 |
| 11  | Split oversized API data-access methods and >250-line repo files                             | high   | 8     | L      | tighten-code-quality-ratchet                                   |
| 12  | Immutability: kill let/reassignment/param-mutation; add prefer-const ratchet                 | high   | 8     | M      | tighten-code-quality-ratchet                                   |
| 13  | Split oversized dashboard page/cards; extract load-watchdog hook                             | high   | 7     | L      | sweep: apps/web/components/dashboard                           |
| 14  | ✅ One QueueRegistry + RawBullMqProcessor base (queue handles opened 3×)                     | high   | 6     | L      | ✅ 029e0f4f+cdd11a0b                                           |
| 15  | Centralize date/timestamp formatting (4 local copies + duplicate month table)                | high   | 6     | S      | code-health-and-test-cleanup                                   |
| 16  | ✅ buildRedisConnectionOptions; kill `?? "localhost"`/6379 fallbacks                         | high   | 6     | M      | ✅ ee4c11b2+6273bd22                                           |
| 17  | ✅ createServiceLogger + split logger.ts file-sink concern                                   | high   | 6     | M      | ✅ 06223922+2664f269                                           |
| 18  | Break oversized infra bootstrap/processor/factory bodies + duplicated branches               | high   | 5     | M      | observability-and-perf-hardening                               |
| 19  | ✅ Consolidate web server helpers (batch-decode + requireApiUrl + dev-fallback)              | high   | 5     | M      | ✅ d0aecff0                                                    |
| 20  | ✅ Make period scheduler/service deps required (no null-object defaults)                     | high   | 5     | M      | ✅ d6d6ee13                                                    |
| 21  | One guarded compare-and-set publish helper (CAS implemented twice)                           | high   | 3     | M      | make-publish-atomic                                            |
| 22  | Delete orphaned/dead code (api-readiness stub, getDialogPreset, shutdownOtel wiring)         | high   | 3     | S      | code-health-and-test-cleanup                                   |
| 23  | Shared useReportShellUrlState hook (head/viewer shells duplicated)                           | high   | 3     | M      | head-surface-parity-declutter                                  |
| 24  | Dedup published-snapshot assembly (pdf-export vs snapshot module)                            | high   | 3     | M      | code-health-and-test-cleanup                                   |
| 25  | Split slides mega-module (section-slide-utils 1180 lines) + mutable aggregation              | high   | 3     | L      | sweep: apps/web/components/slides                              |
| 26  | One ROLE_LABEL map in packages/shared (three drifted sources)                                | high   | 3     | S      | code-health-and-test-cleanup                                   |
| 27  | ✅ Extract createRedisReadThroughCache (analytics/telemetry caches near-clones)              | high   | 2     | M      | ✅ 52ca8c75+d9d63ae1                                           |
| 28  | Merge two confirmation modals onto ConfirmationDialog + useDialogFocus                       | high   | 2     | M      | code-health-and-test-cleanup                                   |
| 29  | Extract findCurrentEditableReport (current-period query duplicated)                          | high   | 2     | M      | unified-activity-entry                                         |
| 30  | Search service: call computeAllowedGroupIds instead of re-deriving group scope               | high   | 2     | S      | scope-analytics-to-group                                       |
| 31  | SEARCH_LANGUAGE / snippet-marker constants (cross api↔web contract)                         | high   | 2     | M      | tighten-code-quality-ratchet                                   |
| 32  | Name rate-limit config magic numbers                                                         | high   | 1     | S      | tighten-code-quality-ratchet                                   |
| 33  | Split print report template (725 lines) behind eslint-disable                                | high   | 1     | M      | sweep: apps/web/app/print                                      |
| 34  | Read PDF-export JWT secret + path via validated config                                       | high   | 1     | S      | route-pdfs-and-authz                                           |
| 35  | Strip ticket/phase/change-name archaeology prefixes from comments repo-wide                  | medium | 60    | L      | tighten-comment-policy                                         |
| 36  | Name self-contained inline magic numbers/strings (per-file)                                  | medium | 16    | M      | sweep: name-inline-magic-numbers                               |
| 37  | Shared Prisma P2002 constant + isUniqueViolation guard                                       | medium | 15    | M      | map-domain-errors                                              |
| 38  | ✅ Unify at-risk/warning colors on existing design tokens                                    | medium | 12    | M      | ✅ 5687ebfd (change dir still active)                          |
| 39  | apps/web scattered small dedups                                                              | medium | 12    | M      | sweep: apps/web small dedups                                   |
| 40  | ToolbarPillButton + variant constants (toolbar/pill strings copy-pasted)                     | medium | 11    | M      | code-health-and-test-cleanup                                   |
| 41  | PageShell/PageContainer primitive + createRoleGateLayout factory                             | medium | 11    | M      | responsive-compact-layout                                      |
| 42  | Period module internal dedup (transition types, scheduler skeleton, DI, EnsuredPeriod)       | medium | 11    | M      | sweep: apps/api/modules/period                                 |
| 43  | Shared symbols for cross-file string/URL contracts (web+api)                                 | medium | 10    | M      | tighten-code-quality-ratchet                                   |
| 44  | Fix names/comments that outlived their meaning + dead export/alias                           | medium | 10    | M      | code-health-and-test-cleanup                                   |
| 45  | Shared chart palette + time-unit constants (MS_PER_HOUR/DAY/WEEK) + graceCutoff              | medium | 8     | M      | tighten-code-quality-ratchet                                   |
| 46  | Correct stale/drifted comments that state false facts                                        | medium | 8     | M      | tighten-comment-policy                                         |
| 47  | Central BullMQ queue-name constants                                                          | medium | 8     | S      | tighten-code-quality-ratchet                                   |
| 48  | Web a11y correctness sweep (hidden focusables, accessible names, live regions)               | medium | 7     | M      | sweep: web-a11y-correctness                                    |
| 49  | Collapse 3+/boolean/same-typed API params to options objects                                 | medium | 7     | M      | sweep: parameter-objects                                       |
| 50  | DEFAULT_QUERY_STALE_TIME_MS constant                                                         | medium | 6     | S      | tighten-code-quality-ratchet                                   |
| 51  | ✅ Extract ComingSoonControl primitive (chrome duplicated across 5 sites)                    | medium | 6     | M      | ✅ 70c8cccc                                                    |
| 52  | Delete dead/speculative/redundant code (runTransition, ConfirmationDialog variants)          | medium | 6     | S      | code-health-and-test-cleanup                                   |
| 53  | createWebVitalHistogram + shared on-time-ratio query (metrics boilerplate)                   | medium | 5     | M      | observability-and-perf-hardening                               |
| 54  | useOnClickOutside hook (listener reimplemented 5×)                                           | medium | 5     | S      | code-health-and-test-cleanup                                   |
| 55  | Remove dead pointers in comments (nonexistent paths, commit hashes, rotted refs)             | medium | 5     | S      | tighten-comment-policy                                         |
| 56  | Group optional cross-cutting DI deps into one options param (no undefined holes)             | medium | 5     | S      | code-health-and-test-cleanup                                   |
| 57  | Single-home re-narrated rationale (D1, CAS, backup-window)                                   | medium | 4     | S      | tighten-comment-policy                                         |
| 58  | ORGANIZATION_SINGLETON_ID constant                                                           | medium | 4     | S      | tighten-code-quality-ratchet                                   |
| 59  | Extract isOpenBoundaryConflict + openBoundaryGuarded (scattered/re-hand-rolled)              | medium | 3     | S      | fix-manual-publish-archive-race                                |
| 60  | Shared styled ErrorFallback for route error boundaries                                       | medium | 3     | S      | input-and-error-hardening                                      |
| 61  | Single home for DEADLINE_HOUR + business-date day-boundary consts                            | medium | 3     | S      | fix-period-datetime-tz                                         |
| 62  | EDITABLE_PERIOD_STATUSES shared constant                                                     | medium | 3     | S      | tighten-code-quality-ratchet                                   |
| 63  | Options object for review acknowledge / isDesignatedReviewer (transposable params)           | medium | 3     | S      | review-acknowledgement                                         |
| 64  | Remove unnecessary state-syncing useEffects                                                  | medium | 3     | M      | code-health-and-test-cleanup                                   |
| 65  | Delete dead code / redundant idioms / lint suppressions in web components                    | medium | 3     | S      | code-health-and-test-cleanup                                   |
| 66  | ProjectActivityWriteFields type (write shape retyped 4×)                                     | medium | 2     | S      | project-activity-reporting                                     |
| 67  | MIN_SECRET_LENGTH shared constant                                                            | medium | 2     | S      | tighten-code-quality-ratchet                                   |
| 68  | pdfArtifactPath(jobId) helper (path shape repeated)                                          | medium | 2     | S      | route-pdfs-and-authz                                           |
| 69  | Make allowedScopes/mode required on shared toggles (no silent defaults)                      | medium | 2     | S      | code-health-and-test-cleanup                                   |
| 70  | Fix pdf-export status coercion + lying `as "pending"` assertion                              | medium | 1     | S      | input-and-error-hardening                                      |
| 71  | Delete JSDoc/doc-blocks on non-exported app-internal helpers                                 | low    | 20    | M      | tighten-comment-policy                                         |
| 72  | Extract errorMessage(error) helper (copy-pasted 8×)                                          | low    | 8     | S      | code-health-and-test-cleanup                                   |
| 73  | De-duplicate ROUTE_ROLE_MAP against per-layout REQUIRED roles                                | low    | 5     | S      | code-health-and-test-cleanup                                   |
| 74  | apps/api scattered small dedups                                                              | low    | 4     | S      | sweep: apps/api small dedups                                   |
| 75  | REQUEST_ID_HEADER + CORRELATION_ID_CLS_KEY constants                                         | low    | 4     | S      | observability-and-perf-hardening                               |
| 76  | Extract magic-number literals surfaced during comment cleanup                                | low    | 3     | S      | tighten-code-quality-ratchet                                   |
| 77  | Move review error classes to shared review-errors.ts                                         | low    | 2     | S      | review-acknowledgement                                         |
| 78  | Guard auto-archive vs reopen race + fail-loud on NULL publishedAt                            | low    | 2     | S      | fix-manual-publish-archive-race                                |
| 79  | Thread stable id through UnifiedSectionRow (slide lists key by index)                        | low    | 2     | M      | key-charts-by-id                                               |
| 80  | Don't fabricate an org name when session organization is missing                             | low    | 1     | S      | head-surface-parity-declutter                                  |

## Wave 3a (api) clusters — #81–#90

7 api reports (admin, auth, carry-over, period, report-sections, root, infra/trpc),
~265 raw findings (~256 after refuted local-builder immutability findings —
`dbData`, `newlyCreatedPeriods`, auto-archiver/publisher push, `published-lineage`
Sets were all killed as legit local builders). Comments dominate (154 findings),
then size/complexity, then duplication. Sorted (severity, fileCount); merges into
the #1–#80 space by the same rule. Two are behavior bugs, not cleanliness (#83, #89).

| #   | Work-item                                                                                     | Sev    | Files | Effort | Home                               |
| --- | --------------------------------------------------------------------------------------------- | ------ | ----- | ------ | ---------------------------------- |
| 81  | Single-home DEFAULT_REPORTING_GROUP_ID/NAME (4 diverged copies of the seed UUID)              | high   | 4     | S      | api-shared-guards                  |
| 82  | Split oversized carry-over fns (executeCarryOver 175 ln, saveCarryOver 80, persistCarried 76) | high   | 3     | L      | sweep: apps/api/carry-over         |
| 83  | Fix extractRecipientEmail broken `/Z:/` regex — admin recipientEmail silently wrong (BUG)     | high   | 2     | S      | api-shared-guards                  |
| 84  | Split infra trpc.router.ts (2781 ln); wrap 88× mapDomainError; dedup my/compiledHistory       | high   | 1     | L      | restructure-directory-architecture |
| 85  | Split main.ts / bootstrap (535 / 400 ln) into composition modules                             | high   | 1     | L      | restructure-directory-architecture |
| 86  | Split lead-form.prisma-repository.ts (812 ln); extract getCrossAuthors/getCrossAuthorContent  | high   | 1     | L      | sweep: apps/api/report-sections    |
| 87  | Delete dead roles.guard.ts (createRoleGuard unused; real gate = assertRole)                   | high   | 1     | S      | api-shared-guards                  |
| 88  | Split writeProvisionedUser (65 ln); extract reporting-group fallback resolution               | high   | 1     | M      | sweep: apps/api/auth               |
| 89  | Move Sentry.init out of module scope — reads process.env before validateEnv() (BUG)           | high   | 1     | S      | sweep: apps/api/main bootstrap     |
| 90  | Strip change-ref/Phase/ticket comment archaeology + relocate over-budget JSDoc (api-wide)     | medium | 139   | L      | sweep-auth-comments-exemplar       |

Wave-3a also reinforces existing rows: #37 (auth `isUserUniqueViolation` /
`isSectionUniqueViolation` are acknowledged near-verbatim P2002 copies — and wave-3a
says WIDEN the guard to P2003/P2025, which admin/lead-form also match inline) and the
per-folder period/report-sections sweeps (#10, #42).

### Wave 3a second-pass complement — #91–#95 (2026-07-05, night)

Independent clustering pass over the same 7 reports (provenance: this session's
fable agent, cross-checked against #81–#90); only the clusters NOT already
covered above:

| #   | Work-item                                                                                                                                                       | Sev    | Files | Effort | Home                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- | ------ | ----------------------------- |
| 91  | createDomainError(name) factory / DomainError base — 29 `class XError extends Error` copies                                                                     | medium | 13    | M      | api-shared-guards             |
| 92  | Admin module split+dedup: period-admin.service (559 ln), getSnapshot (121 ln), upsertByIds generic (4 upsert\*), toAdminProject / rowToReminderPolicy mappers   | high   | 5     | L      | sweep: apps/api/modules/admin |
| 93  | Make AdminRepository optional methods required; drop the repeated requireRepoMethod runtime guards                                                              | medium | 4     | S      | sweep: apps/api/modules/admin |
| 94  | SAML: COMMON*SAML_OPTIONS shared spread (6 fields duplicated across dev/prod branches) + named consts for the KEYCLOAK_SAML*\* dev fallbacks                    | medium | 1     | S      | sweep: apps/api/auth          |
| 95  | Shared traffic-light aggregation helper — aggregateTrafficLight == aggregateStageTraffic + duplicated TRAFFIC_LIGHT_RED_SEVERITY; kills the `let severity` pair | high   | 2     | S      | api-shared-guards             |

Micro-folds (no own row): buildCarryOverDedupeKey(src,tgt) → fold into #82;
carry-over `{ timeout: 15_000 }` + cron literals (`"5 0 * * *"`) + api-side
`"ru"` localeCompare sites → #36; PDF_EXPORT_SYNTHETIC_USER_ID is a non-hex
fake UUID — verify no downstream `z.uuid()` parses it (latent reject bug) →
check inside #84's router work; trpc.session-hydration.ts:35-122 mutates the
`session` PARAMETER in place (trpc.context defensively spreads DEV_SESSION to
compensate) — the worst surviving #12 case, fix with #84's router split.
SessionRevocationService placement (modules/admin → modules/auth) →
restructure-directory-architecture relocation slice.

## Cross-cutting wins (do first)

**Status 2026-07-05:** ✅ done — #14, #16, #17, #19, #27, #51; #38 done (change dir
still active); #3 ◑ partial. Absorbed by the ratchet — #45 constants (see below).
Still OPEN → see re-home: #4, #8, #15, #26, #37, #54.

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

## Re-home (2026-07-05) — the old "Routes to existing backlog" is void

**Every home change the old table named is archived.** But archiving did NOT
deliver every folded item — several changes archived with their cleanup items
untouched (verified ABSENT in code, see below). So items are re-classified by
_evidence_, not by "the home archived, therefore done." Three buckets follow:
survivors → four new changes; delivered/absorbed (evidence); orphaned (home
archived, artifact still absent — treat as OPEN).

### Survivors → four new changes (being authored now)

- **web-shared-idioms** — #4 (CardSurface primitive — ABSENT), #8 (RotatingChevron + lucide — ABSENT), #15 (formatTimestampShort + MONTHS_SHORT — `format-date.ts` exists but the shared formatter/month table don't), #26 (ROLE_LABEL in packages/shared — ABSENT), #23 (useReportShellUrlState — ABSENT), **+ viewer-redirect** (viewer shell → canonical report-URL redirect).
- **api-shared-guards** — #37 (PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE + isUniqueViolation guard — ABSENT; wave-3a confirms the near-verbatim `isUserUniqueViolation`/`isSectionUniqueViolation` copies), #21 (one guarded compare-and-set publish helper — ABSENT), **#81** (single-home DEFAULT_REPORTING_GROUP_ID), **#83** (extractRecipientEmail regex bug), **#87** (delete dead roles.guard.ts).
- **add-web-env-schema** — #5-web (declare the web-side ad-hoc `process.env` vars in a web envSchema; #5-api already ✅ e9d90b1e).
- **sweep-auth-comments-exemplar** — **#90** + surviving comment items #1, #2, #6, #35, #46, #55, #57, #71 (tighten-comment-policy archived 2026-07-03, but **139 api files still carry change-ref/Phase/ticket prefixes** — the comment policy was never applied to api).

### Delivered / absorbed by an archived change (evidence)

- **Magic-number & duplicate-string constant items** — #31, #32, #36, #43, #45, #47, #50, #58, #62, #67, #76 — absorbed by **tighten-code-quality-ratchet** §2 (no-magic-numbers error repo-wide, ad2b4b5a) + §3 (no-duplicate-string, a4f5e3a5), archived 2026-07-04.
- **#59** isOpenBoundaryConflict/openBoundaryGuarded — PRESENT; delivered by **fix-manual-publish-archive-race** (archived).
- **#14, #16, #17, #19, #20, #27, #51, #5-api** — ✅ executed, see priority table.

### Orphaned — home archived WITHOUT delivering (treat as OPEN, needs a home)

Verified ABSENT / undone in code; the change they were folded into archived without picking them up:

- **code-health-and-test-cleanup** (archived 2026-07-02): #22 (`getDialogPreset` still PRESENT — not deleted), #28 (ConfirmationDialog/useDialogFocus — ABSENT), #40 (ToolbarPillButton — ABSENT), #54 (useOnClickOutside — ABSENT), #72 (errorMessage — ABSENT), #73 (ROUTE_ROLE_MAP still un-deduped). **Not re-verified individually, assume open:** #24, #44, #52, #56, #64, #65, #69.
- **tighten-code-quality-ratchet** file-SPLIT items (the ratchet enabled rules but grandfathered the big files, which remain — see #84/#85/#86): #11, #12.
- **scope-analytics-to-group**: #30 (search does NOT call computeAllowedGroupIds — ABSENT).
- **unified-activity-entry**: #29 (findCurrentEditableReport — ABSENT).
- **Not re-verified this pass, assume open until checked:** #18, #34, #53, #60, #61, #63, #66, #68, #70, #75, #77, #78, #79, #80.

The per-folder sweeps section below (#7, #9, #10, #13, #25, #33, #39, #42, #48, #49, #74, #36) is unchanged and still valid.

## New changes needed

**Executed since 2026-07-02** (moved out of this list): centralize-redis-connection-config
(#16 ✅), centralize-web-api-url (#19 ✅), complete-env-schema-coverage (#5-api ✅),
require-period-scheduler-deps (#20 ✅), shared-coming-soon-control (#51 ✅) — all archived
2026-07-05. observability-and-perf-hardening delivered #14/#17/#27 (✅).

**Still active (landed by commit, not yet archived):**

- **unify-status-presentation** (#3) — ◑ partial (6c0f01c6 + e6f012a4); canonical status tone-token map + label/icon/dot helper + SlideStatusBadge/SlideEmptyState.
- **unify-web-status-color-tokens** (#38) — ✅ 5687ebfd; raw hex → `--color-status-*` tokens, `--color-border-subtle`. Was the prereq for #3.

**To author now (the four re-home targets above):**

- **web-shared-idioms** — #4 CardSurface, #8 RotatingChevron+lucide, #15 date formatting, #26 ROLE_LABEL, #23 useReportShellUrlState, + viewer-redirect. One web change collecting the surviving shared-idiom extractions.
- **api-shared-guards** — #37 P2002 guard, #21 CAS publish helper, #81 DEFAULT_REPORTING_GROUP_ID, #83 recipientEmail regex bug, #87 dead roles.guard.ts.
- **add-web-env-schema** — #5-web; the web-side counterpart of the archived complete-env-schema-coverage.
- **sweep-auth-comments-exemplar** — #90 + comment items #1/#2/#6/#35/#46/#55/#57/#71; strip api comment archaeology (139 files) and relocate over-budget JSDoc, exemplary-style.

**Active in the tree but out of this audit's scope:** restructure-directory-architecture
(home for #84/#85 big splits), redesign-lead-slide-by-product-grid.

## Per-folder sweeps

Gated on a clean `git status` + the **tighten-comment-policy** and **tighten-code-quality-ratchet** standards landing first (they set the comment rules and the size/immutability ratchets these sweeps must satisfy). One folder per sweep; stage only that folder's paths.

- **apps/api/modules/period**: #10 and #42, RECONCILED against the 2026-07-05 re-audit (module rewritten since the pilot). Still valid: break period-creator runOnce (~60 ln) + period-factory ensureCurrentPeriod (~86 ln); applyTransition positional params; buildTransition 64-ln switch split; NEW dup — snapshot-lifecycle.ts:48-59 vs period-transition.ts:90-103 hand-write the legacy-tuple↔periodState map in opposite directions (single-home the inverse). DROPPED: push-accumulators (re-verified as accepted local builders), EnsuredPeriod builder (no target in the rewrite), auditLogger DI single-home (mooted by require-period-scheduler-deps ✅), scheduler-skeleton dedup (diminished to low). Run together — overlapping files.
- **apps/web/report-shell-and-nav**: #7 (split shells + nav-bar; shared toolbar-state/period-list hooks; AccordionHeader; segmented-toggle options).
- **apps/web/components/dashboard**: #13 (useDashboardLoadWatchdog hook; row/section subcomponents; renderBody takes the query object).
- **apps/web/components/slides**: #25 (split section-slide-utils into model/pagination/unified/product-scoped/foreign-content; reduce over sections; useLeadSlidesDeck; drop max-lines disables).
- **apps/web/app/print**: #33 (split print template into portfolio/lead-section/loading-shell + subcomponents; remove eslint-disable).
- **apps/web small dedups**: #39 (devLoginHref reuse, ROLE_HISTORY_CONFIG lookup, ChartSlot, shouldRenderDevRoleSwitcher export, PRINT_PAGE_STYLE/chipBase, isInvalidLinkTrpcCode, delete duplicate ArchiveToggle test/impl).
- **apps/api small dedups**: #74 (drop redundant service re-parse, makeLimiter folds into #18, logDevSend helper, toCycleDateUtc).
- **name-inline-magic-numbers**: #36 (hoist self-contained per-file literals to documented module consts / HttpStatus enum / Tailwind tokens; share SYSTEM_ACTOR spread + AUTHOR_NAME_LOCALE).
- **parameter-objects**: #49 (collapse 3+/boolean/same-typed positional signatures to options objects across interface+impl+call site).
- **web-a11y-correctness**: #48 (inert collapsed content, parameterized scope-toggle label + roving-tabindex guard, real tabpanel for product-chips, accessible role-switcher name, aria-live tagline, visible lock attribution).

## Not-yet-audited (wave 3b)

**Wave 3a landed 2026-07-05** — apps/api (admin, auth, carry-over, period,
report-sections, root, trpc infrastructure) audited and folded above as #81–#90.

Still pending audit (re-check `git status` before building near them):

- **apps/web**: admin surface, lead surface, weekly-report surface, lib/mappers.
- **packages/shared**.

Wave-3b findings may add items to the homes above or spawn new ones; re-run the (severity, fileCount) sort after they land.
