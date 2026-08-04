import type { OrganizationPublic, UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import type { ActivityService } from "../../../modules/activity/index.js";
import type { OrganizationService } from "../../../modules/organization/index.js";
import { createActivityRouter } from "./activity.router.js";
import { createOrganizationRouter } from "./organization.router.js";

const headSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "head@test.local",
  name: "Head",
  role: "head",
  activeReportId: null,
  activeReportSectionId: null,
};

function makeCaller(session: UserSession) {
  return {
    session,
    logger: createNullLogger(),
    auditLogger: { mutation: vi.fn() } as never,
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  };
}

describe("activity router", () => {
  it("returns the live activity payload from the service", async () => {
    const live = {
      reportId: "22222222-2222-4222-8222-222222222222",
      periodStart: new Date("2026-04-06T00:00:00.000Z"),
      periodEnd: new Date("2026-04-12T23:59:59.000Z"),
      periodStatus: "open",
      rows: [],
    };
    const activityService = {
      getLiveActivity: vi.fn().mockResolvedValue(live),
    } as unknown as ActivityService;
    const caller = createActivityRouter({ activityService }).createCaller(
      makeCaller(headSession),
    );

    await expect(caller.live()).resolves.toEqual(live);
    expect(activityService.getLiveActivity).toHaveBeenCalledWith(headSession);
  });

  it("maps a service failure to a tRPC error instead of leaking it raw", async () => {
    const activityService = {
      getLiveActivity: vi.fn().mockRejectedValue(new Error("boom")),
    } as unknown as ActivityService;
    const caller = createActivityRouter({ activityService }).createCaller(
      makeCaller(headSession),
    );

    await expect(caller.live()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});

describe("organization router", () => {
  it("returns only the public organization identity", async () => {
    const orgPublic: OrganizationPublic = {
      shortName: "TEST",
      fullName: "Test Organisation",
    };
    const organizationService = {
      getPublic: vi.fn().mockResolvedValue(orgPublic),
    } as unknown as OrganizationService;
    const caller = createOrganizationRouter({
      organizationService,
    }).createCaller(makeCaller(headSession));

    await expect(caller.getPublic()).resolves.toEqual(orgPublic);
    expect(organizationService.getPublic).toHaveBeenCalledOnce();
  });

  it("maps a service failure to a tRPC error instead of leaking it raw", async () => {
    const organizationService = {
      getPublic: vi.fn().mockRejectedValue(new Error("boom")),
    } as unknown as OrganizationService;
    const caller = createOrganizationRouter({
      organizationService,
    }).createCaller(makeCaller(headSession));

    await expect(caller.getPublic()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
