import type {
  ConsoleRecord,
  PageErrorRecord,
  RequestFailureRecord,
  ResponseRecord,
} from "./evidence-types.ts";

const HTTP_ERROR_STATUS = 400;

export type RuntimeEventInput = Readonly<{
  readonly consoleMessages: readonly ConsoleRecord[];
  readonly pageErrors: readonly PageErrorRecord[];
  readonly requestFailures: readonly RequestFailureRecord[];
  readonly responses?: readonly ResponseRecord[];
}>;

type RuntimeEventCounts = Readonly<{
  readonly consoleMessages: number;
  readonly pageErrors: number;
  readonly requestFailures: number;
  readonly httpErrorResponses: number;
}>;

export const eventCounts = (events: RuntimeEventInput): RuntimeEventCounts => ({
  consoleMessages: events.consoleMessages.length,
  pageErrors: events.pageErrors.length,
  requestFailures: events.requestFailures.length,
  httpErrorResponses: (events.responses ?? []).filter(
    ({ status }) => status >= HTTP_ERROR_STATUS,
  ).length,
});

export const hasRuntimeFailures = (events: RuntimeEventInput): boolean => {
  const counts = eventCounts(events);
  return (
    counts.consoleMessages > 0 ||
    counts.pageErrors > 0 ||
    counts.requestFailures > 0 ||
    counts.httpErrorResponses > 0
  );
};
