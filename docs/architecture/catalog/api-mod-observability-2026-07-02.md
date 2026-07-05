# Catalog — api-mod-observability (2026-07-02)

2 files. Purpose/layer/domain per file, for the architecture-grouping analysis.

| File                                                        | Layer         | Domain    | Purpose                                                                                                                                          | Key exports         | Deps                                                                                             |
| ----------------------------------------------------------- | ------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------ |
| apps/api/src/modules/observability/observability.module.ts  | module-wiring | telemetry | NestJS module wiring that registers the WebVitalsController as the observability module's only member.                                           | ObservabilityModule | WebVitalsController                                                                              |
| apps/api/src/modules/observability/web-vitals.controller.ts | controller    | telemetry | Public unauthenticated POST endpoint that ingests browser Web Vitals beacons (LCP/CLS/FCP/INP/TTFB) and records them into Prometheus histograms. | WebVitalsController | webVitalBeaconSchema/resolveNavigationType (@customreport/shared), web-vitals.metrics histograms |
