import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { AiDriverReport } from "./driver-results-contract.ts";
import type { EnvironmentChannelInput } from "./environment-feedback.ts";

const PROBE_MESSAGE = "runtime-sweep-probe";
const REQUEST_TIMEOUT_MS = 5000;
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

export interface LokiProbeConfig {
  readonly pushUrl?: string;
  readonly queryUrl?: string;
  readonly username?: string;
  readonly password?: string;
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

export async function probeBugsinkChannel(
  dsn: string | undefined,
  report: AiDriverReport,
  fetcher: typeof fetch,
): Promise<EnvironmentChannelInput> {
  if (!dsn) return blind("bugsink");
  try {
    const parsed = new URL(dsn);
    const projectId = parsed.pathname.split("/").filter(Boolean).at(-1);
    if (!parsed.username || !projectId) throw new Error("invalid Bugsink DSN");
    const endpoint = new URL(`/api/${projectId}/store/`, parsed.origin);
    const sentryAuth = [
      "Sentry sentry_version=7",
      `sentry_key=${decodeURIComponent(parsed.username)}`,
      "sentry_client=customreport-runtime-sweep",
    ].join(",");
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": sentryAuth,
      },
      body: JSON.stringify({
        event_id: randomUUID().replaceAll("-", ""),
        timestamp: Math.floor(
          (timestamp(report.timeline.endedAt) ?? Date.now()) /
            MILLIS_PER_SECOND,
        ),
        level: "info",
        message: PROBE_MESSAGE,
        tags: { runtime_sweep_probe: "true" },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return {
      channel: "bugsink",
      reachable: response.ok,
      hasStreams: response.ok,
      events: [],
    };
  } catch {
    return blind("bugsink");
  }
}

export async function probeLokiChannel(
  config: LokiProbeConfig | undefined,
  report: AiDriverReport,
  fetcher: typeof fetch,
): Promise<EnvironmentChannelInput> {
  if (!config?.pushUrl || !config.queryUrl) return blind("loki");
  const headers = headersFor(config.username, config.password);
  if (!headers) return blind("loki");
  const probeId = randomUUID();
  const probeTime = timestamp(report.timeline.endedAt);
  if (probeTime === null) return blind("loki");
  try {
    const push = await fetcher(config.pushUrl, {
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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!push.ok) throw new Error("Loki push rejected");
    const query = new URL(config.queryUrl);
    query.searchParams.set("query", `{runtime_sweep_probe_id="${probeId}"}`);
    query.searchParams.set(
      "start",
      String(probeTime * NANOS_PER_MILLISECOND - NANOS_PER_MILLISECOND),
    );
    query.searchParams.set(
      "end",
      String(probeTime * NANOS_PER_MILLISECOND + NANOS_PER_MILLISECOND),
    );
    const response = await fetcher(query, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error("Loki query rejected");
    const parsed = lokiResponseSchema.parse(JSON.parse(await response.text()));
    const hasProbe = parsed.data.result.some((stream) =>
      stream.values.some(([, value]) => value.includes(probeId)),
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
