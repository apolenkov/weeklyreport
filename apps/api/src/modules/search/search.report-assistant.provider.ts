import type { Provider } from "@nestjs/common";

import { ENV_CONFIG } from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import type { AiRuntimeResolverPort } from "./application/ai-runtime.resolver.js";
import { AiRuntimeResolver } from "./application/ai-runtime.resolver.js";
import { createClarificationTokenCodec } from "./application/clarification-token.js";
import {
  createReportAssistantClock,
  resolveReportAssistantTimeZone,
} from "./application/report-assistant.runtime.js";
import { ReportAssistantService } from "./application/report-assistant.service.js";
import type { ReportAssistantTelemetry } from "./application/report-assistant.telemetry.js";
import { REPORT_ASSISTANT_TELEMETRY } from "./application/report-assistant.telemetry.js";
import { ReportSearchPrismaRepository } from "./infrastructure/report-search.prisma-repository.js";
import { runtimeOnlyAnswerer, runtimeOnlyPlanner } from "./search.runtime.js";

export const reportAssistantProvider: Provider = {
  provide: ReportAssistantService,
  useFactory: (
    repository: ReportSearchPrismaRepository,
    telemetry: ReportAssistantTelemetry,
    runtimeResolver: AiRuntimeResolverPort,
    env: EnvConfig,
  ) =>
    new ReportAssistantService(
      repository,
      runtimeOnlyPlanner(),
      runtimeOnlyAnswerer(),
      createClarificationTokenCodec({ AUTH_JWT_SECRET: env.AUTH_JWT_SECRET }),
      {
        candidateLimit: env.REPORT_ASSISTANT_CANDIDATE_LIMIT,
        exhaustiveLimit: env.REPORT_ASSISTANT_EXHAUSTIVE_LIMIT,
        contextTokenBudget: env.REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET,
        model: "active-provider",
        timeZone: resolveReportAssistantTimeZone(),
      },
      createReportAssistantClock(),
      undefined,
      telemetry,
      runtimeResolver,
    ),
  inject: [
    ReportSearchPrismaRepository,
    REPORT_ASSISTANT_TELEMETRY,
    AiRuntimeResolver,
    ENV_CONFIG,
  ],
};
