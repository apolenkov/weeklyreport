import { z } from "zod";

import type { RuntimeObservabilityConfig } from "../runtime-observability-readiness.ts";
import {
  countKey,
  discrepanciesFor,
  type LogCount,
  type RuntimeLokiEvidence,
} from "./runtime-profile-observability-counts.ts";

const QUERY_TIMEOUT_MS = 5000;
const RECONCILIATION_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 100;
const MILLIS_PER_SECOND = 1000;
const NANOS_PER_MILLISECOND = 1_000_000;
const countResultSchema = z
  .object({
    status: z.literal("success"),
    data: z
      .object({
        resultType: z.literal("vector"),
        result: z
          .array(
            z
              .object({
                metric: z
                  .object({
                    correlationId: z.string().min(1),
                    level: z.enum(["debug", "info", "warn", "error"]),
                  })
                  .strict(),
                value: z.tuple([z.number(), z.string().regex(/^\d+$/u)]),
              })
              .strict(),
          )
          .readonly(),
      })
      .strict(),
  })
  .strict();
const totalResultSchema = z
  .object({
    status: z.literal("success"),
    data: z
      .object({
        resultType: z.literal("vector"),
        result: z
          .array(
            z
              .object({
                metric: z.record(z.string(), z.string()),
                value: z.tuple([z.number(), z.string().regex(/^\d+$/u)]),
              })
              .strict(),
          )
          .readonly(),
      })
      .strict(),
  })
  .strict();

const timestamp = (value: string): number => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds))
    throw new Error("Runtime profile observability timestamp is invalid");
  return milliseconds;
};

const authHeaders = (
  config: RuntimeObservabilityConfig["loki"],
): Readonly<Record<string, string>> => {
  if (config.username === undefined || config.password === undefined) return {};
  const credentials = `${config.username}:${config.password}`;
  return {
    Authorization: `Basic ${Buffer.from(credentials).toString("base64")}`,
  };
};

const instantQueryUrl = (
  queryUrl: string,
  query: string,
  endedAt: number,
): URL => {
  const url = new URL(queryUrl);
  url.pathname = url.pathname.replace(/\/query_range\/?$/u, "/query");
  url.search = "";
  url.searchParams.set("query", query);
  url.searchParams.set("time", String(endedAt * NANOS_PER_MILLISECOND));
  return url;
};

const queryLokiCounts = async (
  input: Readonly<{
    readonly config: RuntimeObservabilityConfig["loki"];
    readonly serviceName: string;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly deadline: number;
    readonly fetcher: typeof fetch;
  }>,
): Promise<readonly LogCount[]> => {
  const start = timestamp(input.startedAt);
  const end = timestamp(input.endedAt);
  const rangeSeconds = Math.max(
    1,
    Math.ceil((end - start) / MILLIS_PER_SECOND),
  );
  const selector = `{service_name=${JSON.stringify(input.serviceName)}}`;
  const query = `sum by (correlationId, level) (count_over_time(${selector} | correlationId!="" | level!="" [${String(rangeSeconds)}s]))`;
  const remaining = input.deadline - Date.now();
  if (remaining <= 0)
    throw new Error("Loki reconciliation exceeded its absolute deadline");
  const queryUrl = input.config.queryUrl;
  if (queryUrl === undefined)
    throw new Error("Runtime observability Loki query URL is missing");
  const response = await input.fetcher(instantQueryUrl(queryUrl, query, end), {
    headers: authHeaders(input.config),
    signal: AbortSignal.timeout(Math.min(QUERY_TIMEOUT_MS, remaining)),
  });
  if (!response.ok) throw new Error("Loki correlation query was rejected");
  const parsed = countResultSchema.parse(JSON.parse(await response.text()));
  return parsed.data.result
    .map(({ metric, value }) => ({ ...metric, count: Number(value[1]) }))
    .toSorted((left, right) => countKey(left).localeCompare(countKey(right)));
};

const queryLokiMessageCount = async (
  input: Readonly<{
    readonly config: RuntimeObservabilityConfig["loki"];
    readonly serviceName: string;
    readonly message: string;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly deadline: number;
    readonly fetcher: typeof fetch;
  }>,
): Promise<number> => {
  const start = timestamp(input.startedAt);
  const end = timestamp(input.endedAt);
  const rangeSeconds = Math.max(
    1,
    Math.ceil((end - start) / MILLIS_PER_SECOND),
  );
  const selector = `{service_name=${JSON.stringify(input.serviceName)}}`;
  const query = `sum(count_over_time(${selector} |= ${JSON.stringify(input.message)} [${String(rangeSeconds)}s]))`;
  const remaining = input.deadline - Date.now();
  if (remaining <= 0)
    throw new Error("Loki shutdown marker query exceeded its deadline");
  const queryUrl = input.config.queryUrl;
  if (queryUrl === undefined)
    throw new Error("Runtime observability Loki query URL is missing");
  const response = await input.fetcher(instantQueryUrl(queryUrl, query, end), {
    headers: authHeaders(input.config),
    signal: AbortSignal.timeout(Math.min(QUERY_TIMEOUT_MS, remaining)),
  });
  if (!response.ok) throw new Error("Loki shutdown marker query was rejected");
  const parsed = totalResultSchema.parse(JSON.parse(await response.text()));
  return parsed.data.result.reduce(
    (sum, { value }) => sum + Number(value[1]),
    0,
  );
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const poll = async (
  query: () => Promise<readonly LogCount[]>,
  expected: readonly LogCount[],
  deadline: number,
): Promise<readonly LogCount[]> => {
  const actual = await query();
  if (
    discrepanciesFor(expected, actual).length === 0 ||
    Date.now() + POLL_INTERVAL_MS >= deadline
  )
    return actual;
  await sleep(POLL_INTERVAL_MS);
  return poll(query, expected, deadline);
};

export const pollLokiCounts = (
  input: Readonly<{
    readonly config: RuntimeObservabilityConfig["loki"];
    readonly serviceName: string;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly expected: readonly LogCount[];
    readonly fetcher: typeof fetch;
  }>,
): Promise<readonly LogCount[]> => {
  const deadline = Date.now() + RECONCILIATION_TIMEOUT_MS;
  return poll(
    () => queryLokiCounts({ ...input, deadline }),
    input.expected,
    deadline,
  );
};

export const pollLokiMessageCount = async (
  input: Readonly<{
    readonly config: RuntimeObservabilityConfig["loki"];
    readonly serviceName: string;
    readonly message: string;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly expected: number;
    readonly fetcher: typeof fetch;
  }>,
): Promise<number> => {
  const deadline = Date.now() + RECONCILIATION_TIMEOUT_MS;
  const pollMessage = async (): Promise<number> => {
    const actual = await queryLokiMessageCount({ ...input, deadline });
    if (actual >= input.expected || Date.now() + POLL_INTERVAL_MS >= deadline)
      return actual;
    await sleep(POLL_INTERVAL_MS);
    return pollMessage();
  };
  return pollMessage();
};

export const queryRuntimeLokiEvidence = async (
  input: Readonly<{
    readonly config: RuntimeObservabilityConfig["loki"];
    readonly serviceName: string;
    readonly message: string;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly fetcher: typeof fetch;
  }>,
): Promise<RuntimeLokiEvidence> => {
  const deadline = Date.now() + QUERY_TIMEOUT_MS;
  const [counts, shutdownMarkers] = await Promise.all([
    queryLokiCounts({ ...input, deadline }),
    queryLokiMessageCount({ ...input, deadline }),
  ]);
  return { counts, shutdownMarkers };
};
