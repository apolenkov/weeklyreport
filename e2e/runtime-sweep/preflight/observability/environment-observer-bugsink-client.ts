import { randomUUID } from "node:crypto";

import { z } from "zod";

const PROBE_MESSAGE = "runtime-sweep-probe";
const DEFAULT_DEADLINE_MS = 5000;
const DEDICATED_PROJECT_SLUG = "runtime-sweep";
const MILLIS_PER_SECOND = 1000;
export const bugsinkApiTokenPattern = /^[0-9a-f]{40}$/u;
const projectCountersSchema = z.looseObject({
  slug: z.literal(DEDICATED_PROJECT_SLUG),
  digested_event_count: z.number().int().nonnegative(),
  stored_event_count: z.number().int().nonnegative(),
});
const receiptSchema = z.object({ id: z.string().min(1) }).strict();

export type BugsinkProjectCounters = z.infer<typeof projectCountersSchema>;

export interface BugsinkProbeConfig {
  readonly dsn?: string;
  readonly apiToken?: string;
}

const timeoutSignal = (deadline: number, now: () => number): AbortSignal => {
  const remaining = deadline - now();
  if (!Number.isFinite(remaining) || remaining <= 0)
    throw new Error("Bugsink probe deadline expired");
  return AbortSignal.timeout(Math.ceil(remaining));
};

export const bugsinkProjectUrls = (
  dsn: string,
): Readonly<{
  readonly projectUrl: URL;
  readonly ingestUrl: URL;
  readonly sentryKey: string;
}> => {
  const parsed = new URL(dsn);
  const projectId = parsed.pathname.split("/").filter(Boolean).at(-1);
  if (!parsed.username || !projectId) throw new Error("invalid Bugsink DSN");
  return {
    projectUrl: new URL(
      `/api/canonical/0/projects/${encodeURIComponent(projectId)}/`,
      parsed.origin,
    ),
    ingestUrl: new URL(
      `/api/${encodeURIComponent(projectId)}/store/`,
      parsed.origin,
    ),
    sentryKey: decodeURIComponent(parsed.username),
  };
};

export const readBugsinkProject = async (
  projectUrl: URL,
  apiToken: string,
  fetcher: typeof fetch,
  deadline: number,
  now: () => number,
): Promise<BugsinkProjectCounters> => {
  const response = await fetcher(projectUrl, {
    headers: { Authorization: `Bearer ${apiToken}` },
    signal: timeoutSignal(deadline, now),
  });
  if (!response.ok) throw new Error("Bugsink project read rejected");
  return projectCountersSchema.parse(JSON.parse(await response.text()));
};

export const sendBugsinkProbe = async (
  ingestUrl: URL,
  sentryKey: string,
  probeTime: number,
  fetcher: typeof fetch,
  deadline: number,
  now: () => number,
): Promise<string> => {
  const eventId = randomUUID().replaceAll("-", "");
  const response = await fetcher(ingestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": [
        "Sentry sentry_version=7",
        `sentry_key=${sentryKey}`,
        "sentry_client=customreport-runtime-sweep",
      ].join(","),
    },
    body: JSON.stringify({
      event_id: eventId,
      timestamp: Math.floor(probeTime / MILLIS_PER_SECOND),
      platform: "javascript",
      logger: "customreport.runtime-sweep",
      level: "info",
      message: PROBE_MESSAGE,
      tags: { runtime_sweep_probe: "true" },
    }),
    signal: timeoutSignal(deadline, now),
  });
  if (!response.ok) throw new Error("Bugsink ingestion rejected");
  const receipt = receiptSchema.parse(JSON.parse(await response.text()));
  if (receipt.id !== eventId) throw new Error("Bugsink receipt mismatch");
  return eventId;
};

export async function readBugsinkProjectCounters(
  config: BugsinkProbeConfig,
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<BugsinkProjectCounters> {
  const dsn = config.dsn;
  const apiToken = config.apiToken;
  if (!dsn || !apiToken || !bugsinkApiTokenPattern.test(apiToken))
    throw new Error("Bugsink project counters require valid credentials");
  const startedAt = now();
  const deadline = startedAt + DEFAULT_DEADLINE_MS;
  if (!Number.isFinite(startedAt) || !Number.isFinite(deadline))
    throw new Error("Bugsink project counter deadline is invalid");
  return readBugsinkProject(
    bugsinkProjectUrls(dsn).projectUrl,
    apiToken,
    fetcher,
    deadline,
    now,
  );
}
