import type { PeriodState } from '@customreport/shared';

/**
 * UFB-053 / Phase 51-C: Period state-machine adapter.
 *
 * The legacy (`status` × `archived`) tuple is preserved in the DB during the
 * one-release compatibility window. These helpers translate between the
 * explicit {@link PeriodState} column and the legacy fields so:
 *
 *  - Read paths that still consume the tuple can keep working until 51-B
 *    swaps them over.
 *  - Writers can mint the new column atomically from the legacy fields
 *    (and vice-versa) without scattering boolean ternaries across the
 *    code base.
 *
 * `periodStatus` (open/published/reopened) is a SEPARATE state machine
 * that tracks reopen flavour. It is NOT part of the legacy tuple this
 * adapter speaks to — see `period.prisma-repository.ts#reopenPeriod` for
 * the reopen path, which keeps writing periodStatus='reopened' while
 * 51-C flips periodState back to 'open'. The SUMMARY documents the
 * intentional asymmetry.
 *
 * Backfill semantics (mirrored in the SQL migration):
 *  - archived=true                            → 'archived'
 *  - archived=false AND status='published'    → 'published'
 *  - otherwise                                → 'open'
 *
 * Note: 'scheduled' is NOT derived from the legacy tuple — it is reserved
 * for future periods minted by the PeriodCreator scheduler when
 * periodStart > now. The reverse map produces (status='draft',
 * archived=false) for 'scheduled', matching the open semantics on the
 * legacy side.
 */
export type LegacyPeriodTuple = {
  readonly status: 'draft' | 'published';
  readonly archived: boolean;
};

export function legacyTupleToState(tuple: LegacyPeriodTuple): PeriodState {
  if (tuple.archived) {
    return 'archived';
  }
  if (tuple.status === 'published') {
    return 'published';
  }
  return 'open';
}

export function stateToLegacyTuple(state: PeriodState): LegacyPeriodTuple {
  switch (state) {
    case 'archived':
      return { status: 'published', archived: true };
    case 'published':
      return { status: 'published', archived: false };
    case 'scheduled':
    case 'open':
      return { status: 'draft', archived: false };
  }
}

/**
 * Compute the initial periodState for a freshly-created Period. Returns
 * 'scheduled' if the period has not yet started (periodStart > now),
 * otherwise 'open'. Used by PeriodCreatorScheduler.runOnce so the
 * SCHEDULED→OPEN flip is deterministic at insert time and on each
 * subsequent daily tick.
 */
export function initialPeriodState(
  periodStart: Date,
  now: Date,
): Extract<PeriodState, 'scheduled' | 'open'> {
  return periodStart.getTime() > now.getTime() ? 'scheduled' : 'open';
}
