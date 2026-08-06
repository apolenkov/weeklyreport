import { describe, expect, it, vi } from "vitest";

import type { AiDriverReport } from "../driver/driver-results-contract.ts";
import { probeBugsinkChannel } from "./environment-observer-bugsink.ts";

const DSN = "http://public@example.test/1";
const API_TOKEN = "a".repeat(40);
const report = {
  timeline: { endedAt: "2026-08-04T00:00:00.000Z" },
} as AiDriverReport;

const response = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

const project = (
  digestedEventCount: number,
  storedEventCount: number,
  slug = "runtime-sweep",
): unknown => ({
  slug,
  digested_event_count: digestedEventCount,
  stored_event_count: storedEventCount,
});

describe("Bugsink liveness probe", () => {
  it("requires authenticated storage, a matching receipt, and both counters", async () => {
    const projectResponses = [project(4, 8), project(5, 9)].values();
    const fetcher = vi.fn<typeof fetch>((input, init) => {
      const url = new URL(urlOf(input));
      const headers = new Headers(init?.headers);
      if (url.pathname.includes("/canonical/0/projects/")) {
        return Promise.resolve(
          response(projectResponses.next().value ?? project(0, 0)),
        );
      }
      if (!url.pathname.endsWith("/store/"))
        return Promise.resolve(response({ error: "unexpected" }, 404));
      const event = JSON.parse(
        typeof init?.body === "string" ? init.body : "{}",
      ) as Record<string, unknown>;
      expect(headers.get("authorization")).toBeNull();
      expect(headers.get("x-sentry-auth")).toBe(
        "Sentry sentry_version=7,sentry_key=public,sentry_client=customreport-runtime-sweep",
      );
      return Promise.resolve(response({ id: event.event_id }));
    });

    await expect(
      probeBugsinkChannel({ dsn: DSN, apiToken: API_TOKEN }, report, fetcher, {
        now: () => 0,
        sleep: () => Promise.resolve(),
        deadlineMs: 100,
      }),
    ).resolves.toEqual({
      channel: "bugsink",
      reachable: true,
      hasStreams: true,
      events: [],
    });

    const getCalls = fetcher.mock.calls.filter(([input]) =>
      new URL(urlOf(input)).pathname.includes("/canonical/0/projects/"),
    );
    expect(getCalls).toHaveLength(2);
    expect(new Headers(getCalls[0]?.[1]?.headers).get("authorization")).toBe(
      `Bearer ${API_TOKEN}`,
    );
    const storeRequest = fetcher.mock.calls.find(([input]) =>
      new URL(urlOf(input)).pathname.endsWith("/store/"),
    );
    const event = JSON.parse(
      typeof storeRequest?.[1]?.body === "string" ? storeRequest[1].body : "{}",
    ) as Record<string, unknown>;
    expect(event).toMatchObject({
      platform: "javascript",
      logger: "customreport.runtime-sweep",
      level: "info",
      message: "runtime-sweep-probe",
    });
    expect(JSON.stringify(event)).not.toContain(API_TOKEN);
  });

  it("does not treat a matching receipt and stagnant counters as liveness", async () => {
    const fetcher = vi.fn<typeof fetch>((input, init) => {
      const url = new URL(urlOf(input));
      if (url.pathname.endsWith("/store/")) {
        const body = JSON.parse(
          typeof init?.body === "string" ? init.body : "{}",
        ) as { event_id: string };
        return Promise.resolve(response({ id: body.event_id }));
      }
      return Promise.resolve(response(project(2, 3)));
    });

    await expect(
      probeBugsinkChannel({ dsn: DSN, apiToken: API_TOKEN }, report, fetcher, {
        now: () => 0,
        sleep: () => Promise.resolve(),
        deadlineMs: 100,
        maxAttempts: 2,
      }),
    ).resolves.toMatchObject({
      channel: "bugsink",
      reachable: false,
      hasStreams: false,
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it.each([
    ["missing DSN", { apiToken: API_TOKEN }],
    ["missing API token", { dsn: DSN }],
    ["uppercase API token", { dsn: DSN, apiToken: API_TOKEN.toUpperCase() }],
    ["short API token", { dsn: DSN, apiToken: "a".repeat(39) }],
  ] as const)("stays blind with %s", async (_label, config) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      probeBugsinkChannel(config, report, fetcher),
    ).resolves.toMatchObject({ reachable: false, hasStreams: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed project response", response({ slug: "runtime-sweep" })],
    ["rejected project response", response({ error: "forbidden" }, 403)],
  ] as const)("stays blind for %s", async (_label, projectResponse) => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(projectResponse));
    await expect(
      probeBugsinkChannel({ dsn: DSN, apiToken: API_TOKEN }, report, fetcher),
    ).resolves.toMatchObject({ reachable: false, hasStreams: false });
  });

  it("rejects a non-dedicated project slug", async () => {
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.resolve(response(project(0, 0, "other-project"))),
    );
    await expect(
      probeBugsinkChannel({ dsn: DSN, apiToken: API_TOKEN }, report, fetcher),
    ).resolves.toMatchObject({ reachable: false, hasStreams: false });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("stays blind for receipt mismatch and poll failure", async () => {
    const receiptMismatch = vi.fn<typeof fetch>((input) =>
      Promise.resolve(
        new URL(urlOf(input)).pathname.endsWith("/store/")
          ? response({ id: "different-event" })
          : response(project(0, 0)),
      ),
    );
    await expect(
      probeBugsinkChannel(
        { dsn: DSN, apiToken: API_TOKEN },
        report,
        receiptMismatch,
      ),
    ).resolves.toMatchObject({ reachable: false, hasStreams: false });

    const pollResponses = [project(0, 0), { malformed: true }].values();
    const pollFailure = vi.fn<typeof fetch>((input, init) => {
      const url = new URL(urlOf(input));
      if (url.pathname.endsWith("/store/")) {
        const body = JSON.parse(
          typeof init?.body === "string" ? init.body : "{}",
        ) as { event_id: string };
        return Promise.resolve(response({ id: body.event_id }));
      }
      return Promise.resolve(response(pollResponses.next().value ?? {}));
    });
    await expect(
      probeBugsinkChannel(
        { dsn: DSN, apiToken: API_TOKEN },
        report,
        pollFailure,
      ),
    ).resolves.toMatchObject({ reachable: false, hasStreams: false });
  });

  it("does not expose DSN or token through blind feedback", async () => {
    const token = "b".repeat(40);
    const secretDsn = "http://private:password@example.test/1";
    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.reject(new Error("offline")),
    );
    const result = await probeBugsinkChannel(
      { dsn: secretDsn, apiToken: token },
      report,
      fetcher,
    );
    expect(JSON.stringify(result)).not.toContain(secretDsn);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain("password");
  });
});
