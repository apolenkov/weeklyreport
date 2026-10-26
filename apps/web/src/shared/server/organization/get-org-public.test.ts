import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` throws outside a server module; neutralise it under vitest.
vi.mock("server-only", () => ({}));

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import { DEFAULT_ORGANIZATION_IDENTITY } from "@weeklyreport/shared";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

import { expectDefined } from "../../../test-utils/expect-defined.js";
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
    vi.stubEnv("API_URL", "http://localhost:3002");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns the decoded identity and reports nothing when org.getPublic resolves", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ result: { data: { json: ORG } } }]),
    });

    await expect(getOrgPublic()).resolves.toEqual(ORG);
    expect(consoleError).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("bounds the upstream call with an AbortSignal", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ result: { data: { json: ORG } } }]),
    });

    await getOrgPublic();

    const init = expectDefined(fetchMock.mock.calls[0])[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses the generic identity without network or error reporting during production build", async () => {
    vi.stubEnv("NEXT_PHASE", PHASE_PRODUCTION_BUILD);

    await expect(getOrgPublic()).resolves.toEqual(
      DEFAULT_ORGANIZATION_IDENTITY,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("degrades and reports the http-status branch on a non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve([]),
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
      json: () =>
        Promise.resolve([{ result: { data: { json: { shortName: 42 } } } }]),
    });

    await expect(getOrgPublic()).resolves.toEqual(
      DEFAULT_ORGANIZATION_IDENTITY,
    );
    expect(consoleError).toHaveBeenCalledOnce();
    expect(branchTagOfLastCapture()).toBe("decode");
  });

  it("degrades and reports the decode branch on a schema-invalid brand", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            result: {
              data: {
                json: { shortName: "X".repeat(17), fullName: "Valid Name" },
              },
            },
          },
        ]),
    });

    await expect(getOrgPublic()).resolves.toEqual(
      DEFAULT_ORGANIZATION_IDENTITY,
    );
    expect(consoleError).toHaveBeenCalledOnce();
    expect(branchTagOfLastCapture()).toBe("decode");
  });

  // TASK-503.88 / C3636 control for the public SSR reader: a whitespace-only
  // brand in the org.getPublic payload is out of contract, so the root metadata
  // and landing identity fall back to the generic identity. Bounded to this
  // reader — it says nothing about the authenticated session identity or any
  // rendered browser state.
  it.each(["shortName", "fullName"] as const)(
    "degrades and reports the decode branch on a whitespace-only %s",
    async (field) => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              result: {
                data: {
                  json: {
                    ...ORG,
                    ...(field === "shortName"
                      ? { shortName: " \t\n " }
                      : { fullName: " \t\n " }),
                  },
                },
              },
            },
          ]),
      });

      await expect(getOrgPublic()).resolves.toEqual(
        DEFAULT_ORGANIZATION_IDENTITY,
      );
      expect(consoleError).toHaveBeenCalledOnce();
      expect(branchTagOfLastCapture()).toBe("decode");
    },
  );

  it("degrades and reports the transport branch when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(getOrgPublic()).resolves.toEqual(
      DEFAULT_ORGANIZATION_IDENTITY,
    );
    expect(consoleError).toHaveBeenCalledOnce();
    expect(branchTagOfLastCapture()).toBe("transport");
  });
});
