import type { AdminSnapshot } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  createRepository,
  defaultGroup,
  headSession,
  initialSnapshot,
} from "./__tests__/focused-admin-harness.js";
import { type AdminRepository } from "./admin-shared.js";
import { ProjectAdminService } from "./project-admin.service.js";
import { SnapshotAdminService as ProductionSnapshotAdminService } from "./snapshot-admin.service.js";

class SnapshotAdminService extends ProductionSnapshotAdminService {
  constructor(
    repository: ConstructorParameters<typeof ProductionSnapshotAdminService>[0],
  ) {
    super(repository, createNullLogger());
  }
}

describe("ProjectAdminService — stage assignments", () => {
  const USER_ID = "11111111-1111-4111-8111-111111111111";
  const STAGE_ID = "22222222-2222-4222-8222-222222222222";
  const PROJECT_ID = "33333333-3333-4333-8333-333333333333";

  it("creates a stage assignment and lists it", async () => {
    const service = new ProjectAdminService(
      createRepository(initialSnapshot),
      createNullLogger(),
    );

    const created = await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    expect(created.userId).toBe(USER_ID);
    expect(created.stageId).toBe(STAGE_ID);
    expect(created.projectId).toBe(PROJECT_ID);
    expect(created.id).toBeDefined();

    const list = await service.listStageAssignments(PROJECT_ID);
    expect(list).toHaveLength(1);
    expect(expectDefined(list[0]).id).toBe(created.id);
  });

  it("deletes a stage assignment", async () => {
    const service = new ProjectAdminService(
      createRepository(initialSnapshot),
      createNullLogger(),
    );

    const created = await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    const result = await service.deleteStageAssignment(created.id);
    expect(result).toEqual({ success: true });

    const list = await service.listStageAssignments(PROJECT_ID);
    expect(list).toHaveLength(0);
  });

  it("updates the assignee for the same project stage", async () => {
    const service = new ProjectAdminService(
      createRepository(initialSnapshot),
      createNullLogger(),
    );

    const first = await service.saveStageAssignment({
      userId: USER_ID,
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    const second = await service.saveStageAssignment({
      userId: "44444444-4444-4444-8444-444444444444",
      stageId: STAGE_ID,
      projectId: PROJECT_ID,
    });

    expect(second.id).toBe(first.id);
    expect(second.userId).toBe("44444444-4444-4444-8444-444444444444");

    const list = await service.listStageAssignments(PROJECT_ID);
    expect(list).toHaveLength(1);
    expect(list[0]?.userId).toBe("44444444-4444-4444-8444-444444444444");
  });
});

describe("ProjectAdminService — Group <-> Product M:M", () => {
  const GROUP_A = "11111111-1111-4111-8111-111111111aaa";
  const GROUP_B = "11111111-1111-4111-8111-111111111bbb";
  const PRODUCT_X = "22222222-2222-4222-8222-2222222222a1";

  function makeRepoWithGroupProductSurface(
    snapshot: AdminSnapshot,
  ): AdminRepository {
    const base = createRepository(snapshot);
    // Keyed by productId alone — one product, one group.
    const edges = new Map<
      string,
      { id: string; groupId: string; createdAt: Date }
    >();
    return {
      ...base,
      attachProductToGroup({ groupId, productId }) {
        const existing = edges.get(productId);
        if (existing) {
          if (existing.groupId === groupId) {
            // Idempotent: same group, return canonical row.
            return Promise.resolve({
              id: existing.id,
              groupId,
              productId,
              createdAt: existing.createdAt,
            });
          }
          const currentGroup = snapshot.groups.find(
            (g) => g.id === existing.groupId,
          );
          return Promise.reject(
            new Error(
              `Product is already attached to ${currentGroup?.name ?? "another group"}. Detach it there before attaching it to another group.`,
            ),
          );
        }
        const row = {
          id: crypto.randomUUID(),
          groupId,
          productId,
          createdAt: new Date("2026-05-11T00:00:00.000Z"),
        };
        edges.set(productId, { id: row.id, groupId, createdAt: row.createdAt });
        return Promise.resolve(row);
      },
      detachProductFromGroup({ productId }) {
        edges.delete(productId);
        return Promise.resolve();
      },
      listGroupProducts(groupId) {
        const productIds = [...edges.entries()]
          .filter(([, v]) => v.groupId === groupId)
          .map(([pid]) => pid);
        return Promise.resolve(
          productIds.length > 0
            ? snapshot.projects.filter((p) => productIds.includes(p.id))
            : [],
        );
      },
      listProductGroups(productId) {
        const entry = edges.get(productId);
        if (!entry) return Promise.resolve([]);
        return Promise.resolve([
          expectDefined(snapshot.groups.find((g) => g.id === entry.groupId)),
        ]);
      },
    };
  }

  const snapshot: AdminSnapshot = {
    ...initialSnapshot,
    groups: [
      defaultGroup,
      {
        id: GROUP_A,
        name: "Platform",
        description: null,
        archived: false,
      },
      {
        id: GROUP_B,
        name: "Integrations",
        description: null,
        archived: false,
      },
    ],
    projects: [
      {
        id: PRODUCT_X,
        name: "Платформа интеграций",
        archived: false,
        leadId: headSession.userId,
        leadName: headSession.name,
      },
    ],
  };

  it("attachProductToGroup returns a parsed GroupProduct row", async () => {
    const service = new ProjectAdminService(
      makeRepoWithGroupProductSurface(snapshot),
      createNullLogger(),
    );
    const row = await service.attachProductToGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });
    expect(row.groupId).toBe(GROUP_A);
    expect(row.productId).toBe(PRODUCT_X);
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("attachProductToGroup is idempotent when the same group is re-attached", async () => {
    const service = new ProjectAdminService(
      makeRepoWithGroupProductSurface(snapshot),
      createNullLogger(),
    );
    const first = await service.attachProductToGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });
    const second = await service.attachProductToGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });
    expect(second.id).toBe(first.id);
  });

  it("attachProductToGroup rejects a product owned by another group", async () => {
    const service = new ProjectAdminService(
      makeRepoWithGroupProductSurface(snapshot),
      createNullLogger(),
    );
    await service.attachProductToGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });

    await expect(
      service.attachProductToGroup({
        groupId: GROUP_B,
        productId: PRODUCT_X,
      }),
    ).rejects.toThrow(/already attached to Platform/);

    const groups = await service.listProductGroups(PRODUCT_X);
    expect(groups.map((g) => g.id)).toEqual([GROUP_A]);

    const groupAProducts = await service.listGroupProducts(GROUP_A);
    expect(groupAProducts.map((p) => p.id)).toContain(PRODUCT_X);
  });

  it("detachProductFromGroup returns {success: true} and removes the edge", async () => {
    const service = new ProjectAdminService(
      makeRepoWithGroupProductSurface(snapshot),
      createNullLogger(),
    );
    await service.attachProductToGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });
    const result = await service.detachProductFromGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });
    expect(result).toEqual({ success: true });
    const groups = await service.listProductGroups(PRODUCT_X);
    expect(groups).toEqual([]);
  });

  it("detachProductFromGroup is idempotent (no-op when edge already absent)", async () => {
    const service = new ProjectAdminService(
      makeRepoWithGroupProductSurface(snapshot),
      createNullLogger(),
    );
    await expect(
      service.detachProductFromGroup({
        groupId: GROUP_A,
        productId: PRODUCT_X,
      }),
    ).resolves.toEqual({ success: true });
  });

  it("listGroupProducts and listProductGroups reflect the single owning group", async () => {
    const service = new ProjectAdminService(
      makeRepoWithGroupProductSurface(snapshot),
      createNullLogger(),
    );
    await service.attachProductToGroup({
      groupId: GROUP_A,
      productId: PRODUCT_X,
    });

    const groupsForProduct = await service.listProductGroups(PRODUCT_X);
    expect(groupsForProduct.map((g) => g.id)).toEqual([GROUP_A]);

    const productsForGroupA = await service.listGroupProducts(GROUP_A);
    expect(productsForGroupA.map((p) => p.id)).toContain(PRODUCT_X);
  });

  it("returns the neutral unused-stub collections", async () => {
    const service = new ProjectAdminService(
      createRepository(snapshot),
      createNullLogger(),
    );
    expect(await service.listGroupProducts(GROUP_A)).toEqual([]);
    expect(await service.listProductGroups(PRODUCT_X)).toEqual([]);
  });
});

describe("focused services — users, integrations, and stages", () => {
  it("deactivateUser delegates to the repository and reports success", async () => {
    const repo = createRepository(initialSnapshot);
    const service = new SnapshotAdminService(repo);

    await expect(service.deactivateUser("user-1")).resolves.toEqual({
      success: true,
    });
    expect(vi.mocked(repo.deactivateUser)).toHaveBeenCalledWith("user-1");
  });

  it("activateUser delegates to the repository and reports success", async () => {
    const repo = createRepository(initialSnapshot);
    const service = new SnapshotAdminService(repo);

    await expect(service.activateUser("user-1")).resolves.toEqual({
      success: true,
    });
    expect(vi.mocked(repo.activateUser)).toHaveBeenCalledWith("user-1");
  });

  it("listStages and listStageAssignmentCounts delegate to the repository", async () => {
    const service = new ProjectAdminService(
      createRepository(initialSnapshot),
      createNullLogger(),
    );

    await expect(service.listStages()).resolves.toEqual([]);
    await expect(service.listStageAssignmentCounts()).resolves.toEqual([]);
  });
});
