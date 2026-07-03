# Per-file audit — apps/api/src/modules/telegram (2026-07-02)

Read-only calibration audit, wave 1.

4 files reviewed, 13 findings kept, 1 killed by verification.

## telegram.module.ts (2 findings)

| Lines      | Dimension  | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                  | Suggestion                                                                                                                                                                                                                                                                                                                                                    | Your verdict |
| ---------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 9-24,30-43 | comments   | high     | ~30 combined lines of comment across the `selectTelegramAdapter` JSDoc and inline TODO block, including a dated business decision ("REGISTRATION DECISION (locked 2026-05-12): No standalone Telegram registration...") embedded directly in application code — ~10x over the 3-line comment budget.                                                                     | Relocate the registration/SSO-binding decision to an ADR or openspec spec; leave a <=2-line pointer. Trim the JSDoc above `selectTelegramAdapter` to the single non-obvious WHY (fail-loud vs. silent fallback to mock) and drop the rest. The `Not implemented — see TODO(<ref>)` throw itself is required by the deferred-feature convention and must stay. |              |
| 26         | env-config | high     | `process.env.TG_BOT_TOKEN` is read ad-hoc via `?.trim() ?? ""` at module-construction time, duplicated verbatim in `apps/api/src/infrastructure/trpc/trpc.router.ts:1036` (`integrationsStatus`). `TG_BOT_TOKEN` is not declared in `env.schema.ts` at all, bypassing the schema/requireEnv convention, and the two call sites can drift on what counts as "configured". | Add `TG_BOT_TOKEN` as an optional field to `env.schema.ts` (documented, no silent default masking), and expose a single exported helper (e.g. `isTelegramConfigured(env)`) that both `selectTelegramAdapter` and `trpc.router`'s `integrationsStatus` call, instead of each re-implementing the trim/empty-string check.                                      |              |

Already good: Adapter selection is a pure factory function separate from the `@Module` class, and `TelegramProcessor` construction is wired via `useFactory`/`inject` rather than field injection — clean DI composition.

## telegram.adapter.ts (5 findings)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                       | Suggestion                                                                                                                                                           | Your verdict |
| ----- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1-16  | comments  | medium   | 16-line header comment mixing phase/ticket archaeology ("Phase 55 (UFB-056)", "Seeds-only scaffolding") with load-bearing design rationale (why Telegram gets its own port instead of folding into EmailService) — 5x over the 3-line budget. | Delete the phase/ticket references. Relocate the "why a separate seam" rationale to an ADR or the relevant openspec spec, and leave a <=2-line pointer comment here. |              |
| 18-23 | comments  | low      | JSDoc on `TelegramSendResult` narrates future plans ("the future real adapter will widen this...") — over the 3-line budget and speculative, not a present-code WHY.                                                                          | Delete; if the widen-later plan matters, track it in the deferred-feature TODO/spec, not a JSDoc block.                                                              |              |
| 28-36 | comments  | low      | 9-line JSDoc on the 2-param `TelegramAdapter.send` is over budget for a self-explanatory 2-param interface (chatId/text names already say what they are).                                                                                     | Trim to at most a 1-line note on the bigint-avoidance reasoning for chatId; drop the rest.                                                                           |              |
| 41-45 | comments  | low      | JSDoc on the `TELEGRAM_ADAPTER` token repeats what the `AI_ADAPTER`-mirroring convention already establishes elsewhere and carries a phase ref ("Phase 54") — narration plus archaeology, not a non-obvious WHY.                              | Trim to 1 line ("DI token — mirrors AI_ADAPTER") or delete.                                                                                                          |              |

Already good: Minimal single-method port interface plus a string-literal DI token — small, single-purpose, easy to scan, consistent with the AI_ADAPTER pattern elsewhere.

