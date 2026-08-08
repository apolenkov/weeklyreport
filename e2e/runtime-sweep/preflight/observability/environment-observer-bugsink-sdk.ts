import { z } from "zod";

import {
  bugsinkApiTokenPattern,
  type BugsinkProbeConfig,
  bugsinkProjectUrls,
  normalizeBugsinkDsn,
  readBugsinkProject,
} from "./environment-observer-bugsink-client.ts";
import {
  captureProductSdkCanaries,
  type SdkProbeContext,
  timeoutSignal,
} from "./environment-observer-bugsink-sdk-client.ts";

const DEFAULT_DEADLINE_MS = 5000;
const DEFAULT_POLL_INTERVAL_MS = 100;
const MAX_POLL_ATTEMPTS = 50;
const MAX_ISSUES_TO_SCAN = 64;

const issuePageSchema = z.object({
  results: z.array(z.looseObject({ id: z.string().min(1) })),
});
const eventPageSchema = z.object({
  results: z.array(z.looseObject({ event_id: z.string().min(1) })),
});

const validContext = (
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

const probeContext = (
  options: BugsinkSdkProbeOptions,
): SdkProbeContext | null => {
  const now = options.now ?? Date.now;
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const pollInterval = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxAttempts = options.maxAttempts ?? MAX_POLL_ATTEMPTS;
  const startedAt = now();
  if (!validContext(startedAt, deadlineMs, pollInterval, maxAttempts))
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

const normalizedEventId = (value: string): string =>
  value.replaceAll("-", "").toLowerCase();

const readProjectIssues = async (
  projectId: string,
  origin: string,
  apiToken: string,
  fetcher: typeof fetch,
  context: SdkProbeContext,
): Promise<readonly string[]> => {
  const url = new URL(
    `/api/canonical/0/issues/?project=${encodeURIComponent(projectId)}&sort=last_seen&order=desc`,
    origin,
  );
  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
    signal: timeoutSignal(context.deadline, context.now),
  });
  if (!response.ok) throw new Error("Bugsink issue read rejected");
  return issuePageSchema
    .parse(JSON.parse(await response.text()))
    .results.map(({ id }) => id)
    .slice(0, MAX_ISSUES_TO_SCAN);
};

const readIssueEventIds = async (
  issueId: string,
  origin: string,
  apiToken: string,
  fetcher: typeof fetch,
  context: SdkProbeContext,
): Promise<readonly string[]> => {
  const url = new URL(
    `/api/canonical/0/events/?issue=${encodeURIComponent(issueId)}&order=desc`,
    origin,
  );
  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
    signal: timeoutSignal(context.deadline, context.now),
  });
  if (!response.ok) throw new Error("Bugsink event read rejected");
  return eventPageSchema
    .parse(JSON.parse(await response.text()))
    .results.map(({ event_id }) => event_id);
};

const eventStoredInIssues = async (
  issueIds: readonly string[],
  targetEventId: string,
  origin: string,
  apiToken: string,
  fetcher: typeof fetch,
  context: SdkProbeContext,
): Promise<boolean> => {
  const [issueId, ...remaining] = issueIds;
  if (issueId === undefined) return false;
  const eventIds = await readIssueEventIds(
    issueId,
    origin,
    apiToken,
    fetcher,
    context,
  );
  return eventIds.some(
    (eventId) => normalizedEventId(eventId) === targetEventId,
  )
    ? true
    : eventStoredInIssues(
        remaining,
        targetEventId,
        origin,
        apiToken,
        fetcher,
        context,
      );
};

const allEventsStoredInIssues = async (
  issueIds: readonly string[],
  targetEventIds: readonly string[],
  origin: string,
  apiToken: string,
  fetcher: typeof fetch,
  context: SdkProbeContext,
): Promise<boolean> =>
  (
    await Promise.all(
      targetEventIds.map((eventId) =>
        eventStoredInIssues(
          issueIds,
          normalizedEventId(eventId),
          origin,
          apiToken,
          fetcher,
          context,
        ),
      ),
    )
  ).every(Boolean);

const pollUntilEventStored = async (
  urls: ReturnType<typeof bugsinkProjectUrls>,
  apiToken: string,
  eventIds: readonly string[],
  fetcher: typeof fetch,
  context: SdkProbeContext,
  attemptsRemaining: number,
): Promise<boolean> => {
  if (attemptsRemaining <= 0 || context.deadline - context.now() <= 0)
    return false;
  const issueIds = await readProjectIssues(
    urls.projectId,
    urls.projectUrl.origin,
    apiToken,
    fetcher,
    context,
  );
  if (
    await allEventsStoredInIssues(
      issueIds,
      eventIds,
      urls.projectUrl.origin,
      apiToken,
      fetcher,
      context,
    )
  )
    return true;
  if (attemptsRemaining <= 1) return false;
  const remaining = context.deadline - context.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return false;
  await context.sleep(Math.min(context.pollInterval, remaining));
  return pollUntilEventStored(
    urls,
    apiToken,
    eventIds,
    fetcher,
    context,
    attemptsRemaining - 1,
  );
};

export interface BugsinkSdkProbeOptions {
  readonly now?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly deadlineMs?: number;
  readonly pollIntervalMs?: number;
  readonly maxAttempts?: number;
}

export async function probeBugsinkSdkAt(
  config: BugsinkProbeConfig | undefined,
  fetcher: typeof fetch = fetch,
  options: BugsinkSdkProbeOptions = {},
): Promise<boolean> {
  const dsn = config?.dsn;
  const apiToken = config?.apiToken;
  if (!dsn || !apiToken || !bugsinkApiTokenPattern.test(apiToken)) return false;
  const context = probeContext(options);
  if (context === null) return false;
  try {
    const canonicalDsn = normalizeBugsinkDsn(dsn);
    const urls = bugsinkProjectUrls(canonicalDsn);
    await readBugsinkProject(
      urls.projectUrl,
      apiToken,
      fetcher,
      context.deadline,
      context.now,
    );
    const canaries = await captureProductSdkCanaries(
      canonicalDsn,
      fetcher,
      context,
    );
    return await pollUntilEventStored(
      urls,
      apiToken,
      [canaries.apiEventId, canaries.browserEventId],
      fetcher,
      context,
      context.attempts,
    );
  } catch {
    return false;
  }
}
