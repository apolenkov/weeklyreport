## Context

This is a security/observability change. The audit stream
(`apps/api/src/lib/audit-logger.ts`) has fourteen events but covers the
group-scope boundary on the deny side only. `scopeDenied` fires when a
non-admin probes a resource outside their scope
(`apps/api/src/infrastructure/trpc/trpc.router.ts:1585`, `:2156`); there
is no matching event when scope legitimately _grants_ a cross-group read.

The gap is concrete in one place. Phase 56-D opted the weekly-report
portfolio read into the explicit `GroupProduct` join
(`apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts:82`,
flag `useExplicitGroupProducts: true`). A product attached to two groups
via that join now surfaces in both groups' weekly reports
(`apps/api/src/lib/group-scope.ts:80`). When a caller sees a product
whose natural owner (the lead's `reportingGroupId`) is a _different_
group, that is a cross-group access worth recording — the live
`TODO(scopeAccessed-audit)` at
`weekly-report.prisma-repository.ts:79`-`:81` marks exactly this, noting
the logger has only `scopeDenied` and that high-cardinality logging
needs its own design. This change is that design.

### Current data flow (read path)

1. Router `weeklyReport.get` query passes `ctx.session` into the service
   (`trpc.router.ts:1842`). `ctx.session` and `ctx.ip` are present here.
2. Service `getWeeklyReport` resolves the report id and calls the
   repository (`weekly-report.service.ts:88`).
3. Repository builds `projectScope` via `scopeWhere(session, "project",
{ useExplicitGroupProducts: true })`
   (`weekly-report.prisma-repository.ts:82`) and runs
   `prisma.project.findMany` including only `stageAssignments`
   (`:105`-`:110`). No event is emitted; the TODO sits between scope
   build and query.

## Goals / Non-Goals

**Goals:**

- Emit a `scopeAccessed` audit event when a non-admin caller's
  weekly-report read surfaces at least one cross-group product.
- Keep the payload whitelisted (caller, surfaced product/group ids,
  route) — no row contents, mirroring the `scopeDenied` precedent.
- Bound volume: at most one event per request, regardless of how many
  cross-group products surface.

**Non-Goals:**

- No change to which rows the read returns (`scopeWhere` semantics are
  untouched).
- No coverage of other read surfaces (archive, admin); only the
  weekly-report gap the TODO marks.
- No new transport, env var, or sampling config.

## Decisions

### D1 — Where the cross-group flag is computed: in the repository read

The repository is the only layer that knows which products came in
through the explicit join versus the caller's natural group. The read
adds `lead: { select: { reportingGroupId: true } }` (the product's
natural owner) to the existing `findMany` include
(`weekly-report.prisma-repository.ts:105`-`:110`) and compares each
surfaced product's owner group against the caller's allowed group ids.
A product whose owner group is not in the caller's set, yet surfaced,
is cross-group.

The repository does NOT call the logger itself — it has no `ip` and no
`AuditLogger` (constructor is `prisma`-only,
`weekly-report.prisma-repository.ts:31`). Instead it returns a small
`crossGroupProductIds: string[]` signal up through the read model so the
caller can decide whether to emit.

_Alternative considered:_ inject `AuditLogger` + an actor context into
the repository. Rejected — it widens the repository constructor, drags
`ip` down two layers, and breaks the existing pattern where every audit
event is emitted at the router where `ctx` lives.

### D2 — Where the emit hook lives: the router query, beside the existing audit calls

Emit at `weeklyReport.get`
(`trpc.router.ts:1842`-`1869`), the same layer that already logs the
load and where both `scopeDenied` callsites live. The query already has
`ctx.session.userId`, `ctx.session.role`, `ctx.ip`, and the resolved
report id in scope. The service forwards the repository's
`crossGroupProductIds` signal; the router emits once when it is
non-empty and the role is not admin.

_Alternative considered:_ emit in the service. Rejected — the service
has no `ip`; keeping all audit emission at the router preserves the
one-place-to-audit convention.

### D3 — Volume control: per-request dedupe, NOT sampling

Reads are frequent, so the naive "one line per cross-group row" would be
noisy. The decision is **per-request dedupe**: collapse all cross-group
products surfaced by a single read into one event whose payload lists
the product ids and the distinct surfaced group ids. One read =
at most one `scopeAccessed` line.

Sampling was weighed and rejected for a security signal: dropping a
fraction of access events defeats the investigative purpose the deny
side already serves at full fidelity. Per-session dedupe (suppress
repeats within a session) was also weighed and deferred — it needs a
per-session store the audit path does not have today, and the
per-request collapse already removes the dominant fan-out (many rows
per read). If volume is still a problem after rollout, per-session
dedupe is the documented next lever (see Open Questions).

### D4 — Payload shape: mirror `scopeDenied`, add the surfaced ids

`ScopeAccessedInput = Omit<AuditEnvelope, "event" | "attemptedRole"> & {
accessedScope: string; productIds: readonly string[]; groupIds:
readonly string[]; resourceId: string }`. `accessedScope` is the
literal route marker (e.g. `"weeklyReport.project"`), `resourceId` is the
report id, `productIds`/`groupIds` are the surfaced cross-group ids.
Emitted at `info` (granted access is normal traffic), matching the
`loginSuccess`/`mutation`-success level; `scopeDenied` stays at `warn`.
The whitelist-at-type-level discipline from the envelope's threat-model
notes (`audit-logger-types.ts:14`-`:26`) is preserved — only typed ids
flow, never row contents.

## Risks / Trade-offs

- [Extra relation in the read] → The `findMany` gains a thin
  `lead.reportingGroupId` select; no extra round-trip, one added column
  on an already-fetched row. Negligible.
- [False "cross-group" if a product is genuinely owned by the caller's
  group but also joined elsewhere] → The comparison is "owner group not
  in caller's allowed set", so a product the caller naturally owns never
  counts as cross-group even if it is also joined to another group.
- [Volume after rollout] → Per-request dedupe caps each read at one
  line; if still noisy, per-session dedupe is the documented follow-up
  (Open Questions), not a re-architecture.
- [Admin reads] → Admin has no scope filter (`group-scope.ts:61`
  returns `{}`), so admin never triggers the event; the emit guard
  checks role explicitly.

## Invariants

- **repository-scope-guard** (durable): preserved. This change reads the
  same scoped result set; it adds an audit signal, not a new filter or a
  widened query.
- **deferred-feature-pattern** (durable): this change _retires_ a
  deferred path (`TODO(scopeAccessed-audit)`), the inverse of deferring
  one; the loud-stub rule does not apply because the feature is now
  implemented, not stubbed.
- **role-coverage-gate** (durable): no new tRPC procedure — the emit is
  added inside the existing `weeklyReport.get` query, so the canonical
  middleware-chain count is unchanged.
- **period-dual-state**, **destructive-db-guard**: not touched (no
  schema write, no period transition).
- **status-color-semantics**, **ui-control-density**: not applicable
  (backend-only, no UI).

## Migration Plan

No data migration, no schema change. Ship is purely additive:

1. Add the `scopeAccessed` event type, input, and method (logger +
   no-op).
2. Surface `crossGroupProductIds` from the repository read; thread it
   through the service response.
3. Emit at the router query.
4. Remove the TODO comment block.

Rollback is reverting the commit — the new event simply stops being
emitted; no consumer depends on its presence yet.

## Open Questions

- Per-session dedupe: deferred. If post-rollout volume warrants it, add
  a per-session suppression window keyed on
  `(userId, accessedScope, groupIds)`. Needs a store the audit path
  lacks today — track as a follow-up, not in this change.
- Should other explicit-`GroupProduct` consumers (when they opt into the
  flag) reuse this event? Likely yes via the same router-emit pattern,
  but each is its own change; this one scopes to weekly-report only.
