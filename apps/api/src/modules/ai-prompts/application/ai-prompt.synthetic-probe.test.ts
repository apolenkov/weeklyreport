import { beforeEach, describe, expect, it, vi } from "vitest";

const planner = {
  plan: vi.fn(),
  repairPlan: vi.fn(),
};
const answerer = {
  answer: vi.fn(),
  repairAnswer: vi.fn(),
};

vi.mock("../../search/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../search/index.js")>()),
  OpenAiCompatibleTransport: function OpenAiCompatibleTransport() {
    return undefined;
  },
  OpenAiCompatiblePlannerAdapter: function OpenAiCompatiblePlannerAdapter() {
    return planner;
  },
  OpenAiCompatibleAnswerAdapter: function OpenAiCompatibleAnswerAdapter() {
    return answerer;
  },
  validateGroundedAnswerCitations: vi.fn(() => ({ kind: "valid" })),
}));

import { baselineReportAssistantPrompts } from "../../search/application/ai-feature-prompt-catalog.js";
import { OpenAiCompatiblePromptSyntheticProbe } from "./ai-prompt.synthetic-probe.js";

const validPlan = {
  periods: {
    includeCurrent: true,
    published: { mode: "latest", count: 3, references: [] },
  },
  authors: { mode: "self", references: [], includeSelf: true },
  subjects: {
    parentKinds: [],
    productReferences: [],
    activityReferences: [],
    linkedActivityMode: "exclude",
  },
  stages: { references: [] },
  recordKinds: [],
  filters: {
    itemTypes: [],
    itemWorkflowStatuses: [],
    riskSeverities: [],
    decisionStates: [],
    decisionTiming: [],
    canonicalHealth: [],
    carriedOver: null,
    hasPriority: null,
    priorityRanks: [],
  },
  retrieval: {
    mode: "structured",
    semanticQuery: null,
  },
  output: {
    mode: "list",
    groupBy: [],
    requestedLimit: null,
    exhaustive: false,
  },
};

const semanticPlan = {
  ...validPlan,
  retrieval: { mode: "semantic_ranked", semanticQuery: "release readiness" },
};

const validAnswer = {
  answerMarkdown: "Synthetic answer [S1]",
  sourceIds: ["S1"],
  insufficientEvidence: false,
  usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
};

const provider = {
  profile: "mistral",
  baseUrl: "https://api.example.test/v1",
  plannerModel: "planner",
  answerModel: "answer",
  reasoningMode: "provider_default",
  reasoningCustomValue: null,
  answerProtocol: "json_schema",
  credentialCiphertext: "ciphertext",
  credentialNonce: "nonce",
  credentialTag: "tag",
  credentialKeyVersion: 1,
  credentialMaskedSuffix: "••••test",
} as never;

describe("OpenAiCompatiblePromptSyntheticProbe", () => {
  beforeEach(() => {
    planner.plan.mockResolvedValue({ invalid: true });
    planner.repairPlan.mockImplementation(
      ({ original }: { original: { question: string } }) =>
        Promise.resolve(
          original.question.includes("semantically") ? semanticPlan : validPlan,
        ),
    );
    answerer.answer.mockImplementation(
      (input: { grounding: { evidence: readonly unknown[] } }) =>
        Promise.resolve({
          ...validAnswer,
          insufficientEvidence: input.grounding.evidence.length === 0,
        }),
    );
    answerer.repairAnswer.mockResolvedValue(validAnswer);
  });

  it("accepts a planner response repaired by the production recovery path", async () => {
    const probe = new OpenAiCompatiblePromptSyntheticProbe({
      codec: { decrypt: vi.fn(() => "credential") } as never,
      timeoutMs: 1000,
      plannerMaxTokens: 1000,
      answerMaxTokens: 1000,
    });

    await expect(
      probe.evaluate({
        feature: {} as never,
        provider,
        prompts: baselineReportAssistantPrompts(),
      }),
    ).resolves.toMatchObject({ outcome: "passed" });
    expect(planner.repairPlan).toHaveBeenCalled();
    expect(planner.plan).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "List the exact current release items.",
      }),
    );
    expect(planner.plan).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "Покажи точные элементы текущего релиза.",
      }),
    );
  });

  it("runs remote synthetic checks without concurrent provider requests", async () => {
    const state = { active: 0, peak: 0 };
    const tracked = async <T>(value: T): Promise<T> => {
      state.active += 1;
      state.peak = Math.max(state.peak, state.active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      state.active -= 1;
      return value;
    };
    planner.plan.mockImplementation(({ question }: { question: string }) =>
      tracked(question.includes("semantically") ? semanticPlan : validPlan),
    );
    answerer.answer.mockImplementation(
      (input: { grounding: { evidence: readonly unknown[] } }) =>
        tracked({
          ...validAnswer,
          insufficientEvidence: input.grounding.evidence.length === 0,
        }),
    );
    answerer.repairAnswer.mockImplementation(() => tracked(validAnswer));
    const probe = new OpenAiCompatiblePromptSyntheticProbe({
      codec: { decrypt: vi.fn(() => "credential") } as never,
      timeoutMs: 1000,
      plannerMaxTokens: 1000,
      answerMaxTokens: 1000,
    });

    await expect(
      probe.evaluate({
        feature: {} as never,
        provider,
        prompts: baselineReportAssistantPrompts(),
      }),
    ).resolves.toMatchObject({ outcome: "passed" });
    expect(state.peak).toBe(1);
  });
});
