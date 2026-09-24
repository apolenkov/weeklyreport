import { Inject, Injectable, Logger } from "@nestjs/common";
import type { HealthIndicatorResult } from "@nestjs/terminus";
import { HealthIndicatorService } from "@nestjs/terminus";

import { requireEnv } from "../../lib/env.js";
import { errorMessage } from "../../lib/error-message.js";
import { ENV_CONFIG } from "../config/config.module";
import type { EnvConfig } from "../config/env.schema";
import { withReadinessTimeout } from "./readiness-timeout.js";

// Dedicated lazy probe of the renderer's own GET /health — never aggregated
// into /health/ready: a renderer outage degrades export jobs (they fail
// retryably), it does not make the API unready. The API never contacts the
// renderer at boot, so an unresolvable compose-internal hostname under
// host-source `pnpm dev` reports `down` here while boot and readiness stay
// unaffected.
@Injectable()
export class PdfRendererHealthIndicator {
  private readonly logger = new Logger(PdfRendererHealthIndicator.name);
  private readonly healthUrl: string;

  constructor(
    @Inject(HealthIndicatorService)
    private readonly healthIndicator: HealthIndicatorService,
    @Inject(ENV_CONFIG) env: EnvConfig,
  ) {
    const base = requireEnv(env, "GOTENBERG_URL");
    this.healthUrl = `${base.replace(/\/$/, "")}/health`;
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const abort = new AbortController();
    try {
      await withReadinessTimeout(
        "pdf-renderer",
        (async () => {
          const response = await fetch(this.healthUrl, {
            signal: abort.signal,
          });
          try {
            if (!response.ok)
              throw new Error(`renderer answered ${response.status}`);
          } finally {
            await response.body?.cancel().catch(() => undefined);
          }
        })(),
      );
      return this.healthIndicator.check(key).up();
    } catch (error) {
      this.logger.warn("pdf renderer health probe failed", {
        error: errorMessage(error),
      });
      return this.healthIndicator.check(key).down();
    } finally {
      // A lost timeout race leaves the probe fetch in flight; aborting here
      // releases the socket instead of letting it linger to connection close.
      abort.abort();
    }
  }
}
