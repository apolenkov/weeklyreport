// Barrel for the report/section/period/stage schemas, re-exporting the
// domain-scoped modules through the stable `./report` import path (and the
// package barrel `@customreport/shared`). The legacy-misnamed `stageIds` field
// keeps its name (TODO(STAGE-NAMING-01)).
export * from "./period.schema";
export * from "./report.schema";
export * from "./report-primitives.schema";
export * from "./review.schema";
export * from "./section.schema";
export * from "./section-validation.schema";
export * from "./stage.schema";
