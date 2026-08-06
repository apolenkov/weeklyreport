import { randomUUID } from "node:crypto";

import { z } from "zod";

import type { AiDriverReport } from "../driver/driver-results-contract.ts";
import type { EnvironmentChannelInput } from "./environment-feedback.ts";

const PROBE_MESSAGE = "runtime-sweep-probe";
const DEFAULT_DEADLINE_MS = 5000;
const DEFAULT_POLL_INTERVAL_MS = 100;
const MAX_POLL_ATTEMPTS = 50;
const MILLIS_PER_SECOND = 1000;
const DEDICATED_PROJECT_SLUG = "runtime-sweep";
const apiTokenPattern = /^[0-9a-f]{40}$/u;
const projectCountersSchema = z.looseObject({
  slug: z.literal(DEDICATED_PROJECT_SLUG),
  digested_event_count: z.number().int().nonnegative(),
  stored_event_count: z.number().int().nonnegative(),
});
const receiptSchema = z.object({ id: z.string().min(1) }).strict();

export interface BugsinkProbeConfig {
  readonly dsn?: string;
  readonly apiToken?: string;
}

export interface BugsinkProbeOptions {
  readonly now?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly deadlineMs?: number;
  readonly pollIntervalMs?: number;
  readonly maxAttempts?: number;
}

const blind = (): EnvironmentChannelInput => ({
  channel: "bugsink",
  reachable: false,
  hasStreams: false,
  events: [],
});

const timestamp = (value: string): number | null => {
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
};

const timeoutSignal = (deadline: number, now: () => number): AbortSignal => {
  const remaining = deadline - now();
  if (!Number.isFinite(remaining) || remaining <= 0)
    throw new Error("Bugsink probe deadline expired");
  return AbortSignal.timeout(Math.ceil(remaining));
};

const projectUrlFor = (
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

const readProject = async (
  projectUrl: URL,
  apiToken: string,
  fetcher: typeof fetch,
  deadline: number,
  now: () => number,
): Promise<z.infer<typeof projectCountersSchema>> => {
  const response = await fetcher(projectUrl, {
    headers: { Authorization: `Bearer ${apiToken}` },
    signal: timeoutSignal(deadline, now),
  });
  if (!response.ok) throw new Error("Bugsink project read rejected");
  return projectCountersSchema.parse(JSON.parse(await response.text()));
};

const sendProbe = async (
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

const countersIncreased = (
  before: z.infer<typeof projectCountersSchema>,
  current: z.infer<typeof projectCountersSchema>,
): boolean =>
  current.digested_event_count > before.digested_event_count &&
  current.stored_event_count > before.stored_event_count;

const pollUntilStored = async (
  projectUrl: URL,
  apiToken: string,
  before: z.infer<typeof projectCountersSchema>,
  fetcher: typeof fetch,
  deadline: number,
  now: () => number,
  sleep: (milliseconds: number) => Promise<void>,
  pollInterval: number,
  attemptsRemaining: number,
): Promise<boolean> => {
  if (attemptsRemaining <= 0 || deadline - now() <= 0) return false;
  const current = await readProject(
    projectUrl,
    apiToken,
    fetcher,
    deadline,
    now,
  );
  if (countersIncreased(before, current)) return true;
  if (attemptsRemaining <= 1) return false;
  const remaining = deadline - now();
  if (!Number.isFinite(remaining) || remaining <= 0) return false;
  await sleep(Math.min(pollInterval, remaining));
  return pollUntilStored(
    projectUrl,
    apiToken,
    before,
    fetcher,
    deadline,
    now,
    sleep,
    pollInterval,
    attemptsRemaining - 1,
  );
};

interface ProbeContext {
  readonly now: () => number;
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly deadline: number;
  readonly pollInterval: number;
  readonly attempts: number;
}

const probeContext = (options: BugsinkProbeOptions): ProbeContext | null => {
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const pollInterval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxAttempts = options.maxAttempts ?? MAX_POLL_ATTEMPTS;
  const startedAt = now();
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(deadlineMs) ||
    deadlineMs <= 0 ||
    !Number.isFinite(pollInterval) ||
    pollInterval <= 0 ||
    !Number.isInteger(maxAttempts) ||
    maxAttempts <= 0
  )
    return null;
  const deadline = startedAt + deadlineMs;
  if (!Number.isFinite(deadline)) return null;
  return {
    now,
    sleep,
    deadline,
    pollInterval,
    attempts: Math.min(
      MAX_POLL_ATTEMPTS,
      maxAttempts,
      Math.ceil(deadlineMs / pollInterval) + 1,
    ),
  };
};

const executeProbe = async (
  dsn: string,
  apiToken: string,
  probeTime: number,
  fetcher: typeof fetch,
  context: ProbeContext,
): Promise<boolean> => {
  const urls = projectUrlFor(dsn);
  const before = await readProject(
    urls.projectUrl,
    apiToken,
    fetcher,
    context.deadline,
    context.now,
  );
  await sendProbe(
    urls.ingestUrl,
    urls.sentryKey,
    probeTime,
    fetcher,
    context.deadline,
    context.now,
  );
  return pollUntilStored(
    urls.projectUrl,
    apiToken,
    before,
    fetcher,
    context.deadline,
    context.now,
    context.sleep,
    context.pollInterval,
    context.attempts,
  );
};

export async function probeBugsinkChannel(
  config: BugsinkProbeConfig | undefined,
  report: AiDriverReport,
  fetcher: typeof fetch,
  options: BugsinkProbeOptions = {},
): Promise<EnvironmentChannelInput> {
  const dsn = config?.dsn;
  const apiToken = config?.apiToken;
  if (!dsn || !apiToken || !apiTokenPattern.test(apiToken)) return blind();
  const probeTime = timestamp(report.timeline.endedAt);
  if (probeTime === null) return blind();
  const context = probeContext(options);
  if (!context) return blind();
  try {
    const stored = await executeProbe(
      dsn,
      apiToken,
      probeTime,
      fetcher,
      context,
    );
    return stored
      ? { channel: "bugsink", reachable: true, hasStreams: true, events: [] }
      : blind();
  } catch {
    return blind();
  }
}
