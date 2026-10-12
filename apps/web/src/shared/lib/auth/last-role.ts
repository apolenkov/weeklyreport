// This localStorage value is a UI-only resume hint, never an auth decision;
// SSR/parse guards keep corrupted or unavailable storage from breaking render.

import { type Role, sessionRoleSchema } from "@weeklyreport/shared";
import { z } from "zod";

export interface LastRoleRecord {
  readonly role: Role;
  readonly email: string;
  readonly name: string;
}

export const LAST_ROLE_STORAGE_KEY = "weeklyreport:lastRole";

const lastRoleRecordSchema = z.object({
  role: sessionRoleSchema,
  email: z.string().min(1),
  name: z.string(),
});

function parseLastRole(value: unknown): LastRoleRecord | null {
  const result = lastRoleRecordSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function readLastRole(): LastRoleRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_ROLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parseLastRole(parsed);
  } catch {
    // Storage quota / disabled / parse error — degrade silently.
    return null;
  }
}

export function writeLastRole(record: LastRoleRecord): void {
  if (typeof window === "undefined") return;
  if (parseLastRole(record) === null) return;
  try {
    window.localStorage.setItem(LAST_ROLE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* noop */
  }
}
