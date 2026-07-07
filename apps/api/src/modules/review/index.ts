/**
 * review facade barrel — public surface for siblings (Zone 3). Export-only,
 * zero side effects, pure symbols only (never the Nest module — invariant 2
 * builds the router at load, and a module re-export could close a cycle).
 * weekly-report reads isDesignatedReviewer to flag late reviewers.
 */
export { isDesignatedReviewer } from "./domain/review-authz.js";
