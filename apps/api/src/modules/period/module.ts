// Keep Nest composition separate from the public API: period.module imports
// admin/index, while admin lifecycle code imports period/index; merging the
// surfaces would create a circular ESM dependency.
export { PeriodModule } from "./period.module.js";
