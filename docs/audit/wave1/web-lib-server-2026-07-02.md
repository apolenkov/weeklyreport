# Per-file audit — apps/web/src/lib/server (2026-07-02)

Read-only audit, wave 2 web.
3 files audited, 10 findings kept, 0 killed by verification.

## get-org-public.ts (3 findings)

| Lines | Dimension   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                    | Suggestion                                                                                                                                                                                                                            | Your verdict |
| ----- | ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 24-30 | env-config  | high     | `resolveApiUrl()` uses a silent fallback chain `process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"` for a product-config value — repo rule bans fallback chains for product config; the same chain is duplicated verbatim in get-server-session.ts:37-42, get-print-route-context.ts:37-43, and apps/web/src/app/api/client-logs/route.ts:3 | Extract one `resolveApiUrl()`/`requireApiUrl()` into a shared module that reads via a required env accessor (fails loud on missing var in production); import from all four call sites                                                |              |
| 32-53 | duplication | high     | `TrpcBatchEntry` interface and the decode-superjson-batch-response logic (unwrap array[0], check `.error`, unwrap `{ json: ... }`) is re-implemented nearly identically in get-server-session.ts:44-67 and get-print-route-context.ts:45-73; only the final field-extraction differs                                                                                       | Factor a shared `decodeTrpcBatchPayload`/`decodeSuperjsonBatch<T>` helper in one place; each call site keeps only its field-specific mapping                                                                                          |              |
| 6-23  | comments    | medium   | 18-line JSDoc header carrying ticket/phase archaeology (`UFB-070 (2026-05-11)`, `A9 (2026-05-12)`) well past the 3-line WHY budget; narrates history rather than explaining a non-obvious current-code WHY                                                                                                                                                                 | Delete ticket/date prefixes and "follows the same pattern as..." narration; keep only the load-bearing WHY (force-cache + tag-based invalidation) in <=3 lines, relocate any durable rationale to an openspec spec if it must survive |              |

Already good: correct fail-closed default (DEFAULT_ORGANIZATION_IDENTITY) on any network/parse/shape error; small, single-purpose file focused on one concern.

## get-print-route-context.ts (4 findings)

| Lines | Dimension   | Severity | Finding                                                                                                                                                                    | Suggestion                                                                                                                                                                                               | Your verdict |
| ----- | ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 37-48 | duplication | high     | `resolveApiUrl()` and `TrpcBatchEntry` are byte-for-byte duplicates of get-org-public.ts:24-35 and get-server-session.ts:33-47                                             | Same as the get-org-public.ts finding — consolidate into one shared module                                                                                                                               |              |
| 8-22  | comments    | medium   | 15-line JSDoc header with a ticket/task reference (`fix-report-surface-integrity W2 (task 3.3)`), exceeding the 3-line comment budget and narrating implementation history | Trim to the single non-obvious WHY (route not covered by the proxy auth matcher, so the gate must self-handle no-session) in <=3 lines; drop ticket prefix and "Mirrors get-server-session.ts" narration |              |
| 78-82 | duplication | medium   | `shouldUseDevFallback` dev-mode gate is duplicated verbatim in get-server-session.ts:72-76 (identical NODE_ENV/AUTH_DEV_MODE/AUTH_DEV_MODE_ALLOW_TEST check)               | Extract a shared `shouldUseDevAuthFallback(): boolean` helper next to AUTH_COOKIE_NAME and call it from both files                                                                                       |              |
| 23    | naming      | low      | `const COOKIE_NAME = AUTH_COOKIE_NAME;` is a pointless re-aliasing of an already-well-named imported constant; the identical alias is repeated in get-server-session.ts:31 | Use AUTH_COOKIE_NAME directly and drop the local alias in both files                                                                                                                                     |              |

Already good: PrintRouteContext and NO_CONTEXT are readonly/immutable; decodePrintGateResponse is pure and exported for unit testing, keeping IO and decoding cleanly separated.

## get-server-session.ts (3 findings)

| Lines | Dimension   | Severity | Finding                                                                                                                                                                                                                           | Suggestion                                                                                                                                                                                                                      | Your verdict |
| ----- | ----------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 33-47 | duplication | high     | `resolveApiUrl()` and `TrpcBatchEntry` duplicate get-org-public.ts:24-35 and get-print-route-context.ts:37-48 exactly                                                                                                             | Same as the get-org-public.ts finding — consolidate into one shared module used by all three (four, counting client-logs/route.ts) call sites                                                                                   |              |
| 8-30  | comments    | medium   | 23-line JSDoc header mixing ticket/phase archaeology (`AUTH-07 (Phase 29-03)`) with a genuinely load-bearing threat model (T1-T3: UX-only gate, batch-shape quirk, stale-session limitation) — far past the 3-line comment budget | Drop the ticket/phase prefix; the T1-T3 notes are real load-bearing rationale — relocate to an openspec spec/ADR per the tighten-comment-policy "over-budget load-bearing rationale" rule, leave only a 1-3 line pointer inline |              |
| 72-76 | duplication | medium   | `shouldUseDevFallback` block duplicated verbatim with get-print-route-context.ts:78-82                                                                                                                                            | Extract a shared helper as noted in the get-print-route-context.ts finding                                                                                                                                                      |              |

Already good: fail-closed on any error (returns null, not a cached/stale session); decodeAuthMeResponse is a pure, independently testable function.

## Rollup

By dimension: duplication 5 · comments 3 · env-config 1 · naming 1

By severity: high 5 · medium 4 · low 1

Top-3:

1. `resolveApiUrl()` env-config fallback chain duplicated 4x (get-org-public.ts, get-print-route-context.ts, get-server-session.ts, client-logs/route.ts) — silent product-config default, highest risk.
2. `TrpcBatchEntry` / superjson-batch-decode logic duplicated 3x across the same files — biggest single duplication block.
3. Ticket/phase-archaeology JSDoc headers (18/15/23 lines) in all three files, blowing the 3-line comment budget.

Overlaps a pending OpenSpec change (handle there, not in a style sweep):

- The three comments findings (get-org-public.ts:6-23, get-print-route-context.ts:8-22, get-server-session.ts:8-30) overlap **tighten-comment-policy** — fold into that change rather than fixing ad hoc here.

## Killed by verification

None — all 10 findings held up.
