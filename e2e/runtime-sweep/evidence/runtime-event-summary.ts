import type {
  ConsoleRecord,
  PageErrorRecord,
  RequestFailureRecord,
} from "./evidence-types.ts";

export type RuntimeEventInput = Readonly<{
  readonly consoleMessages: readonly ConsoleRecord[];
  readonly pageErrors: readonly PageErrorRecord[];
  readonly requestFailures: readonly RequestFailureRecord[];
}>;

type RuntimeEventCounts = Readonly<{
  readonly consoleMessages: number;
  readonly pageErrors: number;
  readonly requestFailures: number;
}>;

export const eventCounts = (events: RuntimeEventInput): RuntimeEventCounts => ({
  consoleMessages: events.consoleMessages.length,
  pageErrors: events.pageErrors.length,
  requestFailures: events.requestFailures.length,
});

export const hasRuntimeFailures = (events: RuntimeEventInput): boolean => {
  const counts = eventCounts(events);
  return (
    counts.consoleMessages > 0 ||
    counts.pageErrors > 0 ||
    counts.requestFailures > 0
  );
};
