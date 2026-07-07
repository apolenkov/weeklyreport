/**
 * publication facade barrel — public surface for siblings (Zone 3).
 * Export-only, zero side effects. period's DI wiring pulls the module + service.
 */
export { PublicationService } from "./application/publication.service.js";
export { PublicationModule } from "./publication.module.js";
