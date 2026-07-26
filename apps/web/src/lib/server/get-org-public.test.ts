import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` throws outside a server module; neutralise it under vitest.
vi.mock("server-only", () => ({}));

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import { DEFAULT_ORGANIZATION_IDENTITY } from "@customreport/shared";

import { expectDefined } from "../../test-utils/expect-defined.js";
import { getOrgPublic } from "./get-org-public";

const ORG = { shortName: "TST", fullName: "Test Organization" };

function branchTagOfLastCapture(): unknown {
  const [, context] = expectDefined(
    captureException.mock.calls.at(-1) as [
      Error,
      { tags: Record<string, unknown> },
    ],
  );
  return context.tags.org_public_branch;
}

describe("getOrgPublic", () => {
  const fetchMock = vi.fn();
  const consoleError = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    captureException.mockReset();
    consoleError.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(consoleError);
    // The unit suite loads no env file; requireApiUrl has no fallback.
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3002");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns the decoded identity and reports nothing when org.getPublic resolves", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async Response.json() contract (no awaitable work in the stub)
      json: async () => [{ result: { data: { json: ORG } } }],
    });

    await expect(getOrgPublic()).resolves.toEqual(ORG);
    expect(consoleError).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("degrades and reports the http-status branch on a non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async Response.json() contract (no awaitable work in the stub)
      json: async () => [],
    });

    await expect(getOrgPublic()).resolves.toEqual(
      DEFAULT_ORGANIZATION_IDENTITY,
    );
    expect(consoleError).toHaveBeenCalledOnce();
    expect(branchTagOfLastCapture()).toBe("http-status");
  });

  it("degrades and reports the decode branch on a malformed payload", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async Response.json() contract (no awaitable work in the stub)
      json: async () => [{ result: { data: { json: { shortName: 42 } } } }],
    });

    await expect(getOrgPublic()).resolves.toEqual(
      DEFAULT_ORGANIZATION_IDENTITY,
    );
    expect(consoleError).toHaveBeenCalledOnce();
    expect(branchTagOfLastCapture()).toBe("decode");
  });

  it("degrades and reports the transport branch when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(getOrgPublic()).resolves.toEqual(
      DEFAULT_ORGANIZATION_IDENTITY,
    );
    expect(consoleError).toHaveBeenCalledOnce();
    expect(branchTagOfLastCapture()).toBe("transport");
  });
});
