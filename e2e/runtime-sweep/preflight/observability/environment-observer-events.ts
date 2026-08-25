import type { AiDriverReport } from "../../driver/driver-results-contract.ts";
import type { TranscriptToolRecord } from "../../driver/driver-results-transcript.ts";
import type {
  EnvironmentChannelInput,
  EnvironmentEvent,
} from "./environment-feedback.ts";

const NETWORK_KIND = "network" as const;
const MAX_MESSAGE_LENGTH = 500;
const REDACTED = "[REDACTED]";
const SECRET_KEY_PATTERN =
  "(?:authorization|access[_-]?token|auth[_-]?token|api[_-]?key|apikey|password|secret|token|dsn)";
const quotedSecretPattern = new RegExp(
  String.raw`((?:"?)${SECRET_KEY_PATTERN}(?:"?)\s*[:=]\s*)(["'])(?:(?!\2)[^\\]|\\.)*\2`,
  "giu",
);
const unquotedSecretPattern = new RegExp(
  String.raw`((?:"?)${SECRET_KEY_PATTERN}(?:"?)\s*[:=]\s*)(?!["'])[^\s,;}]+`,
  "giu",
);
const authorizationHeaderPattern = new RegExp(
  String.raw`((?:authorization|proxy-authorization)\s*[:=]\s*)[^\r\n,;}]+`,
  "giu",
);

export const parseTimestamp = (value: unknown): number | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const millis = Date.parse(String(value));
  return Number.isFinite(millis) ? millis : null;
};

export const redact = (message: string): string =>
  message
    .replaceAll(authorizationHeaderPattern, `$1${REDACTED}`)
    .replaceAll(/((?:cookie|set-cookie)\s*[:=]\s*)[^\r\n]+/giu, `$1${REDACTED}`)
    .replaceAll(
      /((?:https?|postgres(?:ql)?):\/\/)[^/\s@]+@/giu,
      `$1${REDACTED}@`,
    )
    .replaceAll(
      /([?&](?:access[_-]?token|auth[_-]?token|api[_-]?key|apikey|token|secret|password|dsn)=)[^&#\s]+/giu,
      `$1${REDACTED}`,
    )
    .replaceAll(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu,
      REDACTED,
    )
    .replaceAll(quotedSecretPattern, `$1$2${REDACTED}$2`)
    .replaceAll(unquotedSecretPattern, `$1${REDACTED}`)
    .slice(0, MAX_MESSAGE_LENGTH);

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

const routeVisitFor = (
  report: AiDriverReport,
  cellId: string,
): Readonly<{ readonly route: string; readonly timestamp: string }> | null => {
  const cell = report.assignedCells.find(({ cellId: id }) => id === cellId);
  if (!cell) return null;
  const aliases = new Set([cell.catalogRoute, cell.resolvedRoute]);
  const visits = report.timeline.routes.filter(({ route }) =>
    aliases.has(route),
  );
  if (visits.length !== 1) return null;
  const visit = visits[0];
  const enteredAt = visit ? parseTimestamp(visit.enteredAt) : null;
  const leftAt = visit ? parseTimestamp(visit.leftAt) : null;
  if (!visit || enteredAt === null || leftAt === null || enteredAt > leftAt)
    return null;
  return { route: visit.route, timestamp: visit.leftAt };
};

const driverEvents = (
  report: AiDriverReport,
  kind: EnvironmentEvent["kind"],
  transcriptEvidenceRef: string | undefined,
): readonly EnvironmentEvent[] =>
  report.candidates.flatMap((candidate) => {
    if (candidateKind(candidate.kind) !== kind) return [];
    const visit = routeVisitFor(report, candidate.cellId);
    if (!visit)
      throw new Error(
        `driver candidate ${candidate.candidateId} has no unique route visit`,
      );
    return [
      {
        eventId: `driver-${candidate.candidateId}`,
        timestamp: visit.timestamp,
        kind,
        message: redact(candidate.summary),
        evidenceRefs: [
          ...new Set([
            ...candidate.evidenceRefs,
            ...(transcriptEvidenceRef ? [transcriptEvidenceRef] : []),
          ]),
        ],
        route: visit.route,
        cellId: candidate.cellId,
      },
    ];
  });

export const driverChannel = (
  report: AiDriverReport,
  channel: EnvironmentChannelInput["channel"],
  kind: EnvironmentEvent["kind"],
  toolName: "browser_console_messages" | "browser_network_requests",
  transcriptRecords: readonly TranscriptToolRecord[],
  transcriptEvidenceRef: string | undefined,
): EnvironmentChannelInput => {
  const events = driverEvents(report, kind, transcriptEvidenceRef);
  const observed = transcriptRecords.some(({ tool }) => tool === toolName);
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
