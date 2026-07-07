/**
 * reminders facade barrel — public surface for siblings (Zone 3). Export-only,
 * zero side effects. admin and period's DI wiring pull the policy applicator.
 */
export { PolicyApplicatorService } from "./policy-applicator.service.js";
