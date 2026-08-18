import "dotenv/config";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import {
  AiPromptService,
  baselineReportAssistantPrompts,
  REPORT_ASSISTANT_FEATURE_KEY,
} from "../src/modules/ai-prompts/index.js";

const findRevision = (
  feature: Awaited<ReturnType<AiPromptService["read"]>>,
  revisionId: string,
) =>
  feature.control.history.find((revision) => revision.id === revisionId) ??
  null;

const assertBaseline = (
  feature: Awaited<ReturnType<AiPromptService["read"]>>,
  revisionId: string,
): NonNullable<ReturnType<typeof findRevision>> => {
  const revision = findRevision(feature, revisionId);
  if (!revision) throw new Error("Prompt handoff revision is not readable");
  const baseline = baselineReportAssistantPrompts();
  const contentsMatch = baseline.slots.every(
    ({ slot, promptContents }) =>
      revision.promptContents[slot] === promptContents,
  );
  if (
    revision.servingStatus !== "current" ||
    revision.effectiveContentHash !== baseline.contentHash ||
    !contentsMatch
  ) {
    throw new Error(
      "Persisted prompt handoff does not match the code baseline",
    );
  }
  return revision;
};

const run = async (): Promise<void> => {
  const { AppModule } = await import("../src/app.module.js");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const service = app.get(AiPromptService);
    const handoff = await service.handoffCurrentBaseline("rollout");
    let feature = await service.read(REPORT_ASSISTANT_FEATURE_KEY);
    let revision = assertBaseline(feature, handoff.revisionId);

    if (revision.lifecycle === "superseded") {
      await service.restore(
        { featureKey: REPORT_ASSISTANT_FEATURE_KEY, revisionId: revision.id },
        "rollout",
      );
    } else if (
      revision.lifecycle !== "active" ||
      feature.control.activeRevisionId !== revision.id
    ) {
      await service.activate(
        { featureKey: REPORT_ASSISTANT_FEATURE_KEY, revisionId: revision.id },
        "rollout",
      );
    }
    feature = await service.read(REPORT_ASSISTANT_FEATURE_KEY);
    revision = assertBaseline(feature, revision.id);

    if (
      revision.lifecycle !== "active" ||
      feature.control.activeRevisionId !== revision.id
    ) {
      throw new Error("Prompt handoff did not produce an active revision");
    }
    console.log(
      JSON.stringify({
        featureKey: REPORT_ASSISTANT_FEATURE_KEY,
        revisionId: revision.id,
        lifecycle: revision.lifecycle,
        servingStatus: revision.servingStatus,
      }),
    );
  } finally {
    await app.close();
  }
};

void run().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  process.exitCode = 1;
});
