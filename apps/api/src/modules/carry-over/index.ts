/**
 * carry-over facade barrel — public surface for siblings (Zone 3). Export-only,
 * zero side effects. period's DI wiring pulls the module, its repository and
 * service, plus the two auto-carry-over composition helpers.
 */
export {
  buildAutoCarryOverDeps,
  carryOverIntoOpenedPeriod,
} from "./auto-carry-over.js";
export { CarryOverModule } from "./carry-over.module.js";
export { CarryOverPrismaRepository } from "./carry-over.prisma-repository.js";
export { CarryOverService } from "./carry-over.service.js";
