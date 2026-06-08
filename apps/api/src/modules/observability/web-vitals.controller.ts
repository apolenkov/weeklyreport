import { Body, Controller, Logger, Post } from "@nestjs/common";

import {
  webVitalCls,
  webVitalFcp,
  webVitalInp,
  webVitalLcp,
  webVitalTtfb,
} from "../../infrastructure/metrics/web-vitals.metrics.js";

const GAUGE_MAP = {
  LCP: webVitalLcp,
  CLS: webVitalCls,
  FCP: webVitalFcp,
  INP: webVitalInp,
  TTFB: webVitalTtfb,
} as const;

type VitalName = keyof typeof GAUGE_MAP;

interface WebVitalDto {
  name: string;
  value: number;
  id: string;
  navigationType?: string;
}

@Controller("api")
export class WebVitalsController {
  private readonly logger = new Logger(WebVitalsController.name);

  @Post("web-vitals")
  record(@Body() dto: WebVitalDto): void {
    // dto.name is an arbitrary string from the HTTP body; the `as VitalName`
    // cast only satisfies the index signature. Annotate the result as possibly
    // undefined so the `if (gauge)` guard stays real for unknown metric names
    // (GAUGE_MAP[unknownKey] is undefined at runtime).
    const gauge = (
      GAUGE_MAP as Partial<Record<VitalName, (typeof GAUGE_MAP)[VitalName]>>
    )[dto.name as VitalName];
    if (gauge) {
      gauge.set(
        { navigation_type: dto.navigationType ?? "unknown" },
        dto.value,
      );
    }
    this.logger.log(
      `web vital ${dto.name}=${dto.value.toFixed(2)} nav=${dto.navigationType ?? "unknown"}`,
    );
  }
}
