import type { StageAssignment, StageStatus } from "../../report-sections";
import {
  canonicalStageName,
  trafficToStageStatus,
} from "../../report-sections";
import type { CrossAuthorEntry } from "./sdlc-cross-author";

interface ForeignOwner {
  owner: string;
  status: StageStatus;
}

export function foreignOwnersForProduct(
  productId: string,
  crossAuthors: readonly CrossAuthorEntry[],
): Map<string, ForeignOwner> {
  // Later entries win, exactly as the sequential writes they replace did.
  return new Map<string, ForeignOwner>(
    crossAuthors
      .filter((c) => c.projectId === productId)
      .flatMap((ca) =>
        ca.stageNames.map((name): [string, ForeignOwner] => {
          const key = canonicalStageName(name);
          const st = ca.stages.find(
            (s) => canonicalStageName(s.stageName) === key,
          );
          return [
            key,
            {
              owner: ca.authorInitials,
              status: trafficToStageStatus(st?.status ?? null),
            },
          ];
        }),
      ),
  );
}

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

// Prefer the co-owner status from `crossAuthors` (same source as product
// health) over the raw stage status: Mine mode ships locked stages as
// empty with a null assignee.
export function hiddenStagesEffectiveStatuses(
  hidden: readonly StageAssignment[],
  foreignOwners: Map<string, ForeignOwner>,
): StageStatus[] {
  return hidden.map(
    (s) =>
      foreignOwners.get(canonicalStageName(s.stageName))?.status ?? s.status,
  );
}
