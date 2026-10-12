import type { UserSession } from "@weeklyreport/shared";
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getServerSession } from "../../../shared/server/auth/get-server-session";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../../shared/server/auth/get-server-session", () => ({
  getServerSession: vi.fn(),
}));

import { POST } from "./route";

const baseSession: UserSession = {
  userId: "a0000000-0000-4000-8000-000000000001",
  email: "admin@test.local",
  name: "Admin",
  role: "admin",
};

const mockedGetServerSession = vi.mocked(getServerSession);
const mockedRevalidatePath = vi.mocked(revalidatePath);

function makeRequest(origin?: string): NextRequest {
  return new NextRequest("http://localhost:3201/api/revalidate-org", {
    method: "POST",
    ...(origin === undefined ? {} : { headers: { origin } }),
  });
}

describe("organization cache revalidation route", () => {
  beforeEach(() => {
    vi.stubEnv("FRONTEND_URL", "http://lane-d.localhost:3201");
    mockedGetServerSession.mockResolvedValue(baseSession);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("accepts the configured public alias when Next uses an internal origin", async () => {
    const response = await POST(makeRequest("http://lane-d.localhost:3201"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ revalidated: true });
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects a foreign browser origin", async () => {
    const response = await POST(makeRequest("https://foreign.test"));

    expect(response.status).toBe(403);
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("allows an admin session without an Origin header", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects an unauthenticated request before revalidation", async () => {
    mockedGetServerSession.mockResolvedValue(null);

    const response = await POST(makeRequest("http://lane-d.localhost:3201"));

    expect(response.status).toBe(401);
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it.each(["lead", "head", "viewer"] as const)(
    "rejects an authenticated %s session before revalidation",
    async (role) => {
      mockedGetServerSession.mockResolvedValue({ ...baseSession, role });

      const response = await POST(makeRequest("http://lane-d.localhost:3201"));

      expect(response.status).toBe(403);
      expect(mockedRevalidatePath).not.toHaveBeenCalled();
    },
  );

  it("fails closed when the configured public origin is invalid", async () => {
    vi.stubEnv("FRONTEND_URL", "not a URL");

    await expect(
      POST(makeRequest("http://lane-d.localhost:3201")),
    ).rejects.toThrow(/FRONTEND_URL/u);
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});
