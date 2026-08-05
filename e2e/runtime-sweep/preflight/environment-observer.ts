import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { AiDriverReport } from "../driver/driver-results-contract.ts";
import {
  correlateEnvironmentFeedback,
  type EnvironmentChannelInput,
  type EnvironmentEvent,
  type EnvironmentFeedback,
  type EnvironmentFeedbackDocument,
} from "./environment-feedback.ts";
import {
  type LokiProbeConfig,
  probeBugsinkChannel,
  probeLokiChannel,
} from "./environment-observer-probes.ts";

export type { LokiProbeConfig } from "./environment-observer-probes.ts";

const LOG_LEVELS = new Set(["error", "warn"]);
const NETWORK_KIND = "network" as const;
const SERVER_KIND = "server" as const;
const MAX_MESSAGE_LENGTH = 500;
const apiLogRecordSchema = z.record(z.string(), z.unknown());

export interface EnvironmentObserverInput {
  readonly report: AiDriverReport;
  readonly transcripts: readonly string[];
  readonly apiLogPath?: string;
  readonly bugsinkDsn?: string;
  readonly loki?: LokiProbeConfig;
  readonly fetcher?: typeof fetch;
}

export type EnvironmentObserverConfig = Omit<
  EnvironmentObserverInput,
  "report" | "transcripts" | "fetcher"
>;

const envValue = (name: string): string | undefined =>
  process.env[name]?.trim();

export function readEnvironmentObserverConfig(
  repoRoot: string,
): EnvironmentObserverConfig {
  const apiLogPath = envValue("RUNTIME_SWEEP_API_LOG");
  const bugsinkDsn = envValue("RUNTIME_SWEEP_BUGSINK_DSN");
  const pushUrl = envValue("RUNTIME_SWEEP_LOKI_PUSH_URL");
  const queryUrl = envValue("RUNTIME_SWEEP_LOKI_QUERY_URL");
  const username = envValue("RUNTIME_SWEEP_LOKI_USERNAME");
  const password = process.env.RUNTIME_SWEEP_LOKI_PASSWORD;
  return {
    ...(apiLogPath ? { apiLogPath: path.resolve(repoRoot, apiLogPath) } : {}),
    ...(bugsinkDsn ? { bugsinkDsn } : {}),
    loki: {
      ...(pushUrl ? { pushUrl } : {}),
      ...(queryUrl ? { queryUrl } : {}),
      ...(username ? { username } : {}),
      ...(password ? { password } : {}),
    },
  };
}

const blindChannel = (
  channel: EnvironmentChannelInput["channel"],
): EnvironmentChannelInput => ({
  channel,
  reachable: false,
  hasStreams: false,
  events: [],
});

const routeByCell = (report: AiDriverReport): ReadonlyMap<string, string> =>
  new Map(
    report.assignedCells.map((cell) => [cell.cellId, cell.resolvedRoute]),
  );

const candidateKind = (
  kind: AiDriverReport["candidates"][number]["kind"],
): EnvironmentEvent["kind"] | null => {
  switch (kind) {
    case "console":
      return "console";
    case "network":
      return NETWORK_KIND;
    default:
      return null;
  }
};

const driverEvents = (
  report: AiDriverReport,
  kind: EnvironmentEvent["kind"],
): readonly EnvironmentEvent[] => {
  const routes = routeByCell(report);
  return report.candidates.flatMap((candidate) => {
    if (candidateKind(candidate.kind) !== kind) return [];
    return [
      {
        eventId: `driver-${candidate.candidateId}`,
        timestamp: report.timeline.endedAt,
        kind,
        message: redact(candidate.summary),
        evidenceRefs: candidate.evidenceRefs,
        route: routes.get(candidate.cellId),
        cellId: candidate.cellId,
      },
    ];
  });
};

const driverChannel = (
  report: AiDriverReport,
  transcripts: readonly string[],
  channel: EnvironmentChannelInput["channel"],
  kind: EnvironmentEvent["kind"],
  toolName: "browser_console_messages" | "browser_network_requests",
): EnvironmentChannelInput => {
  const events = driverEvents(report, kind);
  const toolPattern = new RegExp(
    `"(?:tool|tool_name)":"(?:playwright_)?${toolName}"`,
    "u",
  );
  const observed = transcripts.some((transcript) =>
    transcript.split("\n").some((line) => {
      try {
        return toolPattern.test(JSON.stringify(JSON.parse(line) as unknown));
      } catch {
        return false;
      }
    }),
  );
  const stream =
    kind === "console"
      ? observed && report.canary.injected && report.canary.detected
      : observed;
  return {
    channel,
    reachable: stream,
    hasStreams: stream,
    events,
  };
};

const redact = (message: string): string =>
  message
    .replaceAll(
      /((?:authorization|password|secret|token|dsn)\s*[:=]\s*)[^\s,;]+/giu,
      "$1[REDACTED]",
    )
    .slice(0, MAX_MESSAGE_LENGTH);

const parseTimestamp = (value: unknown): number | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const millis = Date.parse(String(value));
  return Number.isFinite(millis) ? millis : null;
};

const apiLogChannel = async (
  report: AiDriverReport,
  apiLogPath: string | undefined,
): Promise<EnvironmentChannelInput> => {
  if (!apiLogPath) return blindChannel("app-log");
  try {
    const text = await readFile(apiLogPath, "utf8");
    const start = parseTimestamp(report.timeline.startedAt);
    const end = parseTimestamp(report.timeline.endedAt);
    if (start === null || end === null) return blindChannel("app-log");
    const events = text.split("\n").flatMap((line, index) => {
      try {
        const value: unknown = JSON.parse(line);
        if (!value || typeof value !== "object") return [];
        const parsedRecord = apiLogRecordSchema.safeParse(value);
        if (!parsedRecord.success) return [];
        const record = parsedRecord.data;
        const level = typeof record.level === "string" ? record.level : "";
        const timestamp = parseTimestamp(record.timestamp ?? record.time);
        if (
          !LOG_LEVELS.has(level) ||
          timestamp === null ||
          timestamp < start ||
          timestamp > end
        )
          return [];
        const message = record.msg ?? record.message;
        return [
          {
            eventId: `api-log-${index}`,
            timestamp: new Date(timestamp).toISOString(),
            kind: SERVER_KIND,
            message: redact(
              typeof message === "string" ? message : JSON.stringify(message),
            ),
            evidenceRefs: [`api-log:${index + 1}`],
          },
        ];
      } catch {
        return [];
      }
    });
    return { channel: "app-log", reachable: true, hasStreams: true, events };
  } catch {
    return blindChannel("app-log");
  }
};

export async function observeEnvironmentFeedback(
  input: EnvironmentObserverInput,
): Promise<EnvironmentFeedback> {
  const fetcher = input.fetcher ?? fetch;
  const document: EnvironmentFeedbackDocument = {
    canary: input.report.canary,
    channels: await Promise.all([
      driverChannel(
        input.report,
        input.transcripts,
        "browser-console",
        "console",
        "browser_console_messages",
      ),
      driverChannel(
        input.report,
        input.transcripts,
        NETWORK_KIND,
        NETWORK_KIND,
        "browser_network_requests",
      ),
      apiLogChannel(input.report, input.apiLogPath),
      probeBugsinkChannel(input.bugsinkDsn, input.report, fetcher),
      probeLokiChannel(input.loki, input.report, fetcher),
    ]),
  };
  return correlateEnvironmentFeedback({
    timeline: input.report.timeline,
    document,
  });
}
