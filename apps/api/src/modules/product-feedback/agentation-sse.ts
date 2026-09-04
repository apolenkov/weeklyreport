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
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
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

function send(res: Response, event: AgentationSseEvent): void {
  const id = sequence(event.sequence).toString();
  const payload = { ...event, sequence: Number(sequence(event.sequence)) };
  res.write(
    `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(payload)}\n\n`,
  );
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
    const sessionId = pendingSessionId(payload, options.scopedSessionId);
    send(options.res, {
      type: "annotation.created",
      ...(sessionId ? { sessionId } : {}),
      timestamp: new Date().toISOString(),
      sequence: ZERO_SEQUENCE,
      payload,
    });
  }
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

export async function runAgentationSsePoll(
  options: AgentationSseOptions,
  cursor: bigint,
): Promise<bigint> {
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
    send(options.res, event);
    state.next = eventSequence;
  }
  return state.next;
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
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  options.res.flushHeaders();
  const initialCursor =
    replayCursor ??
    (await options.source.loadLatestSequence(options.scopedSessionId));
  if (replayCursor === undefined && !options.scopedSessionId)
    await sendInitialSync(options, domain, maxBatchSize);
  const state = {
    cursor: await runAgentationSsePoll(
      { ...options, maxBatchSize },
      initialCursor,
    ),
    polling: false,
  };

  const setIntervalFn =
    options.setIntervalFn ??
    ((callback, delay) => setInterval(callback, delay));
  const clearIntervalFn =
    options.clearIntervalFn ??
    ((timer: unknown) => clearInterval(timer as never));
  connections.active += 1;
  if (options.agent) connections.agent += 1;
  const pollTimer = setIntervalFn(() => {
    if (state.polling || options.res.writableEnded) return;
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
    if (!options.res.writableEnded) options.res.write(": ping\n\n");
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
