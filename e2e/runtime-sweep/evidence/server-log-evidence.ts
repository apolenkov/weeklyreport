import { readFile } from "node:fs/promises";

import { z } from "zod";

import type {
  ResponseRecord,
  ServerLogEvidence,
  ServerLogRecord,
} from "./evidence-types.ts";

const appLogRecordSchema = z
  .looseObject({
    timestamp: z.iso.datetime(),
    level: z.enum(["debug", "info", "warn", "error"]),
    message: z.string().min(1),
    correlationId: z.string().min(1),
    service: z.string().min(1).optional(),
  })
  .transform(
    ({ timestamp, level, message, correlationId, service, ...rest }) =>
      ({
        timestamp,
        level,
        message,
        correlationId,
        service: service ?? null,
        context: rest,
      }) satisfies ServerLogRecord,
  );

const parseTimestamp = (value: string): number | null => {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
};

const CORRELATION_WINDOW_SKEW_MS = 1000;
const LOG_BARRIER_TIMEOUT_MS = 2000;
const LOG_BARRIER_POLL_MS = 25;

export type ParsedServerLog = Readonly<{
  readonly records: readonly ServerLogRecord[];
  readonly malformedCount: number;
}>;

export const parseServerLogText = (text: string): ParsedServerLog =>
  text.split("\n").reduce<ParsedServerLog>(
    (parsed, line) => {
      if (line.trim() === "") return parsed;
      try {
        const record = appLogRecordSchema.safeParse(JSON.parse(line));
        return record.success
          ? { ...parsed, records: [...parsed.records, record.data] }
          : { ...parsed, malformedCount: parsed.malformedCount + 1 };
      } catch {
        return { ...parsed, malformedCount: parsed.malformedCount + 1 };
      }
    },
    { records: [], malformedCount: 0 },
  );

const apiCorrelationIds = (
  responses: readonly ResponseRecord[],
): readonly string[] => [
  ...new Set(
    responses.flatMap(({ correlationId, resourceType, url }) =>
      correlationId !== null &&
      ["fetch", "xhr"].includes(resourceType) &&
      url.includes("/trpc/")
        ? [correlationId]
        : [],
    ),
  ),
];

const recordInWindow = (
  record: ServerLogRecord,
  startedAt: number,
  endedAt: number,
): boolean => {
  const timestamp = parseTimestamp(record.timestamp);
  return timestamp !== null && timestamp >= startedAt && timestamp <= endedAt;
};

const unavailable = (
  correlationIds: readonly string[],
  malformedCount = 0,
): ServerLogEvidence => ({
  available: false,
  records: [],
  malformedCount,
  correlationIds,
  missingCorrelationIds: correlationIds,
  errorCount: 0,
  warningCount: 0,
  slowCount: 0,
  workerCount: 0,
});

type CollectionInput = Readonly<{
  path: string;
  responses: readonly ResponseRecord[];
  startedAt: string;
  endedAt: string;
}>;

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const collectUntilBarrier = async (
  input: CollectionInput,
  deadline: number,
): Promise<ServerLogEvidence> => {
  const correlationIds = apiCorrelationIds(input.responses);
  const startedAt = parseTimestamp(input.startedAt);
  const endedAt = parseTimestamp(input.endedAt);
  if (startedAt === null || endedAt === null)
    return unavailable(correlationIds);
  try {
    const parsed = parseServerLogText(await readFile(input.path, "utf8"));
    if (parsed.records.length === 0) {
      if (correlationIds.length > 0 && Date.now() < deadline) {
        await sleep(LOG_BARRIER_POLL_MS);
        return await collectUntilBarrier(input, deadline);
      }
      return unavailable(correlationIds, parsed.malformedCount);
    }
    const windowStart = startedAt - CORRELATION_WINDOW_SKEW_MS;
    const windowEnd = endedAt + CORRELATION_WINDOW_SKEW_MS;
    const records = parsed.records.filter(
      (record) =>
        recordInWindow(record, windowStart, windowEnd) &&
        (correlationIds.includes(record.correlationId) ||
          record.level === "warn" ||
          record.level === "error"),
    );
    const matched = new Set(records.map(({ correlationId }) => correlationId));
    const missingCorrelationIds = correlationIds.filter(
      (id) => !matched.has(id),
    );
    if (missingCorrelationIds.length > 0 && Date.now() < deadline) {
      await sleep(LOG_BARRIER_POLL_MS);
      return await collectUntilBarrier(input, deadline);
    }
    return {
      available: true,
      records,
      malformedCount: parsed.malformedCount,
      correlationIds,
      missingCorrelationIds,
      errorCount: records.filter(({ level }) => level === "error").length,
      warningCount: records.filter(({ level }) => level === "warn").length,
      slowCount: records.filter(({ message }) =>
        message.toLowerCase().startsWith("slow "),
      ).length,
      workerCount: records.filter(({ service }) => service?.includes("worker"))
        .length,
    };
  } catch {
    return unavailable(correlationIds);
  }
};

export function collectServerLogEvidence(
  input: Readonly<{
    path: string;
    responses: readonly ResponseRecord[];
    startedAt: string;
    endedAt: string;
  }>,
): Promise<ServerLogEvidence> {
  return collectUntilBarrier(input, Date.now() + LOG_BARRIER_TIMEOUT_MS);
}
