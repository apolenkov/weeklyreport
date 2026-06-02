import { describe, expect, it, vi } from "vitest";

import {
  type OrganizationRepository,
  OrganizationService,
} from "./organization.service";

/**
 * UFB-047 / Phase 48-A: contract tests for OrganizationService.
 *
 * The service is a thin wrapper around the repository — its value is
 * zod-validating both the read and write paths so the wire shape cannot
 * drift. We exercise:
 *   - getOrganization returns the validated full row.
 *   - getPublic projects to the public shape (no timestamps).
 *   - updateOrganization round-trips through the schema.
 *   - input bounds (shortName ≤ 16, fullName ≤ 200) are enforced.
 */
function makeRepo(): OrganizationRepository {
  const baseRow = {
    id: "singleton" as const,
    shortName: "PEO",
    fullName: "Product Engineering & Operations",
    createdAt: new Date("2026-05-10T00:00:00Z"),
    updatedAt: new Date("2026-05-10T00:00:00Z"),
  };
  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async OrganizationRepository contract (no awaitable work in the stub)
    getOrganization: vi.fn(async () => baseRow),
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async OrganizationRepository contract (no awaitable work in the stub)
    updateOrganization: vi.fn(async (input) => ({
      ...baseRow,
      shortName: input.shortName,
      fullName: input.fullName,
      updatedAt: new Date("2026-05-11T00:00:00Z"),
    })),
  };
}

describe("OrganizationService", () => {
  it("getOrganization returns the validated singleton row", async () => {
    const svc = new OrganizationService(makeRepo());
    const row = await svc.getOrganization();
    expect(row.id).toBe("singleton");
    expect(row.shortName).toBe("PEO");
    expect(row.fullName).toBe("Product Engineering & Operations");
  });

  it("getPublic returns only shortName + fullName (no timestamps, no id)", async () => {
    const svc = new OrganizationService(makeRepo());
    const pub = await svc.getPublic();
    expect(pub).toEqual({
      shortName: "PEO",
      fullName: "Product Engineering & Operations",
    });
    expect(Object.keys(pub).sort()).toEqual(["fullName", "shortName"]);
  });

  it("updateOrganization persists new values", async () => {
    const repo = makeRepo();
    const svc = new OrganizationService(repo);
    const next = await svc.updateOrganization({
      shortName: "PLAT",
      fullName: "Platform Engineering",
    });
    expect(next.shortName).toBe("PLAT");
    expect(next.fullName).toBe("Platform Engineering");
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion: reference to a vi.fn mock method, never invoked with a lost `this`
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
        id: "singleton",
        shortName: "A".repeat(17),
        fullName: "OK",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    const svc = new OrganizationService(repo);
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
    const svc = new OrganizationService(repo);
    await expect(svc.getOrganization()).rejects.toThrow();
  });
});
