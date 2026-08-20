## Context

The profile registry exposes fixed Groq and Jina endpoints, while `.env`, `.env.example`, and test configuration allow only Mistral/OpenRouter (plus the test-only example origin). Consequently, the tRPC save path rejects a profile pair that the Provider form offers. Separately, the Provider card derives display feedback as `historicalExecutionMessage ?? currentOperationMessage`, so an older failed execution masks the actual result of a later save.

No request contract, Prisma write, or shared schema changes. The before/after flow is:

- Before: Save mutation → endpoint policy rejects Groq/Jina → mutation stores the correct error locally → card replaces it with the prior revision's execution message.
- After: Save mutation → checked-in dev policy accepts the fixed Groq/Jina origins → success feedback is displayed; for any later operation error, that current operation feedback wins over historical execution detail.

## Goals / Non-Goals

**Goals:**

- Keep the checked-in non-production allowlist aligned with built-in profile choices.
- Show the outcome of the administrator's current operation without losing historical test detail.
- Lock both behaviors down through public UI and configuration-policy seams.

**Non-Goals:**

- Relax custom endpoint validation or add wildcard origins.
- Change provider tests, prompt evaluations, credentials, or activation behavior.
- Change production deployment policy automatically.

## Decisions

1. Add exact origins, not wildcard/profile bypasses. Groq resolves to `https://api.groq.com/openai/v1` and Jina to `https://api.jina.ai/v1`; only their normalized origins join the explicit allowlist. This preserves the SSRF and credential-exfiltration boundary.
2. Treat the current mutation message as the primary operation feedback. Historical execution feedback remains useful only when no current operation message exists. An alternative was to clear the old revision after every operation error, but that would remove useful configuration and test detail from the card.
3. Test the rendered Provider-card seam using a failed historical revision plus a current save error. This asserts what the administrator sees without coupling the test to state helper internals.

The period dual-state invariant, role-coverage gate, destructive-db guard, and deferred-feature pattern are unaffected.

## Risks / Trade-offs

- [Risk] A production deployment may intentionally omit Groq or Jina. → Mitigation: only checked-in development/example policy changes; production remains explicitly environment-owned.
- [Risk] A stale operation message can outlive a later background refresh. → Mitigation: mutation handlers already replace the message on every operation; polling detail is used only when no operation message is present.
- [Risk] Tests could assert internal selection order rather than UI behavior. → Mitigation: assert the visible status text through the rendered card.

## Migration Plan

Update non-production environment values and restart the API so validated configuration reloads. No database migration or destructive operation is required. Rollback removes the two origins and restores the previous message precedence.

## Open Questions

None.
