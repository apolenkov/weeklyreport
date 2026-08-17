import { searchReportEntriesToolInputSchema } from "@customreport/shared";
import { z } from "zod";

import { groundingPromptData } from "../domain/context-builder.js";
import type { AiComposedPromptSet } from "./ai-feature-prompt-catalog.js";
import type {
  CitationRepairInput,
  GroundedAnswer,
  GroundedAnswerInput,
  PlannerInput,
  PlannerRepairInput,
} from "./report-assistant.ports.js";
import { compactDefaultedSchema } from "./report-assistant.tool-schema.js";

export const SEARCH_REPORT_ENTRIES_TOOL_NAME = "search_report_entries";
const ACTOR_ROLE = "LEAD" as const;
const MAX_REPAIR_ISSUES = 20;
const MAX_ISSUE_PATH_LENGTH = 8;
const MAX_ISSUE_KEY_LENGTH = 80;
const PLANNER_TOOL_DESCRIPTION =
  "Translate a Lead's report question into a strict, server-resolved search plan.";

const plannerToolParameters = (): Record<string, unknown> => {
  const schema = compactDefaultedSchema(
    zodSchemaValue(searchReportEntriesToolInputSchema),
  );
  return schema as Record<string, unknown>;
};

const zodSchemaValue = (schema: typeof searchReportEntriesToolInputSchema) =>
  z.toJSONSchema(schema) as Record<string, unknown>;

const searchReportEntriesTool = {
  type: "function" as const,
  function: {
    name: SEARCH_REPORT_ENTRIES_TOOL_NAME,
    description: PLANNER_TOOL_DESCRIPTION,
    parameters: plannerToolParameters(),
  },
};

export type PlannerPrompt = Readonly<{
  version: string;
  system: string;
  data: string;
  tool: typeof searchReportEntriesTool;
  toolChoice: Readonly<{
    type: "function";
    function: Readonly<{ name: typeof SEARCH_REPORT_ENTRIES_TOOL_NAME }>;
  }>;
  parallelToolCalls: false;
}>;

type PlannerData = Readonly<{
  question: string;
  actorRole: typeof ACTOR_ROLE;
  serverDate: string;
  timezone: string;
}>;

const datePart = (
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPart["type"],
): string => {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new Error("Unable to format trusted server date");
  return value;
};

const serverDate = (now: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return [
    datePart(parts, "year"),
    datePart(parts, "month"),
    datePart(parts, "day"),
  ].join("-");
};

const plannerData = (input: PlannerInput): PlannerData => ({
  question: input.question,
  actorRole: ACTOR_ROLE,
  serverDate: serverDate(input.now, input.timeZone),
  timezone: input.timeZone,
});

const dataMessage = (data: unknown): string => JSON.stringify(data);

const plannerPrompt = (
  version: string,
  system: string,
  data: unknown,
): PlannerPrompt => ({
  version,
  system,
  data: dataMessage(data),
  tool: searchReportEntriesTool,
  toolChoice: {
    type: "function",
    function: { name: SEARCH_REPORT_ENTRIES_TOOL_NAME },
  },
  parallelToolCalls: false,
});

const allowedIssueCodes = new Set([
  "custom",
  "invalid_format",
  "invalid_type",
  "invalid_union",
  "invalid_value",
  "too_big",
  "too_small",
  "unrecognized_keys",
]);

const safeIssuePath = (
  path: readonly (string | number)[],
): readonly (string | number)[] =>
  path
    .slice(0, MAX_ISSUE_PATH_LENGTH)
    .map((part) =>
      typeof part === "number"
        ? Number.isSafeInteger(part) && part >= 0
          ? part
          : 0
        : part.slice(0, MAX_ISSUE_KEY_LENGTH),
    );

const safeRepairIssues = (
  issues: PlannerRepairInput["issues"],
): readonly Readonly<{ path: readonly (string | number)[]; code: string }>[] =>
  issues.slice(0, MAX_REPAIR_ISSUES).map((issue) => ({
    path: safeIssuePath(issue.path),
    code: allowedIssueCodes.has(issue.code) ? issue.code : "custom",
  }));

export const buildPlannerPrompt = (
  input: PlannerInput,
  promptSet: AiComposedPromptSet,
): PlannerPrompt =>
  plannerPrompt(
    promptSet.slotVersions.planner,
    promptSet.prompts.planner,
    plannerData(input),
  );

export const buildPlannerRepairPrompt = (
  input: PlannerRepairInput,
  promptSet: AiComposedPromptSet,
): PlannerPrompt => {
  const original = plannerData(input.original);
  return plannerPrompt(
    promptSet.slotVersions["planner-repair"],
    promptSet.prompts["planner-repair"],
    {
      original,
      previousArguments: input.previousArguments,
      issues: safeRepairIssues(input.issues),
    },
  );
};

export const groundedAnswerResponseSchema = z
  .object({
    answerMarkdown: z.string(),
    citedSourceIds: z.array(z.string()),
    insufficientEvidence: z.boolean(),
  })
  .strict();

export type GroundedAnswerPrompt = Readonly<{
  version: string;
  system: string;
  data: string;
}>;

const CITATION_ISSUE_CODES = new Set([
  "answer_schema_invalid",
  "citation_order_invalid",
  "missing_citation",
  "unknown_source",
]);
const MAX_CITATION_ISSUES = 8;
const SOURCE_ID_PATTERN = /^S[1-9]\d*$/u;

const uniqueSourceIds = (sourceIds: readonly string[]): readonly string[] =>
  sourceIds.filter(
    (sourceId, index) =>
      SOURCE_ID_PATTERN.test(sourceId) && sourceIds.indexOf(sourceId) === index,
  );

const safeCitationIssues = (issues: readonly string[]): readonly string[] =>
  issues
    .slice(0, MAX_CITATION_ISSUES)
    .map((issue) =>
      CITATION_ISSUE_CODES.has(issue) ? issue : "answer_schema_invalid",
    );

const answerData = (
  input: GroundedAnswerInput,
): Readonly<{
  question: string;
  grounding: ReturnType<typeof groundingPromptData>;
}> => ({
  question: input.question,
  grounding: groundingPromptData(input.grounding),
});

const groundedAnswerPrompt = (
  version: string,
  system: string,
  data: unknown,
): GroundedAnswerPrompt => ({ version, system, data: dataMessage(data) });

export const buildGroundedAnswerPrompt = (
  input: GroundedAnswerInput,
  promptSet: AiComposedPromptSet,
): GroundedAnswerPrompt =>
  groundedAnswerPrompt(
    promptSet.slotVersions["grounded-answer"],
    promptSet.prompts["grounded-answer"],
    answerData(input),
  );

const previousAnswerData = (answer: GroundedAnswer) => ({
  answerMarkdown: answer.answerMarkdown,
  citedSourceIds: uniqueSourceIds(answer.sourceIds),
  insufficientEvidence: answer.insufficientEvidence,
});

export const buildCitationRepairPrompt = (
  input: CitationRepairInput,
  promptSet: AiComposedPromptSet,
): GroundedAnswerPrompt =>
  groundedAnswerPrompt(
    promptSet.slotVersions["citation-repair"],
    promptSet.prompts["citation-repair"],
    {
      question: input.original.question,
      grounding: groundingPromptData(input.original.grounding),
      previousAnswer: previousAnswerData(input.previousAnswer),
      allowedSourceIds: uniqueSourceIds(input.allowedSourceIds),
      issues: safeCitationIssues(input.issues),
    },
  );
