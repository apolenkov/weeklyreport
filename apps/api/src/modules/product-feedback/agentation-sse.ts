import type { Request, Response } from "express";

export interface AgentationSseEvent {
  readonly type: string;
  readonly sessionId?: string;
  readonly timestamp: string;
  readonly sequence: number | bigint;
  readonly payload: unknown;
}

export interface AgentationSseSource {
  loadEvents(
    after: bigint,
    scopedSessionId?: string,
  ): Promise<readonly AgentationSseEvent[]>;
  loadPending(scopedSessionId?: string): Promise<readonly unknown[]>;
  loadLatestSequence(scopedSessionId?: string): Promise<bigint>;
  loadDeletionEvents(
    sessionId: string,
    after: bigint,
    through: bigint,
    limit: number,
  ): Promise<readonly AgentationSseEvent[]>;
}

export interface AgentationSseOptions {
  readonly req: Request;
  readonly res: Response;
  readonly source: AgentationSseSource;
  readonly scopedSessionId?: string;
  readonly agent: boolean;
  readonly allowGlobal: boolean;
  readonly expectedFrontendOrigin?: string;
  readonly expectedHostname?: string;
  readonly pollIntervalMs?: number;
  readonly heartbeatIntervalMs?: number;
  readonly maxBatchSize?: number;
  readonly setIntervalFn?: (callback: () => void, delay: number) => unknown;
  readonly clearIntervalFn?: (timer: unknown) => void;
  readonly onPollError?: (error: unknown) => void;
}

export interface AgentationSseConnectionCounts {
  readonly activeListeners: number;
  readonly agentListeners: number;
}

const DEFAULT_POLL_INTERVAL_MS = 500;
// Send before the web rewrite proxy's 30-second idle timeout.
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const DEFAULT_MAX_BATCH_SIZE = 100;
const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;
const HTTP_SERVER_ERROR = 500;
const ZERO_SEQUENCE = 0n;
const connections = { active: 0, agent: 0 };

export function getAgentationSseConnectionCounts(): AgentationSseConnectionCounts {
  return {
    activeListeners: connections.active,
    agentListeners: connections.agent,
  };
}

function sequence(value: number | bigint): bigint {
  return typeof value === "bigint"
    ? value
    : BigInt(Math.max(0, Math.trunc(value)));
}

function requestQuery(req: Request, name: string): string | undefined {
  const value = req.query[name];
  return typeof value === "string" ? value : undefined;
}

function expectedDomain(options: AgentationSseOptions): string | undefined {
  if (options.expectedHostname) return options.expectedHostname;
  if (!options.expectedFrontendOrigin) return undefined;
  return new URL(options.expectedFrontendOrigin).hostname;
}

function responseOpen(res: Response): boolean {
  return !res.destroyed && !res.writableEnded;
}

function send(res: Response, event: AgentationSseEvent): boolean {
  if (!responseOpen(res)) return false;
  const id = sequence(event.sequence).toString();
  const payload = { ...event, sequence: Number(sequence(event.sequence)) };
  res.write(
    `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(payload)}\n\n`,
  );
  return true;
}

function pendingSessionId(
  payload: unknown,
  scopedSessionId: string | undefined,
): string | undefined {
  if (scopedSessionId) return scopedSessionId;
  if (typeof payload !== "object" || payload === null) return undefined;
  const value = (payload as Record<string, unknown>).sessionId;
  return typeof value === "string" ? value : undefined;
}

function lastEventSequence(req: Request): bigint | undefined {
  const header = req.header("last-event-id");
  if (header === undefined || !/^\d+$/u.test(header)) return undefined;
  try {
    return BigInt(header);
  } catch {
    return undefined;
  }
}

async function sendInitialSync(
  options: AgentationSseOptions,
  domain: string | undefined,
  maxBatchSize: number,
): Promise<void> {
  if (!options.agent) return;
  const pending = await options.source.loadPending(options.scopedSessionId);
  const delivered = pending.slice(0, maxBatchSize);
  for (const payload of delivered) {
    if (!responseOpen(options.res)) return;
    const sessionId = pendingSessionId(payload, options.scopedSessionId);
    send(options.res, {
      type: "annotation.created",
      ...(sessionId ? { sessionId } : {}),
      timestamp: new Date().toISOString(),
      sequence: ZERO_SEQUENCE,
      payload,
    });
  }
  if (!responseOpen(options.res)) return;
  options.res.write(
    `event: sync.complete\ndata: ${JSON.stringify({ domain: domain ?? "all", count: delivered.length, timestamp: new Date().toISOString() })}\n\n`,
  );
}

function rejectInvalidScope(
  options: AgentationSseOptions,
  domain: string | undefined,
): boolean {
  if (!options.scopedSessionId && !options.allowGlobal) {
    options.res
      .status(HTTP_FORBIDDEN)
      .json({ error: "Global Agentation stream is disabled." });
    return true;
  }
  if (domain && expectedDomain(options) !== domain) {
    options.res.status(HTTP_FORBIDDEN).json({ error: "Invalid event domain." });
    return true;
  }
  return false;
}

