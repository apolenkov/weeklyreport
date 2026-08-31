import type { ReportAssistantClock } from "./report-assistant.service.js";

export const createReportAssistantClock = (): ReportAssistantClock => ({
  get now(): Date {
    return new Date();
  },
});

export const resolveReportAssistantTimeZone = (): string => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timeZone.length === 0) throw new Error("Server timezone is unavailable");
  return timeZone;
};
