import { type OrganizationUpdate } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import {
  type OrganizationRepository,
  OrganizationService,
} from "./organization.service";

const logger = createNullLogger();

function makeRepo(): OrganizationRepository {
  const baseRow = {
    id: "singleton" as const,
    shortName: "PEO",
    fullName: "Product Engineering & Operations",
    createdAt: new Date("2026-05-10T00:00:00Z"),
    updatedAt: new Date("2026-05-10T00:00:00Z"),
  };
  return {
    getOrganization: vi.fn(() => Promise.resolve(baseRow)),
    updateOrganization: vi.fn((input: OrganizationUpdate) =>
      Promise.resolve({
        previous: baseRow,
        next: {
          ...baseRow,
          shortName: input.shortName,
          fullName: input.fullName,
          updatedAt: new Date("2026-05-11T00:00:00Z"),
        },
      }),
    ),
  };
}

describe("OrganizationService", () => {
  it("getOrganization returns the validated singleton row", async () => {
    const svc = new OrganizationService(makeRepo(), logger);
    const row = await svc.getOrganization();
    expect(row.id).toBe("singleton");
    expect(row.shortName).toBe("PEO");
    expect(row.fullName).toBe("Product Engineering & Operations");
  });

  it("getPublic returns only shortName + fullName (no timestamps, no id)", async () => {
    const svc = new OrganizationService(makeRepo(), logger);
    const pub = await svc.getPublic();
    expect(pub).toEqual({
      shortName: "PEO",
      fullName: "Product Engineering & Operations",
    });
    expect(Object.keys(pub).sort()).toEqual(["fullName", "shortName"]);
  });

  it("updateOrganization persists new values", async () => {
    const repo = makeRepo();
    const svc = new OrganizationService(repo, logger);
    const { previous, next } = await svc.updateOrganization({
      shortName: "PLAT",
      fullName: "Platform Engineering",
    });
    expect(next.shortName).toBe("PLAT");
    expect(next.fullName).toBe("Platform Engineering");
    expect(previous.shortName).toBe("PEO");
    expect(previous.fullName).toBe("Product Engineering & Operations");
    expect(repo.getOrganization).not.toHaveBeenCalled();
    expect(repo.updateOrganization).toHaveBeenCalledWith({
      shortName: "PLAT",
      fullName: "Platform Engineering",
    });
  });

  it("rejects shortName longer than 16 chars at the parse boundary", async () => {
    const repo = makeRepo();
    // Force the repo to return an invalid row so the parse on the way out
    // catches the bound. This proves the service's outbound parse is the
    // active gate even if the repo somehow returns dirty data.
    (repo.updateOrganization as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        previous: await repo.getOrganization(),
        next: {
          id: "singleton",
          shortName: "A".repeat(17),
          fullName: "OK",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
    const svc = new OrganizationService(repo, logger);
    await expect(
      svc.updateOrganization({ shortName: "OK", fullName: "OK" }),
    ).rejects.toThrow();
  });

  it("rejects empty fullName at the parse boundary", async () => {
    const repo = makeRepo();
    (repo.getOrganization as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "singleton",
      shortName: "PEO",
      fullName: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const svc = new OrganizationService(repo, logger);
    await expect(svc.getOrganization()).rejects.toThrow();
  });
});
