## Context

The actual single-revoke route already produces groupScopeFilter, but the service forwards it only to its read. Parent lifecycle locking and submitted CAS already exist. The verdict caller separately locks live entitlement and passes its judged version.

Current shared UUID admission accepts restored version6/7/8 identities; both existing query owners can encode those coordinates but reject them with a narrower regex. The captured RED consumes actual first-page cursors, not a copied codec.

Item save already enforces code-point caps and status-specific next-step/pause rules. Status selection changes only status, leaving previously reported errors stale. Reopen already sends trim()-normalized text while its displayed counter/gate still counts raw padding.

## Goals / Non-Goals

Repair these existing producer contracts at their current owners. No new role policy, scope builder, generic normalization framework, Unicode/grapheme policy, database emulator or test-only export. Existing published message/status/code-point repairs are reused.

## Decisions

Use module-local z.uuid().safeParse at both decoders; preserve cursor wire coordinates, dates, source and typed invalid-cursor errors.

Make scope mandatory on the existing repository and transaction boundary. applyRevokeTransition uses AND of its existing id/status/report/version predicate and caller scope. Verdict passes explicit empty scope after its existing locked entitlement gate. A zero single-write result rechecks only scoped identity, preserving NOT_FOUND for unavailable targets and existing constraint errors otherwise.

Move existing status-dependent save checks to a helper with two real production consumers. Status selection recomputes only fields with prior reported errors and retains unrelated errors/drafts; save behavior and precedence remain unchanged.

Reopen computes trimmed payload/count once. RecordTextareaField accepts one optional explicit characterCount used by this real consumer; all other fields retain their current raw code-point count. No maxLength, truncation or future normalizer option.

Comment error classification uses the same code-point length as the existing counter and schema. An unsupported raw draft within that budget retains the existing visible-character error, never a false over-limit error. Schema rejection, raw retention and mutation refusal are unchanged; native clipboard admission is not proven.

## Risks / Trade-offs

Pure current-producer query-argument proof does not prove PostgreSQL interleaving or permission-race closure. Integration caller signatures are updated only with Root ownership grants and remain unrun. DOM proof does not establish native focus, geometry, network or assistive technology outcomes.
