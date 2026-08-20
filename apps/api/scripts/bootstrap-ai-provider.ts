import "dotenv/config";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "../src/app.module.js";
import { AiProviderConfigurationService } from "../src/modules/ai-provider/index.js";

const run = async (): Promise<void> => {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  try {
    const service = app.get(AiProviderConfigurationService);
    const result = await service.bootstrap("rollout");
    console.log(
      JSON.stringify({
        availability: result.availability,
        activeRevisionId: result.activeRevisionId,
        activeLifecycle: result.active?.lifecycle ?? null,
      }),
    );
  } finally {
    await app.close();
  }
};

void run().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "AI provider bootstrap failed",
  );
  process.exitCode = 1;
});
