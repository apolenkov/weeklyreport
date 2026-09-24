import { groupProductSchema } from "@customreport/shared";
import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { seedProducts as seedSimpleProducts } from "../simple/seed-simple.products.js";
import { seedOrganizationBaseline } from "./seed-org.js";

// FR118 V12: relation rows must carry explicit deterministic UUIDs instead of
// relying on the schema's @default(uuid()), so two equivalent fresh seed runs
// produce identical ids (as the demo scaffold already does via the
// makeGroupProductId/makeViewerAccessId factories).
type Row = Record<string, unknown>;

// Fake only the delegates seedOrganizationBaseline touches. For upserts the
// create payload is what a fresh run inserts, so that is where an explicit id
// must appear.
function fakeOrgPrisma(): {
  prisma: PrismaClient;
  viewerAccessCreates: Row[];
  groupProductCreates: Row[];
} {
  const viewerAccessCreates: Row[] = [];
  const groupProductCreates: Row[] = [];
  const noop = vi.fn(() => Promise.resolve({}));
  const prisma = {
    reportingGroup: { upsert: noop, update: noop },
    user: { upsert: noop },
    viewerGroupAccess: {
      upsert: vi.fn((args: { create: Row }) => {
        viewerAccessCreates.push(args.create);
        return Promise.resolve({});
      }),
    },
    project: { upsert: noop },
    groupProduct: {
      upsert: vi.fn((args: { create: Row }) => {
        groupProductCreates.push(args.create);
        return Promise.resolve({});
      }),
    },
    stage: { upsert: noop },
  } as unknown as PrismaClient;
  return { prisma, viewerAccessCreates, groupProductCreates };
}

function fakeSimpleProductsPrisma(): {
  prisma: PrismaClient;
  groupProductRows: Row[];
} {
  const groupProductRows: Row[] = [];
  const prisma = {
    project: { createMany: vi.fn(() => Promise.resolve({ count: 0 })) },
    groupProduct: {
      createMany: vi.fn((args: { data: Row[] }) => {
        groupProductRows.push(...args.data);
        return Promise.resolve({ count: args.data.length });
      }),
    },
  } as unknown as PrismaClient;
  return { prisma, groupProductRows };
}

// Every created relation row needs an explicit valid UUID (undefined must not
// pass), unique within its table and identical across equivalent fresh runs.
function expectDeterministicRelationIds(
  rows: readonly Row[],
  freshRunRows: readonly Row[],
): void {
  expect(rows.length).toBeGreaterThan(0);
  expect(freshRunRows).toHaveLength(rows.length);
  const ids = rows.map((row) => row.id);
  for (const id of ids) {
    expect(groupProductSchema.unwrap().shape.id.safeParse(id).success).toBe(
      true,
    );
  }
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toEqual(freshRunRows.map((row) => row.id));
}

describe("seed relation identities", () => {
  it("seedOrganizationBaseline assigns deterministic UUIDs to ViewerGroupAccess rows", async () => {
    const first = fakeOrgPrisma();
    await seedOrganizationBaseline(first.prisma);
    const second = fakeOrgPrisma();
    await seedOrganizationBaseline(second.prisma);

    expectDeterministicRelationIds(
      first.viewerAccessCreates,
      second.viewerAccessCreates,
    );
  });

  it("seedOrganizationBaseline assigns deterministic UUIDs to GroupProduct rows", async () => {
    const first = fakeOrgPrisma();
    await seedOrganizationBaseline(first.prisma);
    const second = fakeOrgPrisma();
    await seedOrganizationBaseline(second.prisma);

    expectDeterministicRelationIds(
      first.groupProductCreates,
      second.groupProductCreates,
    );
  });

  it("simple seedProducts assigns deterministic UUIDs to GroupProduct rows", async () => {
    const first = fakeSimpleProductsPrisma();
    await seedSimpleProducts(first.prisma);
    const second = fakeSimpleProductsPrisma();
    await seedSimpleProducts(second.prisma);

    expectDeterministicRelationIds(
      first.groupProductRows,
      second.groupProductRows,
    );
  });

  it("uses one GroupProduct id per product across simple and canonical seeds", async () => {
    const canonical = fakeOrgPrisma();
    await seedOrganizationBaseline(canonical.prisma);
    const simple = fakeSimpleProductsPrisma();
    await seedSimpleProducts(simple.prisma);

    const rows = [...canonical.groupProductCreates, ...simple.groupProductRows];
    const productIds = rows.map((row) => row.productId);
    const relationIds = rows.map((row) => row.id);
    expect(new Set(relationIds).size).toBe(new Set(productIds).size);

    const canonicalIdByProduct = new Map(
      canonical.groupProductCreates.map((row) => [row.productId, row.id]),
    );
    for (const row of simple.groupProductRows) {
      const canonicalId = canonicalIdByProduct.get(row.productId);
      if (canonicalId !== undefined) {
        expect(row.id).toBe(canonicalId);
      }
    }
  });
});
