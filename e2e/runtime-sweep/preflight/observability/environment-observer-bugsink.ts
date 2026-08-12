import type { AiDriverReport } from "../../driver/driver-results-contract.ts";
import type { EnvironmentChannelInput } from "./environment-feedback.ts";
import {
  bugsinkApiTokenPattern,
  type BugsinkProbeConfig,
  type BugsinkProjectCounters,
  bugsinkProjectUrls,
  readBugsinkProject,
  readBugsinkProjectCounters,
  sendBugsinkProbe,
} from "./environment-observer-bugsink-client.ts";

const DEFAULT_DEADLINE_MS = 5000;
const DEFAULT_POLL_INTERVAL_MS = 100;
const MAX_POLL_ATTEMPTS = 50;
export type { BugsinkProbeConfig, BugsinkProjectCounters };
export { readBugsinkProjectCounters };

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

const countersIncreased = (
  before: BugsinkProjectCounters,
  current: BugsinkProjectCounters,
): boolean =>
  current.digested_event_count > before.digested_event_count &&
  current.stored_event_count > before.stored_event_count;

const pollUntilStored = async (
  projectUrl: URL,
  apiToken: string,
  before: BugsinkProjectCounters,
  fetcher: typeof fetch,
  deadline: number,
  now: () => number,
  sleep: (milliseconds: number) => Promise<void>,
  pollInterval: number,
  attemptsRemaining: number,
): Promise<boolean> => {
  if (attemptsRemaining <= 0 || deadline - now() <= 0) return false;
  const current = await readBugsinkProject(
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

const validProbeOptions = (
  startedAt: number,
  deadlineMs: number,
  pollInterval: number,
  maxAttempts: number,
): boolean =>
  Number.isFinite(startedAt) &&
  Number.isFinite(deadlineMs) &&
  deadlineMs > 0 &&
  Number.isFinite(pollInterval) &&
  pollInterval > 0 &&
  Number.isInteger(maxAttempts) &&
  maxAttempts > 0;

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
  if (!validProbeOptions(startedAt, deadlineMs, pollInterval, maxAttempts))
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

const credentialsFor = (
  config: BugsinkProbeConfig | undefined,
): Readonly<{ dsn: string; apiToken: string }> | null => {
  const dsn = config?.dsn;
  const apiToken = config?.apiToken;
  return dsn && apiToken && bugsinkApiTokenPattern.test(apiToken)
    ? { dsn, apiToken }
    : null;
};

const bugsinkChannel = (stored: boolean): EnvironmentChannelInput =>
  stored
    ? { channel: "bugsink", reachable: true, hasStreams: true, events: [] }
    : blind();

const executeProbe = async (
  dsn: string,
  apiToken: string,
  probeTime: number,
  fetcher: typeof fetch,
  context: ProbeContext,
): Promise<boolean> => {
  const urls = bugsinkProjectUrls(dsn);
  const before = await readBugsinkProject(
    urls.projectUrl,
    apiToken,
    fetcher,
    context.deadline,
    context.now,
  );
  await sendBugsinkProbe(
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
  const probeTime = timestamp(report.timeline.endedAt);
  if (probeTime === null) return blind();
  return probeBugsinkAt(config, probeTime, fetcher, options);
}

export async function probeBugsinkAt(
  config: BugsinkProbeConfig | undefined,
  probeTime: number,
  fetcher: typeof fetch,
  options: BugsinkProbeOptions = {},
): Promise<EnvironmentChannelInput> {
  const credentials = credentialsFor(config);
  if (credentials === null) return blind();
  if (!Number.isFinite(probeTime)) return blind();
  const context = probeContext(options);
  if (context === null) return blind();
  try {
    const stored = await executeProbe(
      credentials.dsn,
      credentials.apiToken,
      probeTime,
      fetcher,
      context,
    );
    return bugsinkChannel(stored);
  } catch {
    return blind();
  }
}
