import type { ActivityLiveResponse, UserSession } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { type ActivityRepository, ActivityService } from "./activity.service";

const REPORT_ID = "a0000000-0000-4000-a000-000000000406";
const session: UserSession = {
  userId: "a0000000-0000-4000-a000-000000000403",
  email: "head-a@test.local",
  name: "Head A",
  role: "head",
  reportingGroupId: "a0000000-0000-4000-a000-000000000401",
};
const response: ActivityLiveResponse = {
  reportId: REPORT_ID,
  periodStart: new Date("2026-05-04T00:00:00.000Z"),
  periodEnd: new Date("2026-05-10T00:00:00.000Z"),
  periodStatus: "published",
  rows: [],
};

describe("ActivityService", () => {
  it("reads the report chosen by the shared leadership resolver", async () => {
    const getLiveActivity = vi.fn().mockResolvedValue(response);
    const repository: ActivityRepository = { getLiveActivity };
    const resolveReportId = vi.fn().mockResolvedValue(REPORT_ID);
    const service = new ActivityService(repository, resolveReportId);

    await expect(service.getLiveActivity(session)).resolves.toEqual(response);
    expect(resolveReportId).toHaveBeenCalledOnce();
    expect(getLiveActivity).toHaveBeenCalledWith(REPORT_ID, session);
  });

  it("preserves the no-report sentinel", async () => {
    const empty = { ...response, reportId: null, periodStatus: null };
    const getLiveActivity = vi.fn().mockResolvedValue(empty);
    const service = new ActivityService(
      { getLiveActivity },
      vi.fn().mockResolvedValue(null),
    );

    await expect(service.getLiveActivity(session)).resolves.toEqual(empty);
    expect(getLiveActivity).toHaveBeenCalledWith(null, session);
  });
});
