import { AiPromptBundleLifecycle, type Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper.js";
import { AiProviderConfigurationRepository } from "../../ai-provider/infrastructure/ai-provider.repository.js";
import {
  aiFeaturePromptCatalog,
  baselineReportAssistantPrompts,
} from "../application/ai-feature-prompt-catalog.js";
import { AiPromptService } from "../application/ai-prompt.service.js";
import { AiPromptRepository } from "./ai-prompt.repository.js";

const prisma = createTestPrisma();
const repository = new AiPromptRepository(prisma as unknown as PrismaService);
const featureKey = "lead-report-assistant" as const;
const now = new Date("2026-08-11T00:00:00.000Z");

const baseline = baselineReportAssistantPrompts();
const lockedCoreSnapshot = Object.fromEntries(
  baseline.slots.map(({ slot, lockedCore }) => [slot, lockedCore]),
);

const createActiveBaseline = async () => {
  const id = "a0000000-0000-4000-8000-00000000b001";
  const revision = await prisma.aiPromptBundleRevision.create({
    data: {
      id,
      featureKey,
      revision: 1,
      coreContractVersion: baseline.coreContractVersion,
      composerVersion: baseline.composerVersion,
      servingContractVersion: baseline.servingContractVersion,
      lockedCoreSnapshot,
      promptContents:
        aiFeaturePromptCatalog.require(featureKey).defaultEditableInstructions,
      effectiveContentHash: baseline.contentHash,
      lifecycle: AiPromptBundleLifecycle.active,
      createdBy: "test",
      activatedAt: now,
    },
  });
  await prisma.aiFeaturePromptControl.create({
    data: {
      id: "a0000000-0000-4000-8000-00000000b002",
      featureKey,
      activeRevisionId: revision.id,
    },
  });
  return revision;
};

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

const withinBarrierTimeout = async <T>(pending: Promise<T>): Promise<T> => {
  const timeout = Promise.withResolvers<never>();
  const timer = setTimeout(() => {
    timeout.reject(new Error("Prompt read barrier timed out"));
  }, 2000);
  try {
    return await Promise.race([pending, timeout.promise]);
  } finally {
    clearTimeout(timer);
  }
};

const observePromptReads = <T extends Prisma.TransactionClient>(
  client: T,
  afterControlRead: () => Promise<void>,
  afterHistoryRead: () => void,
): T =>
  new Proxy(client, {
    get(target, property) {
      if (property === "aiFeaturePromptControl") {
        return new Proxy(target.aiFeaturePromptControl, {
          get(delegate, method) {
            if (method === "findUnique") {
              return async (
                ...args: Parameters<typeof delegate.findUnique>
              ) => {
                const result = await delegate.findUnique(...args);
                await afterControlRead();
                return result;
              };
            }
            return Reflect.get(delegate, method, delegate) as unknown;
          },
        });
      }
      if (property === "aiPromptBundleRevision") {
        return new Proxy(target.aiPromptBundleRevision, {
          get(delegate, method) {
            if (method === "findMany") {
              return async (...args: Parameters<typeof delegate.findMany>) => {
                const result = await delegate.findMany(...args);
                afterHistoryRead();
                return result;
              };
            }
            return Reflect.get(delegate, method, delegate) as unknown;
          },
        });
      }
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === "function"
        ? (value.bind(target) as unknown)
        : value;
    },
  });

const promptReadClient = (
  afterControlRead: () => Promise<void>,
  afterHistoryRead: () => void,
) => {
  const direct = observePromptReads(prisma, afterControlRead, afterHistoryRead);
  return new Proxy(direct, {
    get(target, property) {
      if (property === "$transaction") {
        return (
          callback: (transaction: Prisma.TransactionClient) => Promise<unknown>,
          options: Parameters<typeof prisma.$transaction>[1],
        ) =>
          prisma.$transaction(
            (transaction) =>
              callback(
                observePromptReads(
                  transaction,
                  afterControlRead,
                  afterHistoryRead,
                ),
              ),
            options,
          );
      }
      return Reflect.get(target, property, target) as unknown;
    },
  });
};

const readService = (client = prisma) =>
  new AiPromptService(
    new AiPromptRepository(client as unknown as PrismaService),
    new AiProviderConfigurationRepository(prisma as unknown as PrismaService),
  );

describe("AI prompt control-plane database states", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("returns no prompt control when the feature has not been initialized", async () => {
    await expect(repository.getControl(featureKey)).resolves.toBeNull();
  });

  it("reads a newer draft without treating it as the active bundle", async () => {
    const active = await createActiveBaseline();
    const draft = await createDraft(active.id, "newer-draft");
    const events: string[] = [];
    const service = readService(
      promptReadClient(
        () => {
          events.push("controlRead");
          return Promise.resolve();
        },
        () => events.push("historyRead"),
      ),
    );
    const { control } = await service.read(featureKey);
    expect(events).toEqual(["controlRead", "historyRead"]);
    expect(control.activeBundle).toMatchObject({
      id: active.id,
      lifecycle: "active",
    });
    expect(control.latestRevision).toMatchObject({
      id: draft.id,
      lifecycle: "draft",
    });
  });

  it("keeps one admin prompt snapshot across a committed activation between reads", async () => {
    const active = await createActiveBaseline();
    const candidate = await createDraft(active.id, "concurrent-activation");
    await expect(
      repository.transition(featureKey, candidate.id, {
        from: [AiPromptBundleLifecycle.draft],
        to: AiPromptBundleLifecycle.validated,
      }),
    ).resolves.toBe(true);
    const events: string[] = [];
    const controlRead = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const service = readService(
      promptReadClient(
        async () => {
          events.push("controlRead");
          controlRead.resolve();
          await withinBarrierTimeout(release.promise);
        },
        () => events.push("historyRead"),
      ),
    );
    const reading = service.read(featureKey);
    const settled = reading.then(
      () => undefined,
      () => undefined,
    );
    try {
      await withinBarrierTimeout(controlRead.promise);
      await expect(
        withinBarrierTimeout(
          repository.activate(featureKey, candidate.id, {
            allowedLifecycle: [AiPromptBundleLifecycle.validated],
            now,
            contract: {
              servingContractVersion: baseline.servingContractVersion,
            },
          }),
        ),
      ).resolves.toBe(true);
      events.push("writerCommitted");
      release.resolve();
      const { control } = await withinBarrierTimeout(reading);
      expect(events).toEqual(["controlRead", "writerCommitted", "historyRead"]);
      expect(control.activeRevisionId).toBe(active.id);
      expect(control.activeBundle).toMatchObject({
        id: active.id,
        lifecycle: "active",
        effectiveContentHash: active.effectiveContentHash,
        promptContents: active.promptContents,
      });
      const retainedActive = control.history.find(({ id }) => id === active.id);
      expect(retainedActive).toEqual(control.activeBundle);
      expect(control.latestRevision).toMatchObject({
        id: candidate.id,
        lifecycle: "validated",
        effectiveContentHash: candidate.effectiveContentHash,
        promptContents: candidate.promptContents,
      });
      expect(control.history[0]).toEqual(control.latestRevision);
      await expect(
        prisma.aiFeaturePromptControl.findUnique({ where: { featureKey } }),
      ).resolves.toMatchObject({ activeRevisionId: candidate.id });
      await expect(
        prisma.aiPromptBundleRevision.findUnique({ where: { id: active.id } }),
      ).resolves.toMatchObject({ lifecycle: "superseded" });
    } finally {
      release.resolve();
      await settled;
    }
  });

  it("allocates concurrent feature-local revisions without moving the active pointer", async () => {
    const first = await createActiveBaseline();
    expect(typeof first.id).toBe("string");
    expect(first).toMatchObject({
      lifecycle: AiPromptBundleLifecycle.active,
      revision: 1,
    });
    const drafts = await Promise.all([
      createDraft(first.id, "candidate-a"),
      createDraft(first.id, "candidate-b"),
    ]);
    expect(drafts.map(({ revision }) => revision).sort()).toEqual([2, 3]);
    await expect(
      prisma.aiFeaturePromptControl.findUnique({ where: { featureKey } }),
    ).resolves.toMatchObject({ activeRevisionId: first.id });
  });

  it("activates current prompt text and preserves history on discard", async () => {
    const active = await createActiveBaseline();
    const candidate = await createDraft(active.id, "candidate");
    await repository.transition(featureKey, candidate.id, {
      from: [AiPromptBundleLifecycle.draft],
      to: AiPromptBundleLifecycle.validated,
    });

    await expect(
      repository.activate(featureKey, candidate.id, {
        allowedLifecycle: [AiPromptBundleLifecycle.validated],
        now,
        contract: {
          servingContractVersion:
            candidate.servingContractVersion ?? baseline.servingContractVersion,
        },
      }),
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
