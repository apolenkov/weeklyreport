import type { PrismaClient, Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  resolveDevLoginIdentity,
  resolveDevLoginRedirectUrl,
  safeRedirectPath,
} from "./dev-login.routes";

// Contract under test: resolveDevLoginIdentity switches among EXISTING seeded
// users and NEVER fabricates a phantom user — an unknown email resolves to null
// so the handler can fail clearly (404).
function fakePrisma(
  row: { name: string; samlId: string } | null,
): PrismaClient {
  return {
    user: {
      findFirst: vi.fn(() => Promise.resolve(row)),
    },
  } as unknown as PrismaClient;
}

const emptyQuery = {} as Record<string, never>;

describe("resolveDevLoginIdentity", () => {
  it("resolves the role's canonical seed email to the live DB identity", async () => {
    const prisma = fakePrisma({ name: "Lead One", samlId: "lead-1" });

    const identity = await resolveDevLoginIdentity(prisma, "lead", emptyQuery);

    expect(identity).toEqual({
      email: "lead1@customreport.local",
      role: "lead",
      displayName: "Lead One",
      samlId: "lead-1",
    });
    // The looked-up email is the role default, not a fabricated value.
    const findFirst = vi.mocked(prisma.user.findFirst);
    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { email: "lead1@customreport.local" },
    });
  });

  it("honours an explicit ?email= of another existing user", async () => {
    const prisma = fakePrisma({ name: "Maria", samlId: "lead-maria" });

    const identity = await resolveDevLoginIdentity(prisma, "lead", {
      email: "maria@customreport.local",
    });

    expect(identity).toMatchObject({
      email: "maria@customreport.local",
      displayName: "Maria",
      samlId: "lead-maria",
    });
    const findFirst = vi.mocked(prisma.user.findFirst);
    expect(findFirst).toHaveBeenCalledWith({
      where: { email: "maria@customreport.local" },
      select: { name: true, samlId: true },
    });
  });

  it("returns null for an unknown email — no phantom identity is fabricated", async () => {
    const prisma = fakePrisma(null);

    const identity = await resolveDevLoginIdentity(prisma, "head", {
      email: "ghost@customreport.local",
    });

    expect(identity).toBeNull();
  });

  it("uses the DB name/samlId, never a hardcoded role default", async () => {
    // The session reflects the database row verbatim rather than a code-level
    // role or name default.
    const prisma = fakePrisma({ name: "Renamed Head", samlId: "head-1" });

    const identity = await resolveDevLoginIdentity(
      prisma,
      "head" satisfies Role,
      emptyQuery,
    );

    expect(identity?.displayName).toBe("Renamed Head");
  });
});

const FRONTEND_URL = "http://localhost:3000";
const ROLE_DEFAULT = "/head/dashboard";

describe("safeRedirectPath — same-origin redirect validation", () => {
  it("accepts a same-origin relative path", () => {
    expect(safeRedirectPath("/admin", FRONTEND_URL)).toBe("/admin");
  });

  it("rejects the backslash bypass (slash then backslash)", () => {
    expect(safeRedirectPath(String.raw`/\evil.com`, FRONTEND_URL)).toBeNull();
  });

  it("rejects scheme-relative and absolute off-origin targets", () => {
    expect(safeRedirectPath("//evil.com", FRONTEND_URL)).toBeNull();
    expect(safeRedirectPath("https://evil.com", FRONTEND_URL)).toBeNull();
  });

  it("returns null when the candidate is absent", () => {
    expect(safeRedirectPath(undefined, FRONTEND_URL)).toBeNull();
  });
});

describe("resolveDevLoginRedirectUrl — validate and construct with one parse", () => {
  it("resolves a same-origin path against the app origin", () => {
    expect(
      resolveDevLoginRedirectUrl("/admin", ROLE_DEFAULT, FRONTEND_URL),
    ).toBe("http://localhost:3000/admin");
  });

  it("neutralises userinfo injection (@evil.com) to an on-origin path", () => {
    const url = new URL(
      resolveDevLoginRedirectUrl("@evil.com", ROLE_DEFAULT, FRONTEND_URL),
    );
    expect(url.host).toBe("localhost:3000");
  });

  it("falls back to the role default for off-origin / backslash targets", () => {
    const fallbackUrl = `http://localhost:3000${ROLE_DEFAULT}`;
    expect(
      resolveDevLoginRedirectUrl(
        String.raw`/\evil.com`,
        ROLE_DEFAULT,
        FRONTEND_URL,
      ),
    ).toBe(fallbackUrl);
    expect(
      resolveDevLoginRedirectUrl("//evil.com", ROLE_DEFAULT, FRONTEND_URL),
    ).toBe(fallbackUrl);
    expect(
      resolveDevLoginRedirectUrl(
        "https://evil.com",
        ROLE_DEFAULT,
        FRONTEND_URL,
      ),
    ).toBe(fallbackUrl);
  });

  it("falls back to the role default when no redirect is supplied", () => {
    expect(
      resolveDevLoginRedirectUrl(undefined, ROLE_DEFAULT, FRONTEND_URL),
    ).toBe("http://localhost:3000/head/dashboard");
  });
});
