import { describe, expect, it } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import {
  createRepository,
  initialSnapshot,
} from "./__tests__/focused-admin-harness.js";
import { ProjectAdminService } from "./project-admin.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID_2 = "22222222-2222-4222-8222-222222222222";
const STAGE_ID = "33333333-3333-4333-8333-333333333333";
const STAGE_ID_2 = "44444444-4444-4444-8444-444444444444";
const PROJECT_ID = "55555555-5555-4555-8555-555555555555";
const PROJECT_ID_2 = "66666666-6666-4666-8666-666666666666";

function createService(): ProjectAdminService {
  return new ProjectAdminService(
    createRepository(initialSnapshot),
    createNullLogger(),
  );
}

describe("ProjectAdminService — stage assignments", () => {
  it("creates a valid assignment and returns it", async () => {
    const created = await createService().saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    expect(created.id).toBeDefined();
    expect(created.userId).toBe(USER_ID);
    expect(created.stageId).toBe(STAGE_ID);
    expect(created.projectId).toBe(PROJECT_ID);
  });

  it("updates the assignee for the same project stage", async () => {
    const service = createService();
    const first = await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });
    const second = await service.saveStageAssignment({
      userId: USER_ID_2,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    expect(second.id).toBe(first.id);
    expect(second.userId).toBe(USER_ID_2);
    await expect(service.listStageAssignments(PROJECT_ID)).resolves.toEqual([
      expect.objectContaining({ id: first.id, userId: USER_ID_2 }),
    ]);
  });

  it("deletes an assignment successfully", async () => {
    const service = createService();
    const created = await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    await expect(service.deleteStageAssignment(created.id)).resolves.toEqual({
      success: true,
    });
    await expect(service.listStageAssignments(PROJECT_ID)).resolves.toEqual([]);
  });

  it("lists assignments filtered by project", async () => {
    const service = createService();
    await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });
    await service.saveStageAssignment({
      userId: USER_ID_2,
      stageId: STAGE_ID_2,
      projectId: PROJECT_ID,
    });
    await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID_2,
    });

    await expect(
      service.listStageAssignments(PROJECT_ID),
    ).resolves.toHaveLength(2);
    await expect(
      service.listStageAssignments(PROJECT_ID_2),
    ).resolves.toHaveLength(1);
  });
});
