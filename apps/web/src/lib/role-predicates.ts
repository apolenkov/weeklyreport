import type { Role } from "@customreport/shared";

/**
 * Client role-identity predicates — the single place the web client spells
 * out "is this role X?" (client-role-predicates spec).
 *
 * UX-affordance layer ONLY, not a security boundary: enforcement lives in
 * the API's role-coverage gate (the 8 canonical middleware chains) and the
 * server-side route gates. Do not add `can*` enforcement helpers here, do
 * not absorb server-computed capability flags, and keep these pure — no
 * React, no session access; callers pass their own role operand and keep
 * their own null guards.
  * @param role - The role argument.
 */

export function isHead(role: Role | null): boolean {
  return role === "head";
}

/**
 * Is Admin.
 * @param role - The role argument.
 */
export function isAdmin(role: Role | null): boolean {
  return role === "admin";
}

/**
 * Is Lead.
 * @param role - The role argument.
 */
export function isLead(role: Role | null): boolean {
  return role === "lead";
}

/**
 * Is Viewer.
 * @param role - The role argument.
 */
export function isViewer(role: Role | null): boolean {
  return role === "viewer";
}

/**
 * Head or admin — the sessions that act on whole periods and groups.
 * @param role - The role argument.
 */
export function isHeadLike(role: Role | null): boolean {
  return role === "head" || role === "admin";
}
