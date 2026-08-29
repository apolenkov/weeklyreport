// Test-only seam for infrastructure adapters and fabricated rows composed by
// neighboring integration/repository tests.
export { baseRow } from "../infrastructure/__tests__/report-sections-prisma-harness.js";
export { ReportSectionsPrismaRepository } from "../infrastructure/report-sections.prisma-repository.js";
export { applySaveSection } from "../infrastructure/save-section.transaction.js";
