import { describe, expect, it, vi } from "vitest";

import type { AiDriverReport } from "../../driver/driver-results-contract.ts";
import { probeLokiChannel } from "./environment-observer-probes.ts";

const report = {
  timeline: { endedAt: "2026-08-04T00:00:00.000Z" },
} as AiDriverReport;
const config = {
  pushUrl: "http://loki.test/push",
  queryUrl: "http://loki.test/query_range",
};

const response = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const resultBody = (probeId: string, includeProbe: boolean): unknown => ({
  status: "success",
  data: {
    result: includeProbe
      ? [{ values: [["1", `runtime-sweep-probe ${probeId}`]] }]
      : [],
  },
});

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

describe("environment liveness probes", () => {
  it("polls after an accepted push until the probe becomes visible", async () => {
    const now = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(5)
      .mockReturnValue(10);
    const visibility = [false, false, true].values();
    const fetcherMock = vi.fn((input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.endsWith("/push"))
        return Promise.resolve(new Response(null, { status: 204 }));
      const probeId =
        new URL(url).searchParams.get("query")?.match(/"([^"]+)"/u)?.[1] ?? "";
      return Promise.resolve(
        response(resultBody(probeId, visibility.next().value === true)),
      );
    });
    const fetcher = fetcherMock as typeof fetch;

    await expect(
      probeLokiChannel(config, report, fetcher, {
        now,
        sleep: () => Promise.resolve(),
        deadlineMs: 20,
        pollIntervalMs: 5,
      }),
    ).resolves.toMatchObject({ reachable: true, hasStreams: true });
    expect(
      fetcherMock.mock.calls.filter(([input]) =>
        new URL(urlOf(input)).pathname.endsWith("/query_range"),
      ),
    ).toHaveLength(3);
  });

  it("replaces reserved Loki query parameters and preserves unrelated ones", async () => {
    const fetcherMock = vi.fn((input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.endsWith("/push"))
        return Promise.resolve(new Response(null, { status: 204 }));
      const probeId =
        new URL(url).searchParams.get("query")?.match(/"([^"]+)"/u)?.[1] ?? "";
      return Promise.resolve(response(resultBody(probeId, true)));
    });
    await probeLokiChannel(
      {
        ...config,
        queryUrl:
          "http://loki.test/query_range?tenant=local&query=stale&start=1&end=2",
      },
      report,
      fetcherMock,
    );
    const queryCall = fetcherMock.mock.calls.find(
      ([input]) => !urlOf(input).endsWith("/push"),
    );
    if (!queryCall) throw new Error("Loki query was not observed");
    const parameters = new URL(urlOf(queryCall[0])).searchParams;
    expect(parameters.get("tenant")).toBe("local");
    expect(parameters.getAll("query")).toHaveLength(1);
    expect(parameters.getAll("start")).toHaveLength(1);
    expect(parameters.getAll("end")).toHaveLength(1);
    expect(parameters.get("query")).not.toBe("stale");
  });

  it("reports reachable but streamless after the bounded deadline", async () => {
    const now = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(5)
      .mockReturnValue(10);
    const fetcherMock = vi.fn((input: RequestInfo | URL) => {
      const url = urlOf(input);
      if (url.endsWith("/push"))
        return Promise.resolve(new Response(null, { status: 204 }));
      const probeId =
        new URL(url).searchParams.get("query")?.match(/"([^"]+)"/u)?.[1] ?? "";
      return Promise.resolve(response(resultBody(probeId, false)));
    });
    const fetcher = fetcherMock as typeof fetch;

    await expect(
      probeLokiChannel(config, report, fetcher, {
        now,
        sleep: () => Promise.resolve(),
        deadlineMs: 10,
        pollIntervalMs: 5,
      }),
    ).resolves.toMatchObject({ reachable: true, hasStreams: false });
    expect(
      fetcherMock.mock.calls.filter(([input]) =>
        new URL(urlOf(input)).pathname.endsWith("/query_range"),
      ).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("does not start a Loki query after the overall deadline", async () => {
    const now = vi
      .fn<() => number>()
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValue(10);
    const fetcher = vi.fn((_: RequestInfo | URL) =>
      Promise.resolve(new Response(null, { status: 204 })),
    );

    await expect(
      probeLokiChannel(config, report, fetcher as typeof fetch, {
        now,
        deadlineMs: 10,
      }),
    ).resolves.toMatchObject({ reachable: true, hasStreams: false });
    expect(fetcher).toHaveBeenCalledOnce();
    const firstCall = fetcher.mock.calls[0];
    if (!firstCall) throw new Error("Loki push call missing");
    expect(urlOf(firstCall[0])).toBe(config.pushUrl);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -1])(
    "rejects invalid Loki deadline %s before I/O",
    async (deadlineMs) => {
      const fetcher = vi.fn();
      await expect(
        probeLokiChannel(config, report, fetcher as typeof fetch, {
          deadlineMs,
        }),
      ).resolves.toMatchObject({ reachable: false, hasStreams: false });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("caps polling when the deadline-to-interval ratio overflows", async () => {
    const fetcher = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        urlOf(input).endsWith("/push")
          ? new Response(null, { status: 204 })
          : response(resultBody("absent", false)),
      ),
    );
    await expect(
      probeLokiChannel(config, report, fetcher as typeof fetch, {
        now: () => 0,
        sleep: () => Promise.resolve(),
        deadlineMs: 1_000_000_000,
        pollIntervalMs: Number.MIN_VALUE,
      }),
    ).resolves.toMatchObject({ reachable: true, hasStreams: false });
    expect(fetcher).toHaveBeenCalledTimes(101);
  });

  it("keeps rejected Loki endpoints blind", async () => {
    const fetcher: typeof fetch = (input) =>
      Promise.resolve(
        urlOf(input).endsWith("/push")
          ? new Response(null, { status: 204 })
          : response({ error: "unauthorized" }, 401),
      );

    await expect(
      probeLokiChannel(config, report, fetcher),
    ).resolves.toMatchObject({
      reachable: false,
      hasStreams: false,
    });
  });
});
