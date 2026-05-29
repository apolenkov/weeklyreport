import type { PeriodState } from "@customreport/shared";

/**
 * refactor-period-transition-writer: the single, pure source of truth for the
 * `Report` lifecycle field set.
 *
 * A `Report` row carries three coupled lifecycle representations plus audit
 * flags and timestamps:
 *
 *  - `periodState`  — canonical (scheduled | open | published | archived)
 *  - `status` + `archived` — legacy tuple (draft | published) × boolean
 *  - `periodStatus` — reopen flavour (open | published | reopened)
 *  - `autoPublished` / `autoArchived` — audit flags
 *  - `publishedAt` / `publishedById` / `reopenedAt` — timestamps
 *
 * No database constraint ties these together; the `period-dual-state` invariant
 * is the only contract. {@link buildTransition} owns it: callers express an
 * intent and receive the COMPLETE governed field set for that transition, so
 * one representation can never be written without the others. The builder is
 * pure (no Nest, no Prisma client, no `new Date()` — timestamps arrive via
 * `ctx`) and therefore exhaustively unit-testable without a database.
 *
 * The identity tuple (`periodStart` / `periodEnd` / `deadline` / `weekLabel` /
 * `year` / `week` / `quarter`) is NOT governed here — it is written once at
 * creation by the caller and never transitions.
 *
 * This module absorbs the former `weekly-report/period-state.ts` helpers
 * (`legacyTupleToState` / `stateToLegacyTuple` / `initialPeriodState`) as
 * internals; they are no longer a separately-importable shim.
 */

/**
 * The bare-scalar lifecycle subset every transition produces. Every value is a
 * plain scalar (never a Prisma `{ set }` update wrapper), so the object is
 * assignable to both `Prisma.ReportUpdateInput` (existing-row transitions via
 * `applyTransition`) and `Prisma.ReportCreateInput` (the `create` path, which
 * spreads it alongside the identity envelope).
 */
export type LifecycleWrite = {
  periodState?: PeriodState;
  status?: "draft" | "published";
  archived?: boolean;
  periodStatus?: "open" | "published" | "reopened";
  autoPublished?: boolean;
  autoArchived?: boolean;
  publishedAt?: Date | null;
  publishedById?: string | null;
  reopenedAt?: Date | null;
};

/**
 * Per-kind context. The mapped type ties each `kind` to exactly the inputs that
 * transition needs, so a caller cannot, e.g., `publish` without a `userId` or
 * `unarchive` without the derived next state.
 */
export type TransitionCtx = {
  /** Mint a new period; initial state derived from whether it has started. */
  create: { periodStart: Date; now: Date };
  /** Force the scheduled state (future period minted ahead of its start). */
  schedule: Record<string, never>;
  /** SCHEDULED→OPEN flip once a period's start day is reached. */
  open: Record<string, never>;
  /** Head-driven publish. */
  publish: { now: Date; userId: string };
  /** Scheduler-driven publish past the deadline + grace window. */
  autoPublish: { now: Date };
  /** Reopen a published period for further edits (asymmetric, see below). */
  reopen: { now: Date };
  /** Manual archive. */
  archive: Record<string, never>;
  /** Scheduler-driven archive past the retention window. */
  autoArchive: Record<string, never>;
  /**
   * Un-archive. The caller derives `nextPeriodState` from the surviving legacy
   * tuple (it requires a DB read, which a pure builder must not do) and passes
   * it in.
   */
  unarchive: { nextPeriodState: PeriodState };
};

export type TransitionKind = keyof TransitionCtx;

/**
 * Internal: the legacy `(status, archived)` projection of a given state. Kept
 * here (formerly `period-state.ts#stateToLegacyTuple`) so callers never
 * hand-assemble the tuple. The `scheduled` and `open` states share the same
 * projection — the legacy tuple cannot distinguish them, which is exactly what
 * the explicit `periodState` column buys us.
 */
function legacyTuple(state: PeriodState): {
  status: "draft" | "published";
  archived: boolean;
} {
  switch (state) {
    case "archived":
      return { status: "published", archived: true };
    case "published":
      return { status: "published", archived: false };
    case "scheduled":
    case "open":
      return { status: "draft", archived: false };
  }
}

/**
 * The initial state for a freshly-created period (formerly
 * `period-state.ts#initialPeriodState`): `scheduled` when the period has not
 * started yet (`periodStart > now`), otherwise `open`.
 *
 * Exported because the two creation paths (admin manual create and the
 * period-creator scheduler) need the resolved narrow state for their audit
 * envelope, log line, and return value — not only for the write. The write
 * itself still flows through {@link buildTransition}. The legacy-tuple helpers
 * have no such external consumer and stay private.
 */
export function initialPeriodState(
  periodStart: Date,
  now: Date,
): Extract<PeriodState, "scheduled" | "open"> {
  return periodStart.getTime() > now.getTime() ? "scheduled" : "open";
}

/**
 * Build the complete governed lifecycle field set for a transition. Pure and
 * deterministic: the same `(kind, ctx)` always yields the same object.
 */
export function buildTransition<K extends TransitionKind>(
  kind: K,
  ctx: TransitionCtx[K],
): LifecycleWrite {
  switch (kind) {
    case "create": {
      const { periodStart, now } = ctx as TransitionCtx["create"];
      const state = initialPeriodState(periodStart, now);
      return { periodState: state, ...legacyTuple(state) };
    }
    case "schedule":
      return { periodState: "scheduled", ...legacyTuple("scheduled") };
    case "open":
      return { periodState: "open", ...legacyTuple("open") };
    case "publish": {
      const { now, userId } = ctx as TransitionCtx["publish"];
      return {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt: now,
        publishedById: userId,
      };
    }
    case "autoPublish": {
      const { now } = ctx as TransitionCtx["autoPublish"];
      return {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt: now,
        publishedById: null,
        autoPublished: true,
      };
    }
    case "reopen": {
      // Intentional asymmetry: periodState reverts to 'open' (editable again)
      // while periodStatus carries the 'reopened' marker so consumers can
      // still discriminate a reopen from a fresh open. The legacy tuple is
      // deliberately left untouched.
      const { now } = ctx as TransitionCtx["reopen"];
      return {
        periodStatus: "reopened",
        periodState: "open",
        reopenedAt: now,
      };
    }
    case "archive":
      return { archived: true, periodState: "archived" };
    case "autoArchive":
      return { archived: true, periodState: "archived", autoArchived: true };
    case "unarchive": {
      const { nextPeriodState } = ctx as TransitionCtx["unarchive"];
      return { archived: false, periodState: nextPeriodState };
    }
    default: {
      // Exhaustiveness guard: adding a new kind without a case is a compile
      // error here (`kind` is narrowed to `never` only when every case above
      // is handled).
      const unhandled: never = kind;
      throw new Error(`Unknown transition kind: ${String(unhandled)}`);
    }
  }
}
