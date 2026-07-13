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

/**
 * Group a report's late leads by their reporting group's active head. One
 * digest per head, aggregating that head's late leads across every group it
 * leads (a head leading two late groups still gets a single digest, matching
 * the per-head dedupe key). `unresolved` carries the names of leads with no
 * resolvable active head for the caller to log.
 */
export function buildEscalationGroups(report: EscalationReport): {
  groups: EscalationGroupDigest[];
  unresolved: string[];
} {
  const byHead = new Map<string, EscalationGroupDigest>();
  const unresolved: string[] = [];

  for (const { author } of report.sections) {
    const head = resolveActiveHead(author.reportingGroup);
    if (!head) {
      unresolved.push(author.name);
      continue;
    }
    const lateLead = {
      leadName: author.name,
      // The lead's reporting group names their section in the digest; a
      // resolved head guarantees the group is present, so the fallback only
      // guards the type.
      sectionTitle: author.reportingGroup?.name ?? "Untitled section",
      deadlineIso: report.deadline.toISOString(),
    };
    const existing = byHead.get(head.userId);
    if (existing) {
      existing.lateLeads.push(lateLead);
    } else {
      byHead.set(head.userId, { head, lateLeads: [lateLead] });
    }
  }

  return { groups: [...byHead.values()], unresolved };
}
