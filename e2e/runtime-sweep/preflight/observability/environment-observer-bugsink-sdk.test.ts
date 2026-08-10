import { describe, expect, it, vi } from "vitest";

import {
  type BugsinkProbeConfig,
  normalizeBugsinkDsn,
} from "./environment-observer-bugsink-client.ts";
import { probeBugsinkSdkAt } from "./environment-observer-bugsink-sdk.ts";
import {
  captureProductSdkCanaries,
  type SdkProbeContext,
} from "./environment-observer-bugsink-sdk-client.ts";

const CANONICAL_KEY = "123e4567e89b12d3a456426614174000";
const HYPHENATED_KEY = "123e4567-e89b-12d3-a456-426614174000";
const API_TOKEN = "a".repeat(40);
const CONFIG: BugsinkProbeConfig = {
  dsn: `http://${CANONICAL_KEY}@bugsink.test/1`,
  apiToken: API_TOKEN,
};
const CONTEXT: SdkProbeContext = {
  now: () => 0,
  sleep: () => Promise.resolve(),
  deadline: 100,
  pollInterval: 1,
  attempts: 1,
};

const response = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const requestUrl = (input: RequestInfo | URL): URL =>
  input instanceof URL
    ? input
    : new URL(typeof input === "string" ? input : input.url);

const eventIdFromEnvelope = (init: RequestInit | undefined): string | null => {
  const body = typeof init?.body === "string" ? init.body : "";
  const eventId = body
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line) as { event_id?: unknown };
      } catch {
        return null;
      }
    })
    .map((line) => line?.event_id)
    .find((value): value is string => typeof value === "string");
  return eventId ?? null;
};

const project = (): Response =>
  response({
    slug: "runtime-sweep",
    digested_event_count: 1,
    stored_event_count: 1,
  });

const sdkFetcher = (stored: string[], storeEvent: boolean): typeof fetch =>
  vi.fn<typeof fetch>((input, init) => {
    const url = requestUrl(input);
    if (url.pathname.includes("/canonical/0/projects/"))
      return Promise.resolve(project());
    if (url.pathname.endsWith("/envelope/")) {
      const eventId = eventIdFromEnvelope(init);
      if (storeEvent && eventId) stored.push(eventId);
      return Promise.resolve(response(null));
    }
    if (url.pathname.endsWith("/issues/"))
      return Promise.resolve(
        response(
          stored.length > 0
            ? { results: [{ id: "issue-1" }] }
            : { results: [] },
        ),
      );
    if (url.pathname.endsWith("/events/"))
      return Promise.resolve(
        response({ results: stored.map((event_id) => ({ event_id })) }),
      );
    return Promise.resolve(response({ error: "unexpected" }, 404));
  });

describe("Bugsink SDK liveness probe", () => {
  it("normalizes a hyphenated UUID key to the SDK-safe canonical form", () => {
    expect(normalizeBugsinkDsn(`http://${HYPHENATED_KEY}@bugsink.test/1`)).toBe(
      `http://${CANONICAL_KEY}@bugsink.test/1`,
    );
  });

  it("rejects a malformed hyphenated key before SDK initialization", () => {
    expect(() =>
      normalizeBugsinkDsn("http://12345678-1234-not-a-uuid@bugsink.test/1"),
    ).toThrow("invalid Bugsink DSN");
  });

  it("fails closed when the installed SDK rejects its DSN", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      await expect(
        captureProductSdkCanaries(
          "http://not-a-uuid@bugsink.test/1",
          vi.fn<typeof fetch>(),
          CONTEXT,
        ),
      ).rejects.toThrow("Bugsink SDK canary failed");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("fails closed when the SDK transport cannot flush", async () => {
    const fetcher = vi.fn<typeof fetch>((input) => {
      const url = requestUrl(input);
      return Promise.resolve(
        url.pathname.endsWith("/envelope/")
          ? response({ error: "unavailable" }, 503)
          : project(),
      );
    });
    await expect(
      probeBugsinkSdkAt(CONFIG, fetcher, {
        ...CONTEXT,
        maxAttempts: 1,
        deadlineMs: 100,
      }),
    ).resolves.toBe(false);
  });

  it("fails closed when the canary is absent from stored events", async () => {
    const stored: string[] = [];
    await expect(
      probeBugsinkSdkAt(CONFIG, sdkFetcher(stored, false), {
        ...CONTEXT,
        maxAttempts: 1,
        deadlineMs: 100,
      }),
    ).resolves.toBe(false);
  });

  it("accepts the canonical DSN and proves the exact SDK event is stored", async () => {
    const stored: string[] = [];
    const fetcher = sdkFetcher(stored, true);
    await expect(
      probeBugsinkSdkAt(CONFIG, fetcher, {
        ...CONTEXT,
        maxAttempts: 1,
        deadlineMs: 100,
      }),
    ).resolves.toBe(true);
    expect(stored).toHaveLength(2);
    const envelope = vi
      .mocked(fetcher)
      .mock.calls.find(([input]) =>
        requestUrl(input).pathname.endsWith("/envelope/"),
      );
    expect(envelope?.[1]?.body).toContain("runtime_sweep_sdk_probe");
    expect(
      vi
        .mocked(fetcher)
        .mock.calls.filter(([input]) =>
          requestUrl(input).pathname.endsWith("/envelope/"),
        )
        .map(([, init]) => init?.body),
    ).toEqual([
      expect.stringContaining('"runtime_sweep_sdk_path":"api"'),
      expect.stringContaining('"runtime_sweep_sdk_path":"browser"'),
    ]);
  });

  it("normalizes a hyphenated runtime DSN before the SDK canary", async () => {
    const stored: string[] = [];
    await expect(
      probeBugsinkSdkAt(
        { ...CONFIG, dsn: `http://${HYPHENATED_KEY}@bugsink.test/1` },
        sdkFetcher(stored, true),
        { ...CONTEXT, maxAttempts: 1, deadlineMs: 100 },
      ),
    ).resolves.toBe(true);
  });
});
