import type { PeriodState, ReportStatus } from "@customreport/shared";

// The single, pure source of truth for the `Report` lifecycle field set: no DB
// constraint ties the coupled lifecycle representations together. The governed
// set and identity fields are specified in openspec/specs/period-dual-state.

// The bare-scalar lifecycle subset every transition produces — never a Prisma
// `{ set }` wrapper — so the object is assignable to both `ReportUpdateInput`
// and `ReportCreateInput`.
interface LifecycleFields {
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

declare const lifecycleWriteBrand: unique symbol;

export type LifecycleWrite = LifecycleFields & {
  readonly [lifecycleWriteBrand]: true;
};

function lifecycleWrite(fields: LifecycleFields): LifecycleWrite {
  return fields as LifecycleWrite;
}

// Per-kind context: the mapped type ties each `kind` to exactly the inputs that
// transition needs, so a caller cannot `publish` without a `userId` or
// `unarchive` without the derived next state.
export interface TransitionCtx {
  // Mint a new period; initial state derived from whether it has started.
  create: { periodStart: Date; now: Date };
  // Force the scheduled state (future period minted ahead of its start).
  schedule: Record<string, never>;
  // SCHEDULED→OPEN flip once a period's start day is reached.
  open: Record<string, never>;
  // Head-driven publish.
  publish: { now: Date; userId: string };
  // Scheduler-driven publish past the deadline + grace window.
  autoPublish: { now: Date };
  // Reopen a published period for further edits (asymmetric — see the reopen builder).
  reopen: { now: Date };
  // Manual archive.
  archive: Record<string, never>;
  // Scheduler-driven archive past the retention window.
  autoArchive: Record<string, never>;
  // Un-archive: the caller derives `nextPeriodState` from the surviving companion
  // fields (a DB read a pure builder must not do) and passes them in.
  unarchive: { nextPeriodState: PeriodState };
  // Restore a complete lifecycle field set already validated by the shared schema.
  restore: { lifecycle: Required<LifecycleFields> };
}

export type TransitionKind = keyof TransitionCtx;

function draftLifecycleWrite(
  periodState: Extract<PeriodState, "scheduled" | "open">,
): LifecycleWrite {
  return lifecycleWrite({
    periodState,
    status: "draft",
    archived: false,
    periodStatus: "open",
    autoPublished: false,
    autoArchived: false,
    publishedAt: null,
    publishedById: null,
    reopenedAt: null,
  });
}

// Initial state for a freshly-created period: `scheduled` when not yet started
// (`periodStart > now`), else `open`. Exported because both creation paths need
// the resolved narrow state for their audit envelope; the write flows through `buildTransition`.
export function initialPeriodState(
  periodStart: Date,
  now: Date,
): Extract<PeriodState, "scheduled" | "open"> {
  return periodStart.getTime() > now.getTime() ? "scheduled" : "open";
}

// The lifecycle set both publish paths share. The scheduler path passes a null
// publisher and adds its own `autoPublished` flag; the manual path must not
// carry that key at all, so it is never defaulted here.
function publishWrite(now: Date, publishedById: string | null): LifecycleWrite {
  return lifecycleWrite({
    status: "published",
    periodStatus: "published",
    periodState: "published",
    publishedAt: now,
    publishedById,
  });
}

function autoPublishWrite(now: Date): LifecycleWrite {
  return lifecycleWrite({
    ...publishWrite(now, null),
    autoPublished: true,
  });
}

function reopenWrite(now: Date): LifecycleWrite {
  return lifecycleWrite({
    periodStatus: "reopened",
    periodState: "open",
    reopenedAt: now,
  });
}

// Per-kind builders keyed by kind: the mapped type ties each builder to its
// own ctx shape, so dispatch needs no per-case casts and adding a TransitionCtx
// kind without a builder is a compile error (exhaustiveness by construction).
const transitionBuilders: {
  [K in TransitionKind]: (ctx: TransitionCtx[K]) => LifecycleWrite;
} = {
  create: ({ periodStart, now }) =>
    draftLifecycleWrite(initialPeriodState(periodStart, now)),
  schedule: () => draftLifecycleWrite("scheduled"),
  open: () => draftLifecycleWrite("open"),
  publish: ({ now, userId }) => publishWrite(now, userId),
  autoPublish: ({ now }) => autoPublishWrite(now),
  // Intentional asymmetry: periodState reverts to 'open' (editable again) while
  // periodStatus carries the 'reopened' marker so consumers can still
  // discriminate a reopen from a fresh open. The companion state stays current.
  reopen: ({ now }) => reopenWrite(now),
  archive: () => lifecycleWrite({ archived: true, periodState: "archived" }),
  autoArchive: () =>
    lifecycleWrite({
      archived: true,
      periodState: "archived",
      autoArchived: true,
    }),
  unarchive: ({ nextPeriodState }) =>
    lifecycleWrite({ archived: false, periodState: nextPeriodState }),
  restore: ({ lifecycle }) => lifecycleWrite(lifecycle),
};

// Build the canonical governed lifecycle delta for a transition. Pure and
// deterministic: no Nest, no Prisma client, no `new Date()` — timestamps arrive
// via `ctx`, so the same `(kind, ctx)` always yields the same object.
export function buildTransition<K extends TransitionKind>(
  kind: K,
  ctx: TransitionCtx[K],
): LifecycleWrite {
  return transitionBuilders[kind](ctx);
}
