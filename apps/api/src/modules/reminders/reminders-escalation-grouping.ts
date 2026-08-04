interface EscalationHead {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly role: string;
}

export interface EscalationGroupDigest {
  readonly head: { userId: string; email: string; name: string };
  readonly lateLeads: readonly {
    leadName: string;
    sectionTitle: string;
    deadlineIso: string;
  }[];
}

export interface EscalationReport {
  readonly id: string;
  readonly deadline: Date;
  readonly sections: readonly {
    readonly author: {
      readonly name: string;
      readonly reportingGroup: {
        name: string;
        head: EscalationHead | null;
      } | null;
    };
  }[];
}

// Active head (role head/admin) or null when group is absent/deactivated/wrong role.
function resolveActiveHead(
  group: { head: EscalationHead | null } | null,
): { userId: string; email: string; name: string } | null {
  const head = group?.head;
  if (!head) return null;
  if (!head.isActive) return null;
  if (head.role !== "head" && head.role !== "admin") return null;
  return { userId: head.id, email: head.email, name: head.name };
}

function requireReportingGroupName(
  group: EscalationReport["sections"][number]["author"]["reportingGroup"],
): string {
  if (!group) {
    throw new Error("Resolved escalation head has no reporting group.");
  }
  return group.name;
}

interface ResolvedSection {
  readonly head: { userId: string; email: string; name: string };
  readonly lateLead: {
    leadName: string;
    sectionTitle: string;
    deadlineIso: string;
  };
}

// One digest per active head (multi-group heads still get one). Unresolved
// leads have no active head — caller logs count only, not names.
export function buildEscalationGroups(report: EscalationReport): {
  groups: EscalationGroupDigest[];
  unresolved: string[];
} {
  const deadlineIso = report.deadline.toISOString();
  // One head resolution per section, reused for both the digests and the
  // unresolved-lead tally.
  const evaluated = report.sections.map((section) => ({
    section,
    head: resolveActiveHead(section.author.reportingGroup),
  }));

  const unresolved = evaluated.flatMap(({ section, head }) =>
    head === null ? [section.author.name] : [],
  );

  const resolved = evaluated.flatMap<ResolvedSection>(({ section, head }) =>
    head === null
      ? []
      : [
          {
            head,
            lateLead: {
              leadName: section.author.name,
              sectionTitle: requireReportingGroupName(
                section.author.reportingGroup,
              ),
              deadlineIso,
            },
          },
        ],
  );

  // One digest per distinct head, first-appearance order; each head's late
  // leads follow in encounter order.
  const groups = [
    ...Map.groupBy(resolved, (entry) => entry.head.userId).values(),
  ].flatMap((entries) => {
    const [first] = entries;
    return first
      ? [{ head: first.head, lateLeads: entries.map((e) => e.lateLead) }]
      : [];
  });

  return { groups, unresolved };
}
