// Barrel for the report/section/period/stage schemas. This file was split
// into domain-scoped modules (code-quality-modernization, Wave 3) while
// preserving every previously exported symbol and import path. Importers
// continue to use `./report` (and the package barrel `@customreport/shared`)
// unchanged. No symbol was renamed — the legacy-misnamed `stageIds` field
// keeps its name (TODO(STAGE-NAMING-01)).
export * from "./period.schema";
export * from "./report-primitives.schema";
export * from "./report.schema";
export * from "./section.schema";
export * from "./stage.schema";
