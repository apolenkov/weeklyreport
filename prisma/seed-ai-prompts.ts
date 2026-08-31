import { Prisma, PrismaClient } from "@prisma/client";

import {
  aiFeaturePromptCatalog,
  REPORT_ASSISTANT_FEATURE_KEY,
} from "../apps/api/src/modules/ai-prompts/application/ai-feature-prompt-catalog.js";

const BASELINE_REVISION_ID = "a0000000-0000-4000-8000-00000000a001";

/** Ensure the AI control plane starts explicitly disabled and unconfigured. */
export async function seedAiProviderControl(
  prisma: PrismaClient,
): Promise<void> {
  await prisma.aiProviderControl.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", enabled: false },
  });
}

/**
 * Ensure the code-registered Report Assistant has one immutable active
 * baseline. The advisory lock makes concurrent seed processes
 * converge on the same feature-local revision without replacing an operator
 * or rollout-created control row.
 */
export async function seedAiPromptBaseline(
  prisma: PrismaClient,
): Promise<void> {
  const entry = aiFeaturePromptCatalog.require(REPORT_ASSISTANT_FEATURE_KEY);
  const composed = entry.compose(entry.defaultEditableInstructions);
  const lockedCoreSnapshot = Object.fromEntries(
    composed.slots.map(({ slot, lockedCore }) => [slot, lockedCore]),
  );

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${REPORT_ASSISTANT_FEATURE_KEY}, 0))`,
    );
    const existing = await transaction.aiPromptBundleRevision.findFirst({
      where: { featureKey: REPORT_ASSISTANT_FEATURE_KEY },
      select: { id: true },
    });
    if (existing) return;

    const control = await transaction.aiFeaturePromptControl.upsert({
      where: { featureKey: REPORT_ASSISTANT_FEATURE_KEY },
      update: {},
      create: {
        id: "a0000000-0000-4000-8000-00000000a002",
        featureKey: REPORT_ASSISTANT_FEATURE_KEY,
      },
    });
    const revision = await transaction.aiPromptBundleRevision.create({
      data: {
        id: BASELINE_REVISION_ID,
        featureKey: REPORT_ASSISTANT_FEATURE_KEY,
        revision: 1,
        coreContractVersion: composed.coreContractVersion,
        composerVersion: composed.composerVersion,
        servingContractVersion: composed.servingContractVersion,
        lockedCoreSnapshot,
        promptContents: entry.defaultEditableInstructions,
        effectiveContentHash: composed.contentHash,
        lifecycle: "active",
        createdBy: "seed",
        activatedAt: new Date(),
      },
      select: { id: true },
    });
    await transaction.aiFeaturePromptControl.update({
      where: { id: control.id },
      data: { activeRevisionId: revision.id },
    });
  });
}
