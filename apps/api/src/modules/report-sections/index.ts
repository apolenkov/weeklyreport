/**
 * report-sections facade barrel — the module's public surface for siblings.
 * Cross-module imports reach report-sections ONLY through this file (Zone 3,
 * import-x/no-restricted-paths); a deep internal path errors once the zone
 * flips. Export-only with zero side effects — invariant 2 (role-coverage)
 * builds the router at module load, so a side-effecting or circular barrel
 * would break it. Grows one curated named re-export per consumer as slice 6
 * reroutes each deep import here.
 */
export { ensureLeadSection } from "./application/ensure-lead-section.js";
export { applyRevokeTransition } from "./application/revoke-transition.js";
export {
  type PrismaReportSectionWithRelations,
  reportSectionFullInclude,
} from "./infrastructure/report-sections.include.js";
export { mapPrismaToReportSection } from "./infrastructure/report-sections.mappers.js";
