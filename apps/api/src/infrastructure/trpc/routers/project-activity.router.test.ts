import type { Role } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import type { ProjectActivityService } from "../../../modules/project-activity/index.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { createProjectActivityRouter } from "./project-activity.router.js";

// Hex letters in every id so that toUpperCase() really changes the string.
const LOWER = {
  activity: "b0000000-0000-4000-a000-00000000000b",
  group: "c0000000-0000-4000-a000-00000000000c",
  product: "d0000000-0000-4000-a000-00000000000d",
  lead: "e0000000-0000-4000-a000-00000000000e",
} as const;
const UPPER = {
  activity: LOWER.activity.toUpperCase(),
  group: LOWER.group.toUpperCase(),
  product: LOWER.product.toUpperCase(),
  lead: LOWER.lead.toUpperCase(),
} as const;

const ADMIN_ROLE: Role = "admin";

const activityFixture = {
  id: LOWER.activity,
  name: "Synthetic activity",
  groupId: LOWER.group,
  linkedProducts: [],
  jiraAccounts: [],
  archived: false,
  leadIds: [],
} as const;

function setup() {
  const projectActivityService = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(activityFixture),
    update: vi.fn().mockResolvedValue(activityFixture),
    archive: vi.fn().mockResolvedValue(activityFixture),
    attachLead: vi.fn().mockResolvedValue(undefined),
    detachLead: vi.fn().mockResolvedValue(undefined),
  };
  const caller = createProjectActivityRouter({
    projectActivityService:
      projectActivityService as unknown as ProjectActivityService,
  }).createCaller({
    session: {
      userId: "f0000000-0000-4000-a000-00000000000f",
      role: ADMIN_ROLE,
      email: "synthetic@task503.invalid",
      name: "Synthetic admin",
      activeReportId: null,
      activeReportSectionId: null,
    },
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
  return { caller, projectActivityService };
}

type Caller = ReturnType<typeof setup>["caller"];
type ServiceMethod =
  "create" | "update" | "archive" | "attachLead" | "detachLead";

describe("project activity router normalizes uppercase reference ids on every command", () => {
  it.each<
    [
      ServiceMethod,
      (caller: Caller) => Promise<unknown>,
      Record<string, unknown>,
    ]
  >([
    [
      "create",
      (caller) =>
        caller.create({
          name: "Synthetic activity",
          groupId: UPPER.group,
          linkedProductIds: [UPPER.product],
        }),
      {
        name: "Synthetic activity",
        groupId: LOWER.group,
        linkedProductIds: [LOWER.product],
        jiraAccounts: [],
      },
    ],
    [
      "update",
      (caller) =>
        caller.update({
          id: UPPER.activity,
          name: "Renamed synthetic activity",
          groupId: UPPER.group,
          linkedProductIds: [UPPER.product],
        }),
      {
        id: LOWER.activity,
        name: "Renamed synthetic activity",
        groupId: LOWER.group,
        linkedProductIds: [LOWER.product],
        jiraAccounts: [],
      },
    ],
    [
      "archive",
      (caller) => caller.archive({ id: UPPER.activity, archived: true }),
      { id: LOWER.activity, archived: true },
    ],
    [
      "attachLead",
      (caller) =>
        caller.attachLead({ activityId: UPPER.activity, leadId: UPPER.lead }),
      { activityId: LOWER.activity, leadId: LOWER.lead },
    ],
    [
      "detachLead",
      (caller) =>
        caller.detachLead({ activityId: UPPER.activity, leadId: UPPER.lead }),
      { activityId: LOWER.activity, leadId: LOWER.lead },
    ],
  ])(
    "%s passes lowercase ids to the service for uppercase input",
    async (method, call, expectedArg) => {
      expect(UPPER.activity).not.toBe(LOWER.activity);
      const { caller, projectActivityService } = setup();

      await call(caller);

      const service = projectActivityService[method];
      expect(service).toHaveBeenCalledOnce();
      expect(service).toHaveBeenCalledWith(expectedArg);
    },
  );
});
