import { describe, expect, it } from "vitest";

import {
  buildEscalationGroups,
  type EscalationReport,
} from "./reminders-escalation-grouping.js";

interface TestHead {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  role: string;
}

const activeHead = (overrides: Partial<TestHead> = {}): TestHead => ({
  id: "head-1",
  email: "head@example.com",
  name: "Head One",
  isActive: true,
  role: "head",
  ...overrides,
});

const section = (
  authorName: string,
  groupName: string,
  head: ReturnType<typeof activeHead> | null,
) => ({
  author: {
    name: authorName,
    reportingGroup: { name: groupName, head },
  },
});

const baseReport = (
  sections: EscalationReport["sections"],
): EscalationReport => ({
  id: "report-1",
  deadline: new Date("2026-07-21T12:00:00.000Z"),
  sections,
});

describe("buildEscalationGroups", () => {
  it("aggregates two late leads sharing one head into a single digest", () => {
    const head = activeHead();
    const report = baseReport([
      section("Lead A", "Group Alpha", head),
      section("Lead B", "Group Alpha", head),
    ]);

    const { groups, unresolved } = buildEscalationGroups(report);

    expect(unresolved).toEqual([]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.head).toEqual({
      userId: "head-1",
      email: "head@example.com",
      name: "Head One",
    });
    expect(groups[0]?.lateLeads).toEqual([
      {
        leadName: "Lead A",
        sectionTitle: "Group Alpha",
        deadlineIso: "2026-07-21T12:00:00.000Z",
      },
      {
        leadName: "Lead B",
        sectionTitle: "Group Alpha",
        deadlineIso: "2026-07-21T12:00:00.000Z",
      },
    ]);
  });

  it("places a lead with an inactive head into unresolved, not a digest", () => {
    const inactiveHead = activeHead({ isActive: false });
    const report = baseReport([
      section("Lead Inactive", "Group Beta", inactiveHead),
    ]);

    const { groups, unresolved } = buildEscalationGroups(report);

    expect(groups).toEqual([]);
    expect(unresolved).toEqual(["Lead Inactive"]);
  });

  it("places a lead whose active head has a non-head role into unresolved", () => {
    const report = baseReport([
      section("Lead Member", "Group Member", activeHead({ role: "lead" })),
    ]);

    const { groups, unresolved } = buildEscalationGroups(report);

    expect(groups).toEqual([]);
    expect(unresolved).toEqual(["Lead Member"]);
  });

  it("places a lead with no reporting group head at all into unresolved", () => {
    const report = baseReport([section("Lead No Head", "Group Gamma", null)]);

    const { groups, unresolved } = buildEscalationGroups(report);

    expect(groups).toEqual([]);
    expect(unresolved).toEqual(["Lead No Head"]);
  });

  it("orders groups by first appearance across mixed heads", () => {
    const headA = activeHead({
      id: "head-a",
      email: "a@example.com",
      name: "Head A",
    });
    const headB = activeHead({
      id: "head-b",
      email: "b@example.com",
      name: "Head B",
    });
    const report = baseReport([
      section("Lead 1", "Group A", headB),
      section("Lead 2", "Group B", headA),
      section("Lead 3", "Group A2", headB),
    ]);

    const { groups } = buildEscalationGroups(report);

    expect(groups.map((group) => group.head.userId)).toEqual([
      "head-b",
      "head-a",
    ]);
    expect(groups[0]?.lateLeads).toHaveLength(2);
    expect(groups[1]?.lateLeads).toHaveLength(1);
  });
});