async function replayInitialDeletions(
  options: AgentationSseOptions,
  through: bigint,
  limit: number,
): Promise<void> {
  if (!options.scopedSessionId || options.agent) return;
  const state = { after: ZERO_SEQUENCE };
  while (
    state.after < through &&
    !options.res.destroyed &&
    !options.res.writableEnded
  ) {
    const batch = await options.source.loadDeletionEvents(
      options.scopedSessionId,
      state.after,
      through,
      limit,
    );
    const last = batch.at(-1);
    if (!last) return;
    for (const event of batch) {
      if (!send(options.res, event)) return;
    }
    state.after = sequence(last.sequence);
  }
}

export async function runAgentationSsePoll(
  options: AgentationSseOptions,
  cursor: bigint,
): Promise<bigint> {
  if (!responseOpen(options.res)) return cursor;
  const batch = (
    await options.source.loadEvents(cursor, options.scopedSessionId)
  )
    .slice(0, options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE)
    .sort((left, right) => {
      const leftSequence = sequence(left.sequence);
      const rightSequence = sequence(right.sequence);
      return leftSequence === rightSequence
        ? 0
        : leftSequence < rightSequence
          ? -1
          : 1;
    });
  const state = { next: cursor };
  for (const event of batch) {
    const eventSequence = sequence(event.sequence);
    if (eventSequence <= state.next) continue;
    if (!send(options.res, event)) break;
    state.next = eventSequence;
  }
  return state.next;
}

async function initializeStream(
  options: AgentationSseOptions,
  domain: string | undefined,
  maxBatchSize: number,
  replayCursor: bigint | undefined,
): Promise<bigint | undefined> {
  try {
    if (!responseOpen(options.res)) return;
    options.res.write(": connected\n\n");
    const initialCursor =
      replayCursor ??
      (await options.source.loadLatestSequence(options.scopedSessionId));
    if (!responseOpen(options.res)) return;
    if (replayCursor === undefined)
      await replayInitialDeletions(options, initialCursor, maxBatchSize);
    if (!responseOpen(options.res)) return;
    if (replayCursor === undefined && !options.scopedSessionId)
      await sendInitialSync(options, domain, maxBatchSize);
    return await runAgentationSsePoll(
      { ...options, maxBatchSize },
      initialCursor,
    );
  } catch (error: unknown) {
    // Headers already belong to SSE: settle here instead of the JSON handler.
    if (responseOpen(options.res)) options.res.end();
    options.onPollError?.(error);
    return;
  }
}

export async function startAgentationSse(
  options: AgentationSseOptions,
): Promise<void> {
  const domain = requestQuery(options.req, "domain");
  if (rejectInvalidScope(options, domain)) return;

  const replayCursor = lastEventSequence(options.req);
  const maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
  if (!Number.isInteger(maxBatchSize) || maxBatchSize <= 0) {
    options.res
      .status(HTTP_SERVER_ERROR)
      .json({ error: "Invalid SSE batch configuration." });
    return;
  }

  options.res.status(HTTP_OK).set({
    "content-type": "text/event-stream",
    // Proxy compression would buffer small events until the stream ends.
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });
  options.res.flushHeaders();
  const cursor = await initializeStream(
    options,
    domain,
    maxBatchSize,
    replayCursor,
  );
  if (cursor === undefined || !responseOpen(options.res)) return;
  const state = { cursor, polling: false };

  const setIntervalFn =
    options.setIntervalFn ??
    ((callback, delay) => setInterval(callback, delay));
  const clearIntervalFn =
    options.clearIntervalFn ??
    ((timer: unknown) => clearInterval(timer as never));
  connections.active += 1;
  if (options.agent) connections.agent += 1;
  const pollTimer = setIntervalFn(() => {
    if (state.polling || !responseOpen(options.res)) return;
    state.polling = true;
    void runAgentationSsePoll({ ...options, maxBatchSize }, state.cursor)
      .then((next) => {
        state.cursor = next;
      })
      .catch((error: unknown) => options.onPollError?.(error))
      .finally(() => {
        state.polling = false;
      });
  }, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
  const heartbeatTimer = setIntervalFn(() => {
    if (responseOpen(options.res)) options.res.write(": ping\n\n");
  }, options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS);
  const cleanupState = { completed: false };
  const cleanup = (): void => {
    if (cleanupState.completed) return;
    cleanupState.completed = true;
    clearIntervalFn(pollTimer);
    clearIntervalFn(heartbeatTimer);
    connections.active -= 1;
    if (options.agent) connections.agent -= 1;
  };
  options.req.on("close", cleanup);
  options.res.on("close", cleanup);
}
