## Context

The AI control plane stores an immutable provider configuration plus mutable
operational state. `admin.aiProvider.test` currently uses the same persistence
transition for every revision, even when the revision is the live one. The
Lead toolbar treats an unresolved availability query as enabled. Legacy
bootstrap still carries a Mistral regional selector although the approved
built-in profile has one global endpoint.

## Goals / Non-Goals

**Goals:**

- Preserve the live runtime while allowing an administrator to retest it.
- Make the built-in Mistral endpoint globally deterministic.
- Prevent the assistant UI from opening before an explicit availability grant.

**Non-Goals:**

- Add a Mistral regional endpoint setting or migrate stored revisions.
- Alter credentials, activation preparation, tRPC authorization, or Prisma
  models.

## Decisions

### Retest active revisions without a lifecycle transition

The draft service will pass the revision's current lifecycle into the
repository test-result update. The repository will always persist the new safe
test result, measurement, and timestamp, but only draft-like revisions change
to `validated` or `failed`; an active revision remains `active`.

Before: `test(active)` → capability probe → `setTestResult` → `validated` or
`failed` → active pointer is no longer resolvable.

After: `test(active)` → capability probe → update result metadata while keeping
`active` → active pointer remains resolvable.

Rejecting active retests was considered, but retaining the operation is more
useful to administrators and matches the approved behavior.

### Remove the legacy regional selector

`MISTRAL_API_SERVER` will be removed from the validated environment type,
bootstrap completeness check, Compose pass-throughs, examples, and rollout
documentation. Bootstrap will always create the built-in Mistral profile,
whose fixed global base URL is the sole endpoint. No stored revision contains
the removed setting, so no data migration is needed.

### Fail closed in the toolbar

The React control is enabled only when
`availability.data?.availability === "available"`. Loading and error states
remain visible but disabled, so no assistant request can originate before the
server's explicit availability response.

The change preserves the role-coverage gate: all server calls and controls
retain their existing canonical procedures. It does not affect the period
dual-state invariant or require destructive database work.

## Risks / Trade-offs

- [A retest finds a real provider failure while it stays active] → Persist and
  show the failed capability result, but leave explicit disable or activation
  of a replacement to the administrator.
- [Existing deployment supplies `MISTRAL_API_SERVER`] → Removing it is safe
  because global is the selected product endpoint; deployment configuration
  must remove the obsolete variable.
- [Availability request fails transiently] → The assistant remains unavailable
  until a later refetch succeeds, favouring correct authorization posture over
  optimistic access.

## Migration Plan

1. Deploy the API and web changes together; no schema migration is required.
2. Remove `MISTRAL_API_SERVER` from deployment secrets and Compose files.
3. Run the existing bootstrap only if the database has no configuration row.
4. Rollback is code-only; existing encrypted revisions remain valid.

## Open Questions

None.
