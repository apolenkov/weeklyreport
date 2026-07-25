import type { StageAssignment, StageStatus } from "../../report-sections";
import {
  canonicalStageName,
  trafficToStageStatus,
} from "../../report-sections";
import type { CrossAuthorEntry } from "../ui/sdlc-pipeline";

// Prefer `crossAuthors` (same source as product health) over stage assignee;
// Mine mode ships locked stages with a null assignee.

interface ForeignOwner {
  owner: string;
  status: StageStatus;
}

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

// Named owner → "— <owner> (no status set)" / "— <owner>: <status>"; else "another lead".
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

// Co-owner status from crossAuthors when present — Mine-mode raw status is locked/empty.
export function hiddenStagesEffectiveStatuses(
  hidden: readonly StageAssignment[],
  foreignOwners: Map<string, ForeignOwner>,
): StageStatus[] {
  return hidden.map(
    (s) =>
      foreignOwners.get(canonicalStageName(s.stageName))?.status ?? s.status,
  );
}
