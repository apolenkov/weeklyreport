import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  type ReportSectionReadModel,
  type SubmitSectionInput,
  validateSubmitInput,
} from "../report.js";

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

  describe("owned-stage completeness", () => {
    const stageId = uuid();
    const otherStageId = uuid();
    const otherProjectId = uuid();
    const makeStageSection = () =>
      makeSection({
        projects: [
          {
            projectId: PROJECT_UUID,
            projectName: "Project Alpha",
            trafficLight: "green",
            ownedStages: [
              { stageId, stageName: "Development", sortOrder: 0 },
              { stageId: otherStageId, stageName: "Testing", sortOrder: 1 },
            ],
            stageSet: [],
            ownerGroupId: null,
          },
        ],
      });
    const completeInput = (): SubmitSectionInput => ({
      ...validSubmit(),
      items: [{ ...validItem(), projectId: PROJECT_UUID }],
      risks: [],
      decisions: [],
      stageStatuses: [
        { projectId: PROJECT_UUID, stageId, status: "green" },
        { projectId: PROJECT_UUID, stageId: otherStageId, status: "green" },
      ],
    });

    it.each([
      { name: "missing entry", entries: [] },
      {
        name: "null status",
        entries: [{ projectId: PROJECT_UUID, stageId, status: null }],
      },
      {
        name: "omitted status",
        entries: [{ projectId: PROJECT_UUID, stageId }],
      },
      {
        name: "same stage on another project",
        entries: [
          { projectId: otherProjectId, stageId, status: "green" as const },
        ],
      },
    ])("rejects $name for an owned stage", ({ entries }) => {
      const input = completeInput();
      const errors = validateSubmitInput(makeStageSection(), {
        ...input,
        stageStatuses: [
          { projectId: PROJECT_UUID, stageId: otherStageId, status: "green" },
          ...entries,
        ],
      });
      expect(errors).toEqual([
        {
          code: "MISSING_TRAFFIC_LIGHT",
          message:
            "Stage Development of project Project Alpha must have a traffic light status.",
        },
      ]);
    });

    it.each([
      { name: "null", lastStatus: null },
      { name: "omitted", lastStatus: undefined },
    ])(
      "rejects an effective $name status in duplicate owned-stage entries",
      ({ lastStatus }) => {
        const input = completeInput();
        expect(
          validateSubmitInput(makeStageSection(), {
            ...input,
            stageStatuses: [
              ...input.stageStatuses,
              { projectId: PROJECT_UUID, stageId, status: lastStatus },
            ],
          }),
        ).toEqual([
          {
            code: "MISSING_TRAFFIC_LIGHT",
            message:
              "Stage Development of project Project Alpha must have a traffic light status.",
          },
        ]);
      },
    );

    it("accepts the last explicit status in duplicate owned-stage entries", () => {
      const input = completeInput();
      expect(
        validateSubmitInput(makeStageSection(), {
          ...input,
          stageStatuses: [
            { projectId: PROJECT_UUID, stageId, status: null },
            ...input.stageStatuses,
          ],
        }),
      ).toEqual([]);
    });

    it.each(["red", "yellow", "green"] as const)(
      "accepts complete %s stage statuses",
      (status) => {
        const input = completeInput();
        expect(
          validateSubmitInput(makeStageSection(), {
            ...input,
            stageStatuses: input.stageStatuses.map((entry) => ({
              ...entry,
              status,
            })),
          }),
        ).toEqual([]);
      },
    );

    it("requires the same owned stage independently on each project", () => {
      const section = makeStageSection();
      const project = section.projects.at(0);
      if (!project) throw new Error("Missing fixture project");
      const input = completeInput();
      expect(
        validateSubmitInput(
          {
            ...section,
            projects: [
              ...section.projects,
              {
                ...project,
                projectId: otherProjectId,
                projectName: "Project Beta",
                ownedStages: [
                  { stageId, stageName: "Development", sortOrder: 0 },
                ],
              },
            ],
          },
          {
            ...input,
            projectStatuses: [
              ...input.projectStatuses,
              { projectId: otherProjectId, status: "green" },
            ],
            items: [
              ...input.items,
              { ...validItem(), projectId: otherProjectId },
            ],
          },
        ),
      ).toEqual([
        {
          code: "MISSING_TRAFFIC_LIGHT",
          message:
            "Stage Development of project Project Beta must have a traffic light status.",
        },
      ]);
    });

    it("ignores unset unowned and referenced stages", () => {
      const section = makeStageSection();
      const project = section.projects.at(0);
      if (!project) throw new Error("Missing fixture project");
      const borrowedStage = {
        stageId: uuid(),
        stageName: "Design",
        sortOrder: 2,
      };
      expect(
        validateSubmitInput(
          {
            ...section,
            projects: [
              {
                ...project,
                stageSet: [...project.ownedStages, borrowedStage],
              },
            ],
            referencedProjects: [
              {
                projectId: otherProjectId,
                projectName: "Referenced project",
              },
            ],
          },
          completeInput(),
        ),
      ).toEqual([]);
    });

    it("preserves project and activity error precedence", () => {
      const section = makeStageSection();
      const activityId = uuid();
      const errors = validateSubmitInput(
        {
          ...section,
          activities: [
            {
              activityId,
              activityName: "Ops",
              status: null,
              jiraAccounts: [],
              linkedProducts: [],
              derivedStatus: null,
              alarmFloor: null,
            },
          ],
        },
        { ...completeInput(), projectStatuses: [], stageStatuses: [] },
      );
      expect(errors.map((error) => error.message)).toEqual([
        "Project Project Alpha must have a traffic light status.",
        "Activity Ops must have a traffic light status.",
        "Stage Development of project Project Alpha must have a traffic light status.",
        "Stage Testing of project Project Alpha must have a traffic light status.",
      ]);
    });
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

  it("blocks an unconfirmed carried Current Week item", () => {
    const section = makeSection();
    const input = {
      ...validSubmit(),
      projectStatuses: [{ projectId: PROJECT_UUID, status: "green" as const }],
      items: [
        {
          ...validItem(),
          projectId: PROJECT_UUID,
          type: "current" as const,
          carriedOver: true,
        },
      ],
    };

    expect(validateSubmitInput(section, input)).toContainEqual({
      code: "UNCONFIRMED_CARRIED_ITEM",
      message: "Confirm carried Current Week items before submitting.",
    });
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
