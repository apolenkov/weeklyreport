import { readFile } from "node:fs/promises";

import { z } from "zod";

import type { AiDriverReport } from "../../driver/driver-results-contract.ts";
import type { EnvironmentChannelInput } from "./environment-feedback.ts";
import { parseTimestamp, redact } from "./environment-observer-events.ts";

const LOG_LEVELS = new Set(["error", "warn"]);
const SERVER_KIND = "server" as const;
const apiLogRecordSchema = z.looseObject({
  timestamp: z.iso.datetime(),
  level: z.enum(["debug", "info", "warn", "error"]),
  message: z.string().min(1),
  correlationId: z.string().min(1),
});

const blind = (): EnvironmentChannelInput => ({
  channel: "app-log",
  reachable: false,
  hasStreams: false,
  events: [],
});

export const apiLogChannel = async (
  report: AiDriverReport,
  apiLogPath: string | undefined,
  apiLogText: string | undefined,
  apiLogEvidenceRef: string | undefined,
): Promise<EnvironmentChannelInput> => {
  if (!apiLogPath && apiLogText === undefined) return blind();
  try {
    const text =
      apiLogText ?? (apiLogPath ? await readFile(apiLogPath, "utf8") : "");
    const start = parseTimestamp(report.timeline.startedAt);
    const end = parseTimestamp(report.timeline.endedAt);
    if (start === null || end === null) return blind();
    const records = text.split("\n").flatMap((line, index) => {
      try {
        const parsedRecord = apiLogRecordSchema.safeParse(JSON.parse(line));
        if (!parsedRecord.success) return [];
        const record = parsedRecord.data;
        const timestamp = parseTimestamp(record.timestamp);
        if (timestamp === null || timestamp < start || timestamp > end)
          return [];
        return [{ index, record, timestamp }];
      } catch {
        return [];
      }
    });
    if (records.length > 0 && !apiLogEvidenceRef) return blind();
    const events = apiLogEvidenceRef
      ? records.flatMap(({ index, record, timestamp }) => {
          if (!LOG_LEVELS.has(record.level)) return [];
          return [
            {
              eventId: `api-log-${index}`,
              timestamp: new Date(timestamp).toISOString(),
              kind: SERVER_KIND,
              message: redact(record.message),
              evidenceRefs: [`${apiLogEvidenceRef}:line=${index + 1}`],
            },
          ];
        })
      : [];
    return {
      channel: "app-log",
      reachable: true,
      hasStreams: records.length > 0,
      events,
    };
  } catch {
    return blind();
  }
};
