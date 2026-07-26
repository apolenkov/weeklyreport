import type { PeriodState, ReportStatus } from "@customreport/shared";

/**
 * The single, pure source of truth for the `Report` lifecycle field set.
 *
 * No database constraint ties the coupled lifecycle representations together.
 * The governed field set, the per-transition completeness contract, and the
 * ungoverned identity tuple are specified in `openspec/specs/period-dual-state`.
 */

/**
 * The bare-scalar lifecycle subset every transition produces. Every value is a
 * plain scalar (never a Prisma `{ set }` update wrapper), so the object is
 * assignable to both `Prisma.ReportUpdateInput` (existing-row transitions,
 * spread directly into each writer's own `tx.report.update`) and
 * `Prisma.ReportCreateInput` (the `create` path, which spreads it alongside
 * the identity envelope).
 */
export interface LifecycleWrite {
  periodState?: PeriodState;
  status?: ReportStatus;
  archived?: boolean;
  periodStatus?: "open" | "published" | "reopened";
  autoPublished?: boolean;
  autoArchived?: boolean;
  publishedAt?: Date | null;
  publishedById?: string | null;
  reopenedAt?: Date | null;
}

/**
 * Per-kind context. The mapped type ties each `kind` to exactly the inputs that
 * transition needs, so a caller cannot, e.g., `publish` without a `userId` or
 * `unarchive` without the derived next state.
 */
export interface TransitionCtx {
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
}

export type TransitionKind = keyof TransitionCtx;

/**
 * The legacy `(status, archived)` projection of a given state. Kept internal so
 * callers never hand-assemble the tuple. The `scheduled` and `open` states share
 * one projection — the legacy tuple cannot distinguish them, which is exactly
 * what the explicit `periodState` column buys us.
 */
function legacyTuple(state: PeriodState): {
  status: ReportStatus;
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
 * The initial state for a freshly-created period: `scheduled` when the period
 * has not started yet (`periodStart > now`), otherwise `open`.
 *
 * Exported because the two creation paths (admin manual create and the
 * period-creator scheduler) need the resolved narrow state for their audit
 * envelope, log line, and return value — not only for the write. The write
 * itself still flows through {@link buildTransition}.
 */
export function initialPeriodState(
  periodStart: Date,
  now: Date,
): Extract<PeriodState, "scheduled" | "open"> {
  return periodStart.getTime() > now.getTime() ? "scheduled" : "open";
}

/**
 * The lifecycle set both publish paths share. The scheduler path passes a null
 * publisher and adds its own `autoPublished` flag; the manual path must not
 * carry that key at all, so it is never defaulted here.
 */
function publishWrite(now: Date, publishedById: string | null): LifecycleWrite {
  return {
    status: "published",
    periodStatus: "published",
    periodState: "published",
    publishedAt: now,
    publishedById,
  };
}

/**
 * Build the complete governed lifecycle field set for a transition. Pure and
 * deterministic: no Nest, no Prisma client, no `new Date()` — timestamps arrive
 * via `ctx`, so the same `(kind, ctx)` always yields the same object.
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
      return publishWrite(now, userId);
    }
    case "autoPublish": {
      const { now } = ctx as TransitionCtx["autoPublish"];
      return { ...publishWrite(now, null), autoPublished: true };
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
