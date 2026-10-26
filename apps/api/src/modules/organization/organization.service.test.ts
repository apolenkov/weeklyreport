import { type OrganizationUpdate } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { createNullLogger } from "../../lib/logger.js";
import {
  type OrganizationRepository,
  OrganizationService,
} from "./organization.service";

const logger = createNullLogger();

function makeRepo(): OrganizationRepository {
  const baseRow = {
    id: "singleton" as const,
    shortName: "Demo",
    fullName: "Example Software Department",
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
    expect(row.shortName).toBe("Demo");
    expect(row.fullName).toBe("Example Software Department");
  });

  it("getPublic returns only shortName + fullName (no timestamps, no id)", async () => {
    const svc = new OrganizationService(makeRepo(), logger);
    const pub = await svc.getPublic();
    expect(pub).toEqual({
      shortName: "Demo",
      fullName: "Example Software Department",
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
    expect(previous.shortName).toBe("Demo");
    expect(previous.fullName).toBe("Example Software Department");
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
      shortName: "Demo",
      fullName: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const svc = new OrganizationService(repo, logger);
    await expect(svc.getOrganization()).rejects.toThrow();
  });

  // TASK-503.88 / C3636 control for the org.getPublic reader: the outbound
  // public parse re-checks the stored brand, so a whitespace-only row surfaces
  // as an error instead of being served as a blank identity. Bounded to this
  // reader — the authenticated session identity is a separate consumer.
  it.each(["shortName", "fullName"] as const)(
    "rejects a whitespace-only stored %s from the public projection",
    async (field) => {
      const repo = makeRepo();
      const blankBrand = " \t\n ";
      (repo.getOrganization as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: "singleton",
        shortName: field === "shortName" ? blankBrand : "Demo",
        fullName:
          field === "fullName"
            ? blankBrand
            : "Example Software Department",
        createdAt: new Date("2026-05-10T00:00:00Z"),
        updatedAt: new Date("2026-05-10T00:00:00Z"),
      });
      const svc = new OrganizationService(repo, logger);
      // Pin the parse boundary itself: any failure would satisfy a bare
      // toThrow(), so require the ZodError and the offending field's issue.
      const caught = await svc.getPublic().catch((error: unknown) => error);
      expect(caught).toBeInstanceOf(ZodError);
      expect(caught).toMatchObject({ issues: [{ path: [field] }] });
    },
  );
});
