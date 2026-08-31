import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { type ReportSectionReadModel, validateSubmitInput } from "../report";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const uuid = () => randomUUID();
const PROJECT_UUID = uuid();

const validItem = () => ({
  projectId: uuid(),
  type: "current" as const,
  text: "Ship feature X",
  tag: "feature",
  workflowStatus: "in_progress" as const,
  carriedOver: false,
  // stageNames is required (min 1) on the write contract.
  stageNames: ["Development"],
});

const validRisk = () => ({
  projectId: uuid(),
  risk: "Deadline may slip",
  impact: "Revenue loss",
  mitigation: "Hire contractor",
  // severity is required (no default) on the write contract.
  severity: "at-risk" as const,
  // stageNames is required (min 1) on the write contract.
  stageNames: ["Development"],
});

const validDecision = () => ({
  // XOR parent: a decision is product- or activity-parented. The fixture sets
  // a product so the write-path XOR superRefine accepts it.
  productId: uuid(),
  text: "Upgrade to PostgreSQL 16",
  owner: "Alice",
  impact: "Better performance",
  // stageNames is required (min 1) on the write contract.
  stageNames: ["Development"],
});

const validDraft = () => ({
  reportSectionId: uuid(),
  version: 1,
  status: "draft" as const,
  projectStatuses: [{ projectId: PROJECT_UUID, status: "green" as const }],
  stageStatuses: [],
  activityStatuses: [],
  items: [validItem()],
  risks: [validRisk()],
  decisions: [validDecision()],
});

const validSubmit = () => ({
  ...validDraft(),
  confirmed: true as const,
});

describe("validateSubmitInput", () => {
  const makeSection = (
    overrides: Partial<ReportSectionReadModel> = {},
  ): ReportSectionReadModel => ({
    reportSectionId: uuid(),
    reportId: uuid(),
    authorId: uuid(),
    authorName: "Test Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    late: false,
    projects: [
      {
        projectId: PROJECT_UUID,
        projectName: "Project Alpha",
        trafficLight: null,
        ownedStages: [],
        stageSet: [],
        ownerGroupId: null,
      },
    ],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
    ...overrides,
  });

  it("returns SECTION_ALREADY_SUBMITTED for submitted section", () => {
    const section = makeSection({ status: "submitted" });
    const input = validSubmit();
    const errors = validateSubmitInput(section, input);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe("SECTION_ALREADY_SUBMITTED");
  });

  it("returns MISSING_TRAFFIC_LIGHT when project has no status", () => {
    const section = makeSection();
    const input = {
      ...validSubmit(),
      projectStatuses: [],
      items: [
        { ...validItem(), projectId: PROJECT_UUID, type: "current" as const },
      ],
    };
    const errors = validateSubmitInput(section, input);
    expect(errors.some((e) => e.code === "MISSING_TRAFFIC_LIGHT")).toBe(true);
  });

  it("returns MISSING_CURRENT_ITEM when project has no current items", () => {
    const section = makeSection();
    const input = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID, status: "green" as const }],
      items: [],
    };
    const errors = validateSubmitInput(section, input);
    expect(errors.some((e) => e.code === "MISSING_CURRENT_ITEM")).toBe(true);
  });

  it("returns no errors for valid input", () => {
    const section = makeSection();
    const input = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID, status: "green" as const }],
      items: [
        { ...validItem(), projectId: PROJECT_UUID, type: "current" as const },
      ],
    };
    const errors = validateSubmitInput(section, input);
    expect(errors).toHaveLength(0);
  });

  // Every attached activity must carry a traffic light at submit —
  // server-authoritative (a schema `.min` can't catch an OMITTED entry).
  it("requires a status for every attached activity", () => {
    const activityId = uuid();
    const section = makeSection({
      projects: [],
      activities: [
        {
          activityId,
          activityName: "Ops rotation",
          status: null,
          jiraAccounts: [],
          linkedProducts: [],
          derivedStatus: null,
          alarmFloor: null,
        },
      ],
    });
    const input = {
      ...validSubmit(),
      projectStatuses: [],
      activityStatuses: [],
      items: [],
      risks: [],
      decisions: [],
    };
    const errors = validateSubmitInput(section, input);
    expect(errors.some((e) => e.code === "MISSING_TRAFFIC_LIGHT")).toBe(true);
  });

  it("passes an activity-only section (0 products) with a status on its activity", () => {
    const activityId = uuid();
    const section = makeSection({
      projects: [],
      activities: [
        {
          activityId,
          activityName: "Ops rotation",
          status: "green",
          jiraAccounts: [],
          linkedProducts: [],
          derivedStatus: "green",
          alarmFloor: null,
        },
      ],
    });
    const input = {
      ...validSubmit(),
      projectStatuses: [],
      activityStatuses: [{ activityId, status: "green" as const }],
      items: [],
      risks: [],
      decisions: [],
    };
    const errors = validateSubmitInput(section, input);
    expect(errors).toHaveLength(0);
  });
});
