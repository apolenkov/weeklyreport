/**
 * Escalation-digest grouping: resolving each late lead's active group head
 * and fanning the report's late leads out into one digest per head.
 */

interface EscalationHead {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  role: string;
}

/**
 * One reporting group's escalation digest: the active group head and the late
 * leads from that head's group. A late lead with no resolvable active head is
 * excluded upstream (logged, not represented here).
 */
export interface EscalationGroupDigest {
  head: { userId: string; email: string; name: string };
  lateLeads: {
    leadName: string;
    sectionTitle: string;
    deadlineIso: string;
  }[];
}

/**
 * The repository's escalation query result shape consumed by
 * `buildEscalationGroups` — only the fields the digest grouping reads.
 */
export interface EscalationReport {
  id: string;
  deadline: Date;
  sections: {
    author: {
      name: string;
      reportingGroup: { name: string; head: EscalationHead | null } | null;
    };
  }[];
}

/**
 * The active head (role head/admin, `isActive`) of a lead's reporting group,
 * or null when the group is absent, head-less, deactivated, or pointed at a
 * user who is neither head nor admin.
 */
function resolveActiveHead(
  group: { head: EscalationHead | null } | null,
): { userId: string; email: string; name: string } | null {
  const head = group?.head;
  if (!head) return null;
  if (!head.isActive) return null;
  if (head.role !== "head" && head.role !== "admin") return null;
  return { userId: head.id, email: head.email, name: head.name };
}

/** One section resolved against its author's active group head, or none. */
interface ResolvedSection {
  head: { userId: string; email: string; name: string };
  lateLead: { leadName: string; sectionTitle: string; deadlineIso: string };
}

/**
 * Resolve one section's active head and shape its late-lead entry, or null
 * when the section has no resolvable active head (an unresolved lead).
 */
function resolveSection(
  section: EscalationReport["sections"][number],
  deadlineIso: string,
): ResolvedSection | null {
  const head = resolveActiveHead(section.author.reportingGroup);
  if (!head) return null;
  return {
    head,
    lateLead: {
      leadName: section.author.name,
      // The lead's reporting group names their section in the digest; a
      // resolved head guarantees the group is present, so the fallback only
      // guards the type.
      sectionTitle: section.author.reportingGroup?.name ?? "Untitled section",
      deadlineIso,
    },
  };
}

/**
 * Group a report's late leads by their reporting group's active head. One
 * digest per head, aggregating that head's late leads across every group it
 * leads (a head leading two late groups still gets a single digest, matching
 * the per-head dedupe key). `unresolved` carries the leads with no resolvable
 * active head; the caller logs only their count, keeping names out of logs.
 */
export function buildEscalationGroups(report: EscalationReport): {
  groups: EscalationGroupDigest[];
  unresolved: string[];
} {
  const deadlineIso = report.deadline.toISOString();
  const resolved = report.sections
    .map((section) => resolveSection(section, deadlineIso))
    .filter((entry): entry is ResolvedSection => entry !== null);

  const unresolved = report.sections
    .filter(
      (section) => resolveActiveHead(section.author.reportingGroup) === null,
    )
    .map((section) => section.author.name);

  // One digest per distinct head, first-appearance order: keep only each
  // head's first resolved entry, then fold every resolved entry addressed to
  // that head into its lateLeads.
  const groups = resolved
    .filter(
      (entry, index) =>
        resolved.findIndex(
          (other) => other.head.userId === entry.head.userId,
        ) === index,
    )
    .map(({ head }) => ({
      head,
      lateLeads: resolved
        .filter((entry) => entry.head.userId === head.userId)
        .map((entry) => entry.lateLead),
    }));

  return { groups, unresolved };
}
