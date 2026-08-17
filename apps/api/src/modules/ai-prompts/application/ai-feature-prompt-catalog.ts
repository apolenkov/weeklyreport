import { createHash } from "node:crypto";

import type {
  AiFeatureKey,
  AiPromptContents,
  AiPromptSlot,
  AiPromptSlotRead,
} from "@customreport/shared";
import {
  AI_PROMPT_BUNDLE_EFFECTIVE_LIMIT,
  AI_PROMPT_SLOT_KEYS,
  aiPromptContentsSchema,
} from "@customreport/shared";

import {
  REPORT_CITATION_REPAIR_PROMPT_VERSION,
  REPORT_CITATION_REPAIR_SYSTEM_PROMPT,
  REPORT_GROUNDED_ANSWER_PROMPT_VERSION,
  REPORT_GROUNDED_ANSWER_SYSTEM_PROMPT,
  REPORT_SEARCH_PLANNER_PROMPT_VERSION,
  REPORT_SEARCH_PLANNER_REPAIR_PROMPT_VERSION,
  REPORT_SEARCH_PLANNER_REPAIR_SYSTEM_PROMPT,
  REPORT_SEARCH_PLANNER_SYSTEM_PROMPT,
} from "./ai-feature-prompt-baseline.js";

export const REPORT_ASSISTANT_FEATURE_KEY = "lead-report-assistant" as const;
const REPORT_ASSISTANT_CORE_CONTRACT_VERSION = "report-assistant/core/v1";
const REPORT_ASSISTANT_COMPOSER_VERSION = "report-assistant/composer/v2";
export const REPORT_ASSISTANT_EVALUATOR_VERSION =
  "report-assistant/evaluator/v2";

export type AiComposedPromptSet = Readonly<{
  featureKey: AiFeatureKey;
  coreContractVersion: string;
  composerVersion: string;
  contentHash: string;
  slotVersions: Readonly<Record<AiPromptSlot, string>>;
  prompts: Readonly<Record<AiPromptSlot, string>>;
  slots: readonly AiPromptSlotRead[];
}>;

export type AiFeaturePromptCatalogEntry = Readonly<{
  featureKey: AiFeatureKey;
  displayName: string;
  description: string;
  slots: readonly AiPromptSlot[];
  lockedCore: Readonly<Record<AiPromptSlot, string>>;
  defaultEditableInstructions: AiPromptContents;
  promptVersions: Readonly<Record<AiPromptSlot, string>>;
  coreContractVersion: string;
  composerVersion: string;
  evaluatorVersion: string;
  compose(editable: AiPromptContents): AiComposedPromptSet;
}>;

const slotOrder = [...AI_PROMPT_SLOT_KEYS] as AiPromptSlot[];

const promptVersions: Readonly<Record<AiPromptSlot, string>> = {
  planner: REPORT_SEARCH_PLANNER_PROMPT_VERSION,
  "planner-repair": REPORT_SEARCH_PLANNER_REPAIR_PROMPT_VERSION,
  "grounded-answer": REPORT_GROUNDED_ANSWER_PROMPT_VERSION,
  "citation-repair": REPORT_CITATION_REPAIR_PROMPT_VERSION,
};

const lockedCore: Readonly<Record<AiPromptSlot, string>> = {
  planner: REPORT_SEARCH_PLANNER_SYSTEM_PROMPT,
  "planner-repair": REPORT_SEARCH_PLANNER_REPAIR_SYSTEM_PROMPT,
  "grounded-answer": REPORT_GROUNDED_ANSWER_SYSTEM_PROMPT,
  "citation-repair": REPORT_CITATION_REPAIR_SYSTEM_PROMPT,
};

const defaultEditableInstructions: AiPromptContents = lockedCore;

const canonicalContent = (
  featureKey: AiFeatureKey,
  prompts: Readonly<Record<AiPromptSlot, string>>,
): string =>
  JSON.stringify({
    featureKey,
    slots: slotOrder.map((slot) => ({ slot, prompt: prompts[slot] })),
  });

const hashContent = (content: string): string =>
  createHash("sha256").update(content, "utf8").digest("hex");

const createEntry = (): AiFeaturePromptCatalogEntry => {
  const entry = {
    featureKey: REPORT_ASSISTANT_FEATURE_KEY,
    displayName: "Report Assistant",
    description:
      "Grounded Lead report answers using the organization-wide AI provider.",
    slots: slotOrder,
    lockedCore,
    defaultEditableInstructions,
    promptVersions,
    coreContractVersion: REPORT_ASSISTANT_CORE_CONTRACT_VERSION,
    composerVersion: REPORT_ASSISTANT_COMPOSER_VERSION,
    evaluatorVersion: REPORT_ASSISTANT_EVALUATOR_VERSION,
    compose(editable: AiPromptContents): AiComposedPromptSet {
      return composePromptSet(entry, editable, lockedCore);
    },
  } satisfies AiFeaturePromptCatalogEntry;
  return entry;
};

export const composePromptSet = (
  entry: Pick<
    AiFeaturePromptCatalogEntry,
    "featureKey" | "coreContractVersion" | "composerVersion"
  >,
  editable: AiPromptContents,
  snapshot: Readonly<Record<AiPromptSlot, string>>,
): AiComposedPromptSet => {
  const parsed = aiPromptContentsSchema.safeParse(editable);
  if (!parsed.success) throw new Error("Invalid report-assistant prompt edit");
  const prompts = parsed.data;
  const serialized = canonicalContent(entry.featureKey, prompts);
  if (serialized.length > AI_PROMPT_BUNDLE_EFFECTIVE_LIMIT) {
    throw new Error("Composed report-assistant prompts exceed the size limit");
  }
  return {
    featureKey: entry.featureKey,
    coreContractVersion: entry.coreContractVersion,
    composerVersion: entry.composerVersion,
    contentHash: hashContent(serialized),
    slotVersions: promptVersions,
    prompts,
    slots: slotOrder.map((slot) => ({
      slot,
      lockedCore: snapshot[slot],
      promptContents: parsed.data[slot],
      effectivePrompt: prompts[slot],
    })),
  };
};

export class AiFeaturePromptCatalog {
  private readonly entries: ReadonlyMap<
    AiFeatureKey,
    AiFeaturePromptCatalogEntry
  >;

  constructor(entries: readonly AiFeaturePromptCatalogEntry[]) {
    this.entries = new Map(entries.map((entry) => [entry.featureKey, entry]));
  }

  list(): readonly AiFeaturePromptCatalogEntry[] {
    return [...this.entries.values()];
  }

  get(featureKey: string): AiFeaturePromptCatalogEntry | null {
    return this.entries.get(featureKey as AiFeatureKey) ?? null;
  }

  require(featureKey: string): AiFeaturePromptCatalogEntry {
    const entry = this.get(featureKey);
    if (!entry) {
      throw new Error(`AI prompt feature is not registered: ${featureKey}`);
    }
    return entry;
  }
}

export const aiFeaturePromptCatalog = new AiFeaturePromptCatalog([
  createEntry(),
]);

export const baselineReportAssistantPrompts = (): AiComposedPromptSet =>
  aiFeaturePromptCatalog
    .require(REPORT_ASSISTANT_FEATURE_KEY)
    .compose(defaultEditableInstructions);
