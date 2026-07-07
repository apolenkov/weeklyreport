/**
 * period facade barrel — the module's public surface for siblings. Same
 * discipline as the report-sections barrel: export-only, zero side effects, no
 * circular imports (invariant 2), reached cross-module ONLY through this file.
 * buildTransition is the pure lifecycle-field writer; publication imports it to
 * compose a period transition inside its own publish path.
 */
export { isOpenBoundaryConflict } from "./application/period-factory.js";
export {
  buildTransition,
  initialPeriodState,
} from "./domain/period-transition.js";
