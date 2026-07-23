import {
  resolveNavigationType,
  webVitalBeaconSchema,
} from "@customreport/shared";
import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
} from "@nestjs/common";

import {
  webVitalCls,
  webVitalFcp,
  webVitalInp,
  webVitalLcp,
  webVitalTtfb,
} from "../../infrastructure/metrics/web-vitals.metrics.js";

// The validated `name` enum guarantees every key resolves to a histogram, so no
// undefined-guard is needed at the call site.
const HISTOGRAM_BY_NAME = {
  LCP: webVitalLcp,
  CLS: webVitalCls,
  FCP: webVitalFcp,
  INP: webVitalInp,
  TTFB: webVitalTtfb,
} as const;

@Controller("api")
export class WebVitalsController {
  private readonly logger = new Logger(WebVitalsController.name);

  @Post("web-vitals")
  record(@Body() body: unknown): void {
    const parsed = webVitalBeaconSchema.safeParse(body);
    if (!parsed.success) {
      // Public unauthenticated endpoint: a malformed beacon records nothing and
      // returns 400 — it must never throw past here into a 500.
      throw new BadRequestException("invalid web-vital beacon");
    }

    const { name, value, navigationType } = parsed.data;
    const bucket = resolveNavigationType(navigationType);
    HISTOGRAM_BY_NAME[name].observe({ navigation_type: bucket }, value);
    this.logger.debug(`web vital ${name}=${value.toFixed(2)} nav=${bucket}`);
  }
}
