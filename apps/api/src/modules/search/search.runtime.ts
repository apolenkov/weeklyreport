import type {
  ReportAssistantAnswerPort,
  ReportAssistantPlannerPort,
} from "./application/report-assistant.ports.js";

const runtimeOnlyError = (): Promise<never> =>
  Promise.reject(
    new Error("AI runtime must be resolved from the active revision"),
  );

export const runtimeOnlyPlanner = (): ReportAssistantPlannerPort => ({
  plan: runtimeOnlyError,
});

export const runtimeOnlyAnswerer = (): ReportAssistantAnswerPort => ({
  answer: runtimeOnlyError,
});
