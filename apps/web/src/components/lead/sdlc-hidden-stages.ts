"use client";

import { trafficToStageStatus } from "../../lib/mappers/traffic-light";
import type { StageAssignment, StageStatus } from "./mock-data";
import type { CrossAuthorEntry } from "./sdlc-pipeline";
import { canonicalStageName } from "./stage-tags";

// pipeline-tooltip-and-indicator: the "+N more" reveal must be honest about who
// holds each hidden stage. In Mine mode the lead's own grid marks every non-own
// stage "unassigned" — the real foreign ownership lives in `crossAuthors` (the
// same source that floors product health). We consult it so a stage taken by a
// co-owner reads as their initials, not "unassigned" (the lead reported DevOps
// showing empty/unassigned while another author actually held it).

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
 * One honest line per hidden stage: a stage held by a co-owner names their
 * initials; a genuinely unowned stage reads "unassigned". "empty" is never
 * shown for a stage that has an owner.
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
  return `${s.stageName} — unassigned`;
}

export function hiddenStagesRevealLines(
  hidden: readonly StageAssignment[],
  foreignOwners: Map<string, ForeignOwner>,
): string[] {
  return hidden.map((s) => hiddenStageLine(s, foreignOwners));
}
