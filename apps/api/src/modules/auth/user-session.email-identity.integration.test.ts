import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import {
  buildUserSession,
  type ProvisionLeadWorkspace,
  SamlIdentityMismatchError,
  type SamlProfile,
} from "./user-session";

// The email lookup runs lower("email") = lower($1) against User_email_lower_key,
// so only a real database proves that case differences resolve to one account
// while `_` and `%` in an address never act as LIKE wildcards.
describe("buildUserSession — case-insensitive email identity (database)", () => {
  const prisma = createTestPrisma();
  const failIfProvisioned: ProvisionLeadWorkspace = () => {
    throw new Error("provisionLeadWorkspace must not be called");
  };
  const GROUP_ID = "d0000000-0000-4000-a000-000000000110";

  function profile(email: string, samlId: string): SamlProfile {
    return { samlId, email, displayName: "Identity User", role: "viewer" };
  }

  async function seedUser(email: string, samlId: string) {
    return prisma.user.create({
      data: {
        email,
        name: "Identity User",
        lastName: "User",
        firstName: "Identity",
        role: "viewer",
        samlId,
        reportingGroupId: GROUP_ID,
      },
    });
  }

  beforeEach(async () => {
    await cleanDatabase();
    await prisma.reportingGroup.create({
      data: { id: GROUP_ID, name: "Identity group" },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("finds a stored mixed-case row from a differently cased assertion", async () => {
    const stored = await seedUser("Lead@Example.test", "saml-mixed");

    const session = await buildUserSession(
      prisma,
      profile("  lEAD@example.TEST ", "saml-mixed"),
      failIfProvisioned,
    );

    expect(session.userId).toBe(stored.id);
    expect(await prisma.user.count()).toBe(1);
  });

  it("refuses a case-variant email that carries a foreign samlId", async () => {
    await seedUser("owner@example.test", "saml-owner");

    await expect(
      buildUserSession(
        prisma,
        profile("OWNER@example.test", "saml-intruder"),
        failIfProvisioned,
      ),
    ).rejects.toThrow(SamlIdentityMismatchError);
    expect(await prisma.user.count()).toBe(1);
  });

  it.each([
    ["a_b@example.test", "a.b@example.test"],
    ["a%@example.test", "ab@example.test"],
  ])(
    "does not treat wildcards in %s as matching %s",
    async (wildcardEmail, otherEmail) => {
      const other = await seedUser(otherEmail, "saml-other");

      const session = await buildUserSession(
        prisma,
        profile(wildcardEmail, "saml-wildcard"),
        failIfProvisioned,
      );

      expect(session.userId).not.toBe(other.id);
      expect(await prisma.user.count()).toBe(2);
    },
  );

  it("rejects a second row that differs only by email case", async () => {
    await seedUser("dup@example.test", "saml-first");

    await expect(seedUser("DUP@example.test", "saml-second")).rejects.toThrow();
  });
});
