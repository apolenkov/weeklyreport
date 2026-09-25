import { createHash } from "node:crypto";

import type {
  AiFeatureKey,
  AiPromptContents,
  AiPromptSlot,
  AiPromptSlotRead,
} from "@customreport/shared";
import {
  AI_PROMPT_BUNDLE_EFFECTIVE_LIMIT,
  AI_PROMPT_EDITABLE_TAIL_SEPARATOR,
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
export const REPORT_ASSISTANT_SERVING_CONTRACT_VERSION =
  "report-assistant/editor-serving/v1";

export type AiComposedPromptSet = Readonly<{
  featureKey: AiFeatureKey;
  coreContractVersion: string;
  composerVersion: string;
  servingContractVersion: string;
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
  servingContractVersion: string;
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

const defaultEditableInstructions: AiPromptContents = {
  planner:
    "Keep the generated search plan minimal and preserve every explicit user constraint.",
  "planner-repair":
    "Repair only the fields identified by validation and preserve the user's intent.",
  "grounded-answer": "Keep the answer concise, direct, and useful to the Lead.",
  "citation-repair":
    "Keep supported claims unchanged while repairing only citation formatting.",
};

const canonicalContent = (
  featureKey: AiFeatureKey,
  slots: readonly AiPromptSlot[],
  prompts: Readonly<Record<AiPromptSlot, string>>,
): string =>
  JSON.stringify({
    featureKey,
    slots: slots.map((slot) => ({ slot, prompt: prompts[slot] })),
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
    servingContractVersion: REPORT_ASSISTANT_SERVING_CONTRACT_VERSION,
    compose(editable: AiPromptContents): AiComposedPromptSet {
      return composePromptSet(entry, editable, lockedCore);
    },
  } satisfies AiFeaturePromptCatalogEntry;
  return entry;
};

export const composePromptSet = (
  entry: Pick<
    AiFeaturePromptCatalogEntry,
    | "featureKey"
    | "slots"
    | "lockedCore"
    | "promptVersions"
    | "coreContractVersion"
    | "composerVersion"
    | "servingContractVersion"
  >,
  editable: AiPromptContents,
  snapshot: Readonly<Record<AiPromptSlot, string>>,
): AiComposedPromptSet => {
  const parsed = aiPromptContentsSchema.safeParse(editable);
  if (!parsed.success) throw new Error("Invalid report-assistant prompt edit");
  const promptContents = parsed.data;
  const effectivePrompts = Object.fromEntries(
    entry.slots.map((slot) => {
      const core = snapshot[slot];
      if (!core || core !== entry.lockedCore[slot]) {
        throw new Error("Invalid report-assistant locked core snapshot");
      }
      return [
        slot,
        `${core}${AI_PROMPT_EDITABLE_TAIL_SEPARATOR}${promptContents[slot]}`,
      ];
    }),
  ) as Readonly<Record<AiPromptSlot, string>>;
  const serialized = canonicalContent(
    entry.featureKey,
    entry.slots,
    effectivePrompts,
  );
  if (serialized.length > AI_PROMPT_BUNDLE_EFFECTIVE_LIMIT) {
    throw new Error("Composed report-assistant prompts exceed the size limit");
  }
  return {
    featureKey: entry.featureKey,
    coreContractVersion: entry.coreContractVersion,
    composerVersion: entry.composerVersion,
    servingContractVersion: entry.servingContractVersion,
    contentHash: hashContent(serialized),
    slotVersions: entry.promptVersions,
    prompts: effectivePrompts,
    slots: entry.slots.map((slot) => ({
      slot,
      lockedCore: snapshot[slot],
      promptContents: promptContents[slot],
      effectivePrompt: effectivePrompts[slot],
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
