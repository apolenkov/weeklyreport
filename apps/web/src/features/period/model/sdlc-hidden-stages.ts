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

/**
 * Foreign Owners For Product.
 * @param productId - The productId argument.
 * @param crossAuthors - The crossAuthors argument.
 */
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

/**
 * Hidden Stages Reveal Lines.
 * @param hidden - The hidden argument.
 * @param foreignOwners - The foreignOwners argument.
 */
export function hiddenStagesRevealLines(
  hidden: readonly StageAssignment[],
  foreignOwners: Map<string, ForeignOwner>,
): string[] {
  return hidden.map((s) => hiddenStageLine(s, foreignOwners));
}

// Co-owner status from crossAuthors when present — Mine-mode raw status is locked/empty.
/**
 * Hidden Stages Effective Statuses.
 * @param hidden - The hidden argument.
 * @param foreignOwners - The foreignOwners argument.
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
