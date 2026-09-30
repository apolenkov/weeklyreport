import type {
  ReportAssistantAnswerPort,
  ReportAssistantCitationRepairPort,
  ReportAssistantPlannerPort,
  ReportAssistantPlannerRepairPort,
} from "./application/report-assistant.ports.js";

const runtimeOnlyError = (): Promise<never> =>
  Promise.reject(
    new Error("AI runtime must be resolved from the active revision"),
  );

export const runtimeOnlyPlannerWithRepair = (): ReportAssistantPlannerPort &
  ReportAssistantPlannerRepairPort => ({
  plan: runtimeOnlyError,
  repairPlan: runtimeOnlyError,
});

export const runtimeOnlyAnswererWithRepair = (): ReportAssistantAnswerPort &
  ReportAssistantCitationRepairPort => ({
  answer: runtimeOnlyError,
  repairAnswer: runtimeOnlyError,
});
