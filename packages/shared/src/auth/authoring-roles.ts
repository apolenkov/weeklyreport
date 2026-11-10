import type { Role } from "../schemas/auth/auth.js";

/** Authoring roles from report-section-write-gates; ownership is checked separately. */
export const AUTHORING_ROLES: readonly Role[] = ["lead", "head", "admin"];
