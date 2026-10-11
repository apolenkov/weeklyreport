# Design

## Context

See proposal.md for motivation. `wipeAndReseed` currently concatenates child stdout into its success output and embeds child failure text/stderr in a TRPCError. The tRPC formatter strips stack/cause fields but preserves the error message and adds the request id. Nest's real ExceptionHandler calls Logger.error with an Error and its context; the adapter stringifies that Error and drops its stack/name.

## Decisions

Reseed flow before: child output/error → raw text projection → tRPC response → role-switcher toast. After: child exit/result → fixed success summary or generic INTERNAL_SERVER_ERROR → existing formatter/request id → caller. Discard raw output at this response boundary instead of moving it into an unredacted log. Keep the existing `{ ok, variant, output }` success shape so the public client contract remains stable.

Nest flow before: ExceptionHandler → Error string → AppLogger. After: ExceptionHandler → Error string plus name/stack → AppLogger. Only actual Error instances supply metadata. An explicit caller stack overrides the Error stack; a missing explicit stack does not erase it. Two-argument string context remains unchanged. Causes and extra properties are not traversed.

## Invariants

The canonical protectedProcedure, AUTH_DEV_MODE gate, exact destructive-target guard, per-run consent, child command order/timeouts and in-flight cleanup stay intact. Report period/lifecycle writes and role builders are unaffected.

## Risks / Trade-offs

- Raw reseed diagnostic text no longer reaches the caller → the response retains safe failure code/message and existing request id; this change introduces no unredacted replacement sink.
- Error stacks can contain internal source locations → stacks remain in the existing server AppLogger error sink and are not copied into API responses; no new serializer or sink is introduced.
- A native seed guard refusal proves a genuine diagnostic producer, not reset/seed completion → tests deliberately reject before any database work and use an in-memory tRPC transport.

## Migration Plan

No migration or feature flag is required. Apply the two API sources and existing tests together. The coordinator runs normal hooks and aggregate gates/review, then synchronizes these deltas. Rollback restores the old source behavior and must be accompanied by an explicit reassessment of the exposed diagnostics.
