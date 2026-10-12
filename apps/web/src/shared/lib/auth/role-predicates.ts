import type { Role } from "@weeklyreport/shared";

// Role classification shared by client presentation and server route gates.
// API middleware remains the
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
