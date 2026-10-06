import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../../lib/logger.js";
import {
  createRepository,
  initialSnapshot,
} from "./__tests__/focused-admin-harness.js";
import {
  AdminStageAssignmentNotFoundError,
  AdminStageAssignmentReferenceNotFoundError,
} from "./admin-shared";
import {
  deleteStageAssignment,
  saveStageAssignment,
} from "./admin-stage.queries";
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

// Query boundary: a valid-but-absent reference fails the FK (P2003) and a
// missing assignment row fails the delete (P2025). Only scoped constraint
// violations translate; every other failure propagates unchanged.
describe("stage-assignment queries — missing reference classification", () => {
  const INPUT = {
    userId: USER_ID,
    stageId: STAGE_ID,
    projectId: PROJECT_ID,
  };

  function foreignKey(constraint: string): unknown {
    return {
      code: "P2003",
      message: `Foreign key constraint violated on the constraint: \`${constraint}\``,
    };
  }

  function lockedTx(stageAssignment: object): object {
    return {
      $executeRaw: vi.fn(() => Promise.resolve(1)),
      report: { findMany: vi.fn(() => Promise.resolve([])) },
      stageAssignment,
    };
  }

  it.each([
    {
      constraint: "StageAssignment_userId_fkey",
      message: "The referenced user does not exist.",
    },
    {
      constraint: "StageAssignment_stageId_fkey",
      message: "The referenced stage does not exist.",
    },
    {
      constraint: "StageAssignment_projectId_fkey",
      message: "The referenced project does not exist.",
    },
  ] as const)(
    "saveStageAssignment translates a missing-reference $constraint into NOT_FOUND",
    async ({ constraint, message }) => {
      const tx = lockedTx({
        upsert: vi.fn(() => Promise.reject(foreignKey(constraint))),
      });
      const prisma = {
        $transaction: vi.fn((run: (t: unknown) => Promise<unknown>) => run(tx)),
      } as unknown as PrismaService;

      await expect(saveStageAssignment(prisma, INPUT)).rejects.toMatchObject({
        name: "AdminStageAssignmentReferenceNotFoundError",
        message,
      });
      await expect(saveStageAssignment(prisma, INPUT)).rejects.toBeInstanceOf(
        AdminStageAssignmentReferenceNotFoundError,
      );
    },
  );

  it("saveStageAssignment translates a missing reference on the P2002 retry transaction too", async () => {
    const firstTx = lockedTx({
      upsert: vi.fn(() =>
        Promise.reject({
          code: "P2002",
          message:
            "Unique constraint failed on the constraint: `StageAssignment_stageId_projectId_key`",
        }),
      ),
    });
    const secondTx = lockedTx({
      update: vi.fn(() =>
        Promise.reject(foreignKey("StageAssignment_userId_fkey")),
      ),
    });
    const prisma = {
      $transaction: vi
        .fn()
        .mockImplementationOnce((run: (t: unknown) => Promise<unknown>) =>
          run(firstTx),
        )
        .mockImplementationOnce((run: (t: unknown) => Promise<unknown>) =>
          run(secondTx),
        ),
    } as unknown as PrismaService;

    await expect(saveStageAssignment(prisma, INPUT)).rejects.toMatchObject({
      name: "AdminStageAssignmentReferenceNotFoundError",
      message: "The referenced user does not exist.",
    });
  });

  it("saveStageAssignment re-throws a P2003 on an unrelated constraint unchanged", async () => {
    const original = foreignKey("SomeOtherTable_fkey");
    const tx = lockedTx({
      upsert: vi.fn(() => Promise.reject(original)),
    });
    const prisma = {
      $transaction: vi.fn((run: (t: unknown) => Promise<unknown>) => run(tx)),
    } as unknown as PrismaService;

    await expect(saveStageAssignment(prisma, INPUT)).rejects.toBe(original);
  });

  it("saveStageAssignment re-throws a non-constraint failure unchanged", async () => {
    const original = new Error("connection reset");
    const tx = lockedTx({
      upsert: vi.fn(() => Promise.reject(original)),
    });
    const prisma = {
      $transaction: vi.fn((run: (t: unknown) => Promise<unknown>) => run(tx)),
    } as unknown as PrismaService;

    await expect(saveStageAssignment(prisma, INPUT)).rejects.toBe(original);
  });

  it("deleteStageAssignment translates a missing-row P2025 into NOT_FOUND", async () => {
    const tx = lockedTx({
      delete: vi.fn(() => Promise.reject({ code: "P2025" })),
    });
    const prisma = {
      $transaction: vi.fn((run: (t: unknown) => Promise<unknown>) => run(tx)),
    } as unknown as PrismaService;

    await expect(
      deleteStageAssignment(prisma, "assignment-1"),
    ).rejects.toMatchObject({
      name: "AdminStageAssignmentNotFoundError",
      message: "Stage assignment assignment-1 was not found.",
    });
    await expect(
      deleteStageAssignment(prisma, "assignment-1"),
    ).rejects.toBeInstanceOf(AdminStageAssignmentNotFoundError);
  });

  it("deleteStageAssignment re-throws a non-P2025 failure unchanged", async () => {
    const original = new Error("connection reset");
    const tx = lockedTx({
      delete: vi.fn(() => Promise.reject(original)),
    });
    const prisma = {
      $transaction: vi.fn((run: (t: unknown) => Promise<unknown>) => run(tx)),
    } as unknown as PrismaService;

    await expect(deleteStageAssignment(prisma, "assignment-1")).rejects.toBe(
      original,
    );
  });
});
