import type { PrismaClient, Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { resolveDevLoginIdentity } from "./auth.routes";

// resolveDevLoginIdentity is the dev-login (UAT role switcher) identity resolver.
// Contract under test: it switches among EXISTING seeded users and NEVER
// fabricates a phantom user from hardcoded role defaults — an unknown email
// resolves to null so the handler can fail clearly (404).

function fakePrisma(
  row: { name: string; samlId: string } | null,
): PrismaClient {
  return {
    user: {
      // eslint-disable-next-line @typescript-eslint/require-await -- vi.fn stub implements the async prisma findFirst contract (no awaitable work)
      findFirst: vi.fn(async () => row),
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
    // eslint-disable-next-line @typescript-eslint/unbound-method -- vitest spy assertion on the mock method reference
    const findFirst = prisma.user.findFirst as unknown as ReturnType<
      typeof vi.fn
    >;
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
  });

  it("returns null for an unknown email — no phantom identity is fabricated", async () => {
    const prisma = fakePrisma(null);

    const identity = await resolveDevLoginIdentity(prisma, "head", {
      email: "ghost@customreport.local",
    });

    expect(identity).toBeNull();
  });

  it("uses the DB name/samlId, never a hardcoded role default", async () => {
    // Even when the seed name differs from any old hardcoded default, the
    // session reflects the database row verbatim.
    const prisma = fakePrisma({ name: "Renamed Head", samlId: "head-1" });

    const identity = await resolveDevLoginIdentity(
      prisma,
      "head" satisfies Role,
      emptyQuery,
    );

    expect(identity?.displayName).toBe("Renamed Head");
  });
});
