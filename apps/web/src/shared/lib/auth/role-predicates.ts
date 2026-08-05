import type { Role } from "@customreport/shared";

// Pure UX predicates only; API middleware and server route gates remain the
// security boundary, so these helpers do not encode capabilities.

export function isHead(role: Role | null): boolean {
  return role === "head";
}

export function isAdmin(role: Role | null): boolean {
  return role === "admin";
}

export function isLead(role: Role | null): boolean {
  return role === "lead";
}

export function isViewer(role: Role | null): boolean {
  return role === "viewer";
}

// Head or admin — the sessions that act on whole periods and groups.
export function isHeadLike(role: Role | null): boolean {
  return role === "head" || role === "admin";
}
