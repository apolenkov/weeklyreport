import type { StageAssignment, StageStatus } from "../../report-sections";
import {
  canonicalStageName,
  trafficToStageStatus,
} from "../../report-sections";
import type { CrossAuthorEntry } from "../ui/sdlc-pipeline";

// pipeline-tooltip-and-indicator / unassigned-stage-reporting-exclusion: the
// "+N more" reveal must name who holds each hidden stage. Prefer
// `crossAuthors` (same source as product health). Mine mode ships locked
// stages with a null assignee; the assignee branch below is only a fallback
// when initials already sit on the stage (Everyone override shapes / fixtures).

interface ForeignOwner {
  owner: string;
  status: StageStatus;
}

/** Canonical stage name → the co-owner (initials + status) holding it. */
export function foreignOwnersForProduct(
  productId: string,
  crossAuthors: readonly CrossAuthorEntry[],
): Map<string, ForeignOwner> {
  const map = new Map<string, ForeignOwner>();
  for (const ca of crossAuthors.filter((c) => c.projectId === productId)) {
    for (const name of ca.stageNames) {
      const key = canonicalStageName(name);
      const st = ca.stages.find((s) => canonicalStageName(s.stageName) === key);
      map.set(key, {
        owner: ca.authorInitials,
        status: trafficToStageStatus(st?.status ?? null),
      });
    }
  }
  return map;
}

/**
 * One honest line per hidden stage. unassigned-stage-reporting-exclusion: a
 * hidden stage is always foreign-owned now (the "unassigned" category is gone).
 * A stage whose co-owner is resolved (via `crossAuthors`) names their initials;
 * one whose owner has not been resolved yet (Mine mode without cross-author
 * data) reads "another lead". "empty" is never shown for a stage that has an
 * owner.
 */
function hiddenStageLine(
  s: StageAssignment,
  foreignOwners: Map<string, ForeignOwner>,
): string {
  const foreign = foreignOwners.get(canonicalStageName(s.stageName));
  if (foreign) {
    return foreign.status === "empty"
      ? `${s.stageName} — ${foreign.owner} (no status set)`
      : `${s.stageName} — ${foreign.owner}: ${foreign.status}`;
  }
  if (s.ownership === "locked" && s.assignee) {
    return s.status === "empty"
      ? `${s.stageName} — ${s.assignee} (no status set)`
      : `${s.stageName} — ${s.assignee}: ${s.status}`;
  }
  return `${s.stageName} — another lead`;
}

export function hiddenStagesRevealLines(
  hidden: readonly StageAssignment[],
  foreignOwners: Map<string, ForeignOwner>,
): string[] {
  return hidden.map((s) => hiddenStageLine(s, foreignOwners));
}

/**
 * The status that drives each hidden stage's at-a-glance colour. A foreign-held
 * stage uses the co-owner's status from `crossAuthors` (in Mine mode the lead's
 * own grid carries it as locked/"empty", so its raw status is meaningless);
 * any other stage uses its own status. The "+N more" indicator colour is built
 * from these so it always matches the reveal text, instead of collapsing to grey
 * whenever the only severity lives in a foreign co-owner's stage.
 */
export function hiddenStagesEffectiveStatuses(
  hidden: readonly StageAssignment[],
  foreignOwners: Map<string, ForeignOwner>,
): StageStatus[] {
  return hidden.map(
    (s) =>
      foreignOwners.get(canonicalStageName(s.stageName))?.status ?? s.status,
  );
}