## mock-telegram.adapter.ts (3 findings)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                     | Suggestion                                                                                                          | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1-8   | comments  | medium   | 8-line header with phase/ticket archaeology ("Phase 55 (UFB-056)") ahead of the determinism rationale — over the 3-line budget.                                                             | Delete the phase/ticket prefix; keep only the determinism WHY in <=3 lines.                                         |              |
| 20-25 | comments  | low      | 6-line JSDoc on the public `lastPayload` field explains test-usage narration beyond the 3-line budget.                                                                                      | Trim to a single line keeping the non-obvious bit, e.g. "Test hook; intentionally mutable so the mock stays cheap." |              |
| 28-34 | comments  | low      | 7-line JSDoc on `send()` narrates what the code already shows (writes JSON to stderr, matches another file's format) — over budget, references another file by name (archaeology-adjacent). | Delete or trim to 1 line if the log-format-parity fact is genuinely load-bearing for a dashboard consumer.          |              |

Already good: Genuinely deterministic stub (no network, no timers besides `Date.now` for the log line) with a single small `send()` method — easy to reason about and test against.

## telegram.queue.ts (3 findings)

| Lines | Dimension  | Severity | Finding                                                                                                                                                                                                                                                         | Suggestion                                                                                                                                                                                                                | Your verdict |
| ----- | ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1-15  | comments   | medium   | 15-line header comment mixes phase/ticket archaeology ("Phase 55 (UFB-056)", "Phase 28-03") with load-bearing rationale (raw `new Worker()` to work around the `@nestjs/bullmq` 11 + NestJS 11 `DiscoveryService` DI bug) — over budget.                        | Delete phase/ticket refs; keep the DI-bug workaround rationale in <=3 lines, relocate further detail to an openspec spec/ADR if more context is needed.                                                                   |              |
| 47-52 | comments   | low      | 6-line JSDoc on `TELEGRAM_OUTBOUND_JOB_OPTS` over the 3-line budget.                                                                                                                                                                                            | Trim to 1-2 lines covering only the non-obvious WHY (why attempts:3 / 5s floor), drop the "centralised here so producers don't drift" narration.                                                                          |              |
| 65-71 | parameters | low      | `TelegramProcessor` constructor takes 3 params (adapter, optional logger, optional cls) of 3 distinct types — at the >=3 threshold where the profile calls for an options object, though two are optional and it mirrors an existing sibling-processor pattern. | Low priority: if this constructor shape is touched again, consider an options object (`{ adapter, logger, cls }`); not worth an isolated refactor today given it matches the codebase's established processor convention. |              |

Already good: `TELEGRAM_OUTBOUND_JOB_OPTS` groups every magic retry/backoff/cleanup number into one named, documented constant — exactly the CONSTANTS discipline the profile wants, and it correctly centralizes drift risk across producers. Correct `OnModuleInit`/`OnModuleDestroy` lifecycle (worker created and closed explicitly); failure handling and job processing are each split into their own small private method (`logFailure`, `processJob`) rather than inlined in the callback.

## Rollup

**By dimension:**

- comments: 10 (2 high, 3 medium, 5 low)
- env-config: 1 (high)
- parameters: 1 (low)

**By severity:**

- high: 2
- medium: 3
- low: 8

**Top-3 highest-impact:**

1. `telegram.module.ts:26` — duplicated ad-hoc `TG_BOT_TOKEN` read, missing from `env.schema.ts`, bypasses the requireEnv convention and can drift between call sites.
2. `telegram.module.ts:9-24,30-43` — dated business decision (SSO-binding lock) embedded in code comments instead of an ADR/spec.
3. `telegram.adapter.ts:1-16` / `telegram.queue.ts:1-15` — phase/ticket archaeology mixed with genuinely load-bearing design rationale (separate port seam; DI-bug workaround), both needing relocation not deletion.

**Overlap with pending openspec changes:** none of the 13 findings match any item in the pending list (no telegram-specific change exists there, and none of the findings touch publish/archive races, review-acknowledgement, autosave, metrics, deploy, or the other listed surfaces). All 13 are in-scope for a standalone style/hygiene sweep of this module, not a pending change.

## Killed by verification

- `telegram.queue.ts:85-90` (constants, medium): `concurrency: 2` flagged as an inline magic number needing extraction to a named `TELEGRAM_WORKER_CONCURRENCY` constant. Refuted — the literal `2` is explicitly in the taste profile's allowed inline set (0/1/-1/2), and it already carries a 3-line rationale comment (Telegram 30 msg/s rate limit, seeds-only path), a within-budget non-obvious WHY. Extraction would add ceremony for a value the profile permits inline.
