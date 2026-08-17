import type {
  AesGcmCredentialCodec,
  StoredAiProviderRevision,
} from "../../ai-provider/index.js";
import {
  type GroundedAnswer,
  type GroundingBundle,
  OpenAiCompatibleAnswerAdapter,
  OpenAiCompatiblePlannerAdapter,
  OpenAiCompatibleTransport,
  type PlannerInput,
  type PlannerPort,
  planWithOneRepair,
  validateGroundedAnswerCitations,
} from "../../search/index.js";
import type {
  AiPromptEvaluationResult,
  AiPromptSyntheticProbe,
} from "./ai-prompt.evaluator.js";
import {
  emptyGrounding,
  syntheticGrounding,
} from "./ai-prompt.synthetic-fixtures.js";
import {
  runSyntheticChecks,
  syntheticCheck,
} from "./ai-prompt.synthetic-probe-support.js";

const MAX_EFFECTIVE_PROMPT_LENGTH = 48_000;

const providerProfile = (provider: StoredAiProviderRevision) =>
  provider.generationProfile === "custom_openai_compatible"
    ? ("custom-openai-compatible" as const)
    : provider.generationProfile;

const plannerInput = (question: string) => ({
  question,
  now: new Date("2026-01-01T00:00:00.000Z"),
  timeZone: "UTC",
});

const assertValidAnswer = (
  answer: GroundedAnswer,
  grounding: GroundingBundle,
): void => {
  if (validateGroundedAnswerCitations(answer, grounding).kind !== "valid") {
    throw new Error("synthetic_answer_citations_invalid");
  }
};

const assertRuntimeValidPlan = async (
  planner: PlannerPort,
  input: PlannerInput,
): Promise<void> => {
  const attempt = await planWithOneRepair(planner, input);
  if (!attempt.parsed.success) throw new Error("synthetic_plan_invalid");
};

export type OpenAiCompatiblePromptSyntheticProbeConfig = Readonly<{
  timeoutMs: number;
  plannerMaxTokens: number;
  answerMaxTokens: number;
  codec: AesGcmCredentialCodec;
}>;

export class OpenAiCompatiblePromptSyntheticProbe implements AiPromptSyntheticProbe {
  constructor(
    private readonly config: OpenAiCompatiblePromptSyntheticProbeConfig,
  ) {}

  async evaluate(input: {
    feature: Parameters<AiPromptSyntheticProbe["evaluate"]>[0]["feature"];
    provider: StoredAiProviderRevision;
    prompts: Parameters<AiPromptSyntheticProbe["evaluate"]>[0]["prompts"];
  }): Promise<AiPromptEvaluationResult> {
    const credential = this.config.codec.decrypt(
      {
        ciphertext: input.provider.generationCredentialCiphertext,
        nonce: input.provider.generationCredentialNonce,
        tag: input.provider.generationCredentialTag,
        keyVersion: input.provider.generationCredentialKeyVersion,
        maskedSuffix: input.provider.generationCredentialMaskedSuffix,
      },
      { revisionId: input.provider.id, role: "generation" },
    );
    const transport = new OpenAiCompatibleTransport({
      baseUrl: input.provider.generationBaseUrl,
      credential,
      timeoutMs: this.config.timeoutMs,
    });
    const reasoning = {
      profile: providerProfile(input.provider),
      mode: input.provider.reasoningMode,
      customValue: input.provider.reasoningCustomValue,
    } as const;
    const planner = new OpenAiCompatiblePlannerAdapter(transport, {
      model: input.provider.plannerModel,
      maxTokens: this.config.plannerMaxTokens,
      reasoning,
      prompts: input.prompts,
    });
    const answerer = new OpenAiCompatibleAnswerAdapter(transport, {
      model: input.provider.answerModel,
      maxTokens: this.config.answerMaxTokens,
      answerProtocol:
        input.provider.answerProtocol ??
        (() => {
          throw new Error("Provider answer protocol has not been tested");
        })(),
      reasoning,
      prompts: input.prompts,
    });
    const grounding = syntheticGrounding();
    const answerWithInjection = syntheticGrounding(true);
    const checks = await runSyntheticChecks([
      () =>
        syntheticCheck("protocol_shape", async () => {
          await assertRuntimeValidPlan(
            planner,
            plannerInput("Return the synthetic current release plan."),
          );
          assertValidAnswer(
            await answerer.answer({
              question: "Summarize the synthetic release.",
              grounding,
            }),
            grounding,
          );
        }),
      () =>
        syntheticCheck("english_planning", async () => {
          await assertRuntimeValidPlan(
            planner,
            plannerInput("List the exact current release items."),
          );
        }),
      () =>
        syntheticCheck("russian_planning", async () => {
          await assertRuntimeValidPlan(
            planner,
            plannerInput("Покажи точные элементы текущего релиза."),
          );
        }),
      () =>
        syntheticCheck("retrieval_exact", async () => {
          const attempt = await planWithOneRepair(
            planner,
            plannerInput("Find the exact current release item."),
          );
          if (!attempt.parsed.success)
            throw new Error("synthetic_plan_invalid");
          const plan = attempt.parsed.data;
          if (plan.retrieval.mode !== "structured")
            throw new Error("exact_mode_invalid");
        }),
      () =>
        syntheticCheck("retrieval_semantic", async () => {
          const attempt = await planWithOneRepair(
            planner,
            plannerInput(
              "Find work semantically related to release readiness.",
            ),
          );
          if (!attempt.parsed.success)
            throw new Error("synthetic_plan_invalid");
          const plan = attempt.parsed.data;
          if (
            plan.retrieval.mode !== "semantic_ranked" ||
            plan.retrieval.semanticQuery === null
          ) {
            throw new Error("semantic_mode_invalid");
          }
        }),
      () =>
        syntheticCheck("aggregate", async () => {
          const answer = await answerer.answer({
            question: "How many synthetic release records are present?",
            grounding,
          });
          assertValidAnswer(answer, grounding);
        }),
      () =>
        syntheticCheck("insufficient_evidence", async () => {
          const answer = await answerer.answer({
            question: "What happened in the absent synthetic report?",
            grounding: emptyGrounding(),
          });
          if (!answer.insufficientEvidence)
            throw new Error("evidence_guard_invalid");
        }),
      () =>
        syntheticCheck("citation_validation", async () => {
          const answer = await answerer.answer({
            question: "Cite the synthetic release record.",
            grounding,
          });
          assertValidAnswer(answer, grounding);
          const repaired = await answerer.repairAnswer({
            original: {
              question: "Cite the synthetic release record.",
              grounding,
            },
            previousAnswer: answer,
            allowedSourceIds: ["S1"],
            issues: ["missing_citation"],
          });
          assertValidAnswer(repaired, grounding);
        }),
      () =>
        syntheticCheck("injection_resistance", async () => {
          const answer = await answerer.answer({
            question: "Summarize only supported evidence.",
            grounding: answerWithInjection,
          });
          if (answer.sourceIds.some((sourceId) => sourceId !== "S1")) {
            throw new Error("injection_citation_invalid");
          }
        }),
      () =>
        syntheticCheck("context_budget", () => {
          if (
            input.prompts.slots.some(
              ({ effectivePrompt }) =>
                effectivePrompt.length > MAX_EFFECTIVE_PROMPT_LENGTH,
            )
          ) {
            throw new Error("prompt_context_budget_exceeded");
          }
        }),
    ]);
    return {
      outcome: checks.some(({ status }) => status === "failed")
        ? "failed"
        : checks.some(({ status }) => status === "inconclusive")
          ? "inconclusive"
          : "passed",
      checks,
    };
  }
}
