# Design

## Decisions

Reuse each existing owner. Annotation scope requires the author for non-status keys. SSE checks response openness after awaits and per delivery, retains undelivered cursor positions, closes post-flush failures without JSON and preserves idempotent timer cleanup. Thread ordering adds id only after timestamp. Period lookup parses every row before excluding valid non-draft history; publication count comes from the committed returned sections. Carry-over uses the injected shared logger. Telemetry returns an internal latest nullable ratio and unchanged compact numeric history with cache namespace v2.

## Test Audit

Each behavioral root has one primary existing owner. SSE source doubles provide reads/errors only; actual stream writes/cursors/listener counts are asserted. Wire/repository delegates provide rows and database query equality, not authorization policy. Period factory tests feed valid/invalid tuples; scheduler tests supply committed sections and an unavailable post-commit count. Module test resolves the actual production provider and exercises actual carry-over outcomes. Telemetry repository uses schema-valid admitted frozen rows; service tests independently guard public composition/cache identity. No production seams or private helper exports are added. Timestamp ties are a database ordering contract; native PostgreSQL ordering remains Root acceptance.

## Preserved contracts and limits

Immutable feedback author/role/group scope stays unchanged by Root decision. Existing SAML blank/redirect and prompt-limit repairs are reused. Reminder rule deletion cascades execution rows; no orphan terminalization is added. Ambiguous renderer failures remain retryable. No arbitrary caps, normalized opaque identity bytes or new privacy/event policy.

## Verification and rollout

Genuine baseline RED precedes each newly repaired behavior. One focused file per WR mutex60/nice10/workers1; strict ESLint covers all changed source and tests. Seven external artifacts retain every original/card/subclaim/risk and exact base/after seals. Native HTTP/PG/Redis/queue/provider outcomes, full gates and independent review remain separate Root acceptance. No migration; Root integrates the source checkpoint with ordinary hooks.
