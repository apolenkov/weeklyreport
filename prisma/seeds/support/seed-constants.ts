// Canonical seed constants for CustomReport — the single import surface for the
// seed scripts, the tRPC dev session context, and deterministic id helpers. The
// definitions live in the four leaf modules re-exported below.

export * from "./seed-catalog.js";
export * from "./seed-identifiers.js";
export * from "./seed-people.js";
export * from "./seed-periods.js";

// Literal mirrors of the shared role and report-status vocabularies: the prisma
// toolchain's isolated tsconfig cannot resolve workspace packages, so they are
// declared here — the one seed file the status-SSOT gate allowlists.
export type SeedRole = "head" | "viewer" | "admin" | "lead";
export type SeedReportStatus = "draft" | "published";
