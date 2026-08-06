import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { AiDriverReport } from "../driver/driver-results-contract.ts";
import type { EnvironmentChannelInput } from "./environment-feedback.ts";

const PROBE_MESSAGE = "runtime-sweep-probe";
const REQUEST_TIMEOUT_MS = 5000;
const LOKI_POLL_INTERVAL_MS = 100;
const MAX_LOKI_POLL_ATTEMPTS = 100;
const MILLIS_PER_SECOND = 1000;
const NANOS_PER_MILLISECOND = MILLIS_PER_SECOND * MILLIS_PER_SECOND;
const lokiResponseSchema = z.looseObject({
  status: z.literal("success"),
  data: z.object({
    result: z
      .array(
        z.object({
          values: z.array(z.tuple([z.string(), z.string()])).readonly(),
        }),
      )
      .readonly(),
  }),
});
class LokiDeadlineError extends Error {}

export interface LokiProbeConfig {
  readonly pushUrl?: string;
  readonly queryUrl?: string;
  readonly username?: string;
  readonly password?: string;
}

export interface LokiProbeOptions {
  readonly now?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly deadlineMs?: number;
  readonly pollIntervalMs?: number;
}

const blind = (
  channel: EnvironmentChannelInput["channel"],
): EnvironmentChannelInput => ({
  channel,
  reachable: false,
  hasStreams: false,
  events: [],
});

const headersFor = (
  username: string | undefined,
  password: string | undefined,
): Record<string, string> | null => {
  if ((username === undefined) !== (password === undefined)) return null;
  if (username === undefined || password === undefined) return {};
  const credentials = `${username}:${password}`;
  return {
    Authorization: `Basic ${Buffer.from(credentials).toString("base64")}`,
  };
};

const timestamp = (value: string): number | null => {
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
};

const timeoutSignal = (deadline: number, now: () => number): AbortSignal => {
  const remaining = deadline - now();
  if (!Number.isFinite(remaining) || remaining <= 0)
    throw new LokiDeadlineError("Loki probe deadline expired");
  return AbortSignal.timeout(Math.ceil(remaining));
};

const pushLokiProbe = async (
  pushUrl: string,
  headers: Record<string, string>,
  probeId: string,
  probeTime: number,
  fetcher: typeof fetch,
  deadline: number,
  now: () => number,
): Promise<void> => {
  const push = await fetcher(pushUrl, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      streams: [
        {
          stream: { job: "runtime-sweep", runtime_sweep_probe_id: probeId },
          values: [
            [
              String(probeTime * NANOS_PER_MILLISECOND),
              `${PROBE_MESSAGE} ${probeId}`,
            ],
          ],
        },
      ],
    }),
    signal: timeoutSignal(deadline, now),
  });
  if (!push.ok) throw new Error("Loki push rejected");
};

const queryUrlFor = (
  queryUrl: string,
  probeId: string,
  probeTime: number,
): URL => {
  const base = new URL(queryUrl);
  const reserved = new Set(["query", "start", "end"]);
  const search = new URLSearchParams([
    ...[...base.searchParams.entries()].filter(([key]) => !reserved.has(key)),
    ["query", `{runtime_sweep_probe_id="${probeId}"}`],
    [
      "start",
      String(probeTime * NANOS_PER_MILLISECOND - NANOS_PER_MILLISECOND),
    ],
    ["end", String(probeTime * NANOS_PER_MILLISECOND + NANOS_PER_MILLISECOND)],
  ]);
  return new URL(`${base.pathname}?${search.toString()}`, base.origin);
};

const queryLokiProbe = async (
  query: URL,
  headers: Record<string, string>,
  probeId: string,
  fetcher: typeof fetch,
  deadline: number,
  now: () => number,
): Promise<boolean> => {
  const response = await fetcher(query, {
    headers,
    signal: timeoutSignal(deadline, now),
  });
  if (!response.ok) throw new Error("Loki query rejected");
  const parsed = lokiResponseSchema.parse(JSON.parse(await response.text()));
  return parsed.data.result.some((stream) =>
    stream.values.some(([, value]) => value.includes(probeId)),
  );
};

const queryUntilDeadline = async (
  queryProbe: () => Promise<boolean>,
  deadline: number,
  now: () => number,
  sleep: (milliseconds: number) => Promise<void>,
  pollInterval: number,
  attemptsRemaining: number,
): Promise<boolean> => {
  const remaining = deadline - now();
  if (attemptsRemaining <= 0 || !Number.isFinite(remaining) || remaining <= 0)
    return false;
  const probeResult = await queryProbe().catch((error: unknown) => {
    if (error instanceof LokiDeadlineError) return null;
    throw error;
  });
  if (probeResult === null) return false;
  if (probeResult) return true;
  if (attemptsRemaining <= 1) return false;
  const remainingAfterQuery = deadline - now();
  if (!Number.isFinite(remainingAfterQuery) || remainingAfterQuery <= 0)
    return false;
  await sleep(Math.min(pollInterval, remainingAfterQuery));
  return queryUntilDeadline(
    queryProbe,
    deadline,
    now,
    sleep,
    pollInterval,
    attemptsRemaining - 1,
  );
};

export async function probeLokiChannel(
  config: LokiProbeConfig | undefined,
  report: AiDriverReport,
  fetcher: typeof fetch,
  options: LokiProbeOptions = {},
): Promise<EnvironmentChannelInput> {
  if (!config?.pushUrl || !config.queryUrl) return blind("loki");
  const headers = headersFor(config.username, config.password);
  if (!headers) return blind("loki");
  const probeId = randomUUID();
  const probeTime = timestamp(report.timeline.endedAt);
  if (probeTime === null) return blind("loki");
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const deadlineDuration = options.deadlineMs ?? REQUEST_TIMEOUT_MS;
  const pollInterval = options.pollIntervalMs ?? LOKI_POLL_INTERVAL_MS;
  const startedAt = now();
  if (
    !Number.isFinite(deadlineDuration) ||
    deadlineDuration <= 0 ||
    !Number.isFinite(pollInterval) ||
    pollInterval <= 0 ||
    !Number.isFinite(startedAt)
  )
    return blind("loki");
  const deadline = startedAt + deadlineDuration;
  if (!Number.isFinite(deadline)) return blind("loki");
  const attempts = Math.min(
    MAX_LOKI_POLL_ATTEMPTS,
    Math.ceil(deadlineDuration / pollInterval) + 1,
  );
  try {
    await pushLokiProbe(
      config.pushUrl,
      headers,
      probeId,
      probeTime,
      fetcher,
      deadline,
      now,
    );
    const query = queryUrlFor(config.queryUrl, probeId, probeTime);
    const hasProbe = await queryUntilDeadline(
      () => queryLokiProbe(query, headers, probeId, fetcher, deadline, now),
      deadline,
      now,
      sleep,
      pollInterval,
      attempts,
    );
    return {
      channel: "loki",
      reachable: true,
      hasStreams: hasProbe,
      events: [],
    };
  } catch {
    return blind("loki");
  }
}
