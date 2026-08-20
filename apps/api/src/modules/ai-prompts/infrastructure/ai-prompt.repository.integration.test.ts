import { AiPromptBundleLifecycle } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper.js";
import {
  aiFeaturePromptCatalog,
  baselineReportAssistantPrompts,
} from "../../search/application/ai-feature-prompt-catalog.js";
import { AiPromptRepository } from "./ai-prompt.repository.js";

const prisma = createTestPrisma();
const repository = new AiPromptRepository(prisma as unknown as PrismaService);
const featureKey = "lead-report-assistant" as const;
const now = new Date("2026-08-11T00:00:00.000Z");

const baseline = baselineReportAssistantPrompts();
const lockedCoreSnapshot = Object.fromEntries(
  baseline.slots.map(({ slot, lockedCore }) => [slot, lockedCore]),
);

const bootstrap = async () =>
  repository.bootstrap({
    featureKey,
    coreContractVersion: baseline.coreContractVersion,
    composerVersion: baseline.composerVersion,
    servingContractVersion: baseline.servingContractVersion,
    lockedCoreSnapshot: lockedCoreSnapshot,
    promptContents: baseline.slots.reduce(
      (instructions, slot) => ({
        ...instructions,
        [slot.slot]: slot.promptContents,
      }),
      {},
    ),
    effectiveContentHash: baseline.contentHash,
    createdBy: "seed",
  });

const createDraft = async (baseRevisionId: string, suffix: string) => {
  const entry = aiFeaturePromptCatalog.require(featureKey);
  const editable = {
    ...entry.defaultEditableInstructions,
    planner: `${entry.defaultEditableInstructions.planner} ${suffix}`,
  };
  const composed = entry.compose(editable);
  return repository.createDraft({
    featureKey,
    baseRevisionId,
    coreContractVersion: composed.coreContractVersion,
    composerVersion: composed.composerVersion,
    servingContractVersion: composed.servingContractVersion,
    lockedCoreSnapshot: lockedCoreSnapshot,
    promptContents: editable,
    effectiveContentHash: composed.contentHash,
    createdBy: "admin-1",
  });
};

describe("AI prompt control-plane database states", () => {
  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("bootstraps idempotently and allocates concurrent feature-local revisions", async () => {
    const first = await bootstrap();
    const second = await bootstrap();

    if (!first) throw new Error("Prompt baseline was not created");
    expect(typeof first.id).toBe("string");
    expect(first).toMatchObject({
      lifecycle: AiPromptBundleLifecycle.active,
      revision: 1,
    });
    expect(second).toBeNull();

    const drafts = await Promise.all([
      createDraft(first.id, "candidate-a"),
      createDraft(first.id, "candidate-b"),
    ]);
    expect(drafts.map(({ revision }) => revision).sort()).toEqual([2, 3]);
    await expect(
      prisma.aiFeaturePromptControl.findUnique({ where: { featureKey } }),
    ).resolves.toMatchObject({ activeRevisionId: first.id });
  });

  it("creates an idempotent current-serving handoff draft without moving the active pointer", async () => {
    const input = {
      featureKey,
      servingContractVersion: baseline.servingContractVersion,
      coreContractVersion: baseline.coreContractVersion,
      composerVersion: baseline.composerVersion,
      lockedCoreSnapshot,
      promptContents: baseline.slots.reduce(
        (instructions, slot) => ({
          ...instructions,
          [slot.slot]: slot.promptContents,
        }),
        {},
      ),
      effectiveContentHash: baseline.contentHash,
      createdBy: "handoff",
    };
    const first = await repository.handoff(input);
    const second = await repository.handoff(input);

    expect(first).toMatchObject({
      created: true,
      revision: { lifecycle: AiPromptBundleLifecycle.draft, revision: 1 },
    });
    expect(second).toMatchObject({
      created: false,
      revision: {
        id: first.revision.id,
        lifecycle: AiPromptBundleLifecycle.draft,
      },
    });
    await expect(
      prisma.aiFeaturePromptControl.findUnique({ where: { featureKey } }),
    ).resolves.toMatchObject({ activeRevisionId: null });
  });

  it("activates current prompt text and preserves history on discard", async () => {
    const active = await bootstrap();
    if (!active) throw new Error("Prompt baseline was not created");
    const candidate = await createDraft(active.id, "candidate");
    await repository.transition(
      featureKey,
      candidate.id,
      [AiPromptBundleLifecycle.draft],
      AiPromptBundleLifecycle.validated,
    );

    await expect(
      repository.activate(
        featureKey,
        candidate.id,
        [AiPromptBundleLifecycle.validated],
        now,
        {
          servingContractVersion:
            candidate.servingContractVersion ?? baseline.servingContractVersion,
        },
      ),
    ).resolves.toBe(true);
    await expect(
      prisma.aiFeaturePromptControl.findUnique({ where: { featureKey } }),
    ).resolves.toMatchObject({ activeRevisionId: candidate.id });
    await expect(
      prisma.aiPromptBundleRevision.findUnique({
        where: { id: active.id },
        select: { lifecycle: true },
      }),
    ).resolves.toEqual({ lifecycle: AiPromptBundleLifecycle.superseded });

    const disposable = await createDraft(candidate.id, "discard-me");
    await expect(
      repository.discardDisposable(featureKey, disposable.id),
    ).resolves.toBe(true);
    await expect(
      prisma.aiPromptBundleRevision.findUnique({
        where: { id: disposable.id },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.aiFeaturePromptControl.findUnique({ where: { featureKey } }),
    ).resolves.toMatchObject({ activeRevisionId: candidate.id });
  });
});
