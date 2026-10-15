import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { MissingOutput, RoleResult } from "./types.ts";

// shortcut: checks the top-level shape only; a malformed run inside still fails later in report building.
function isRoleResult(value: unknown, role: string): value is RoleResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    result.role === role &&
    typeof result.ms === "number" &&
    Array.isArray(result.runs)
  );
}

type Read = Readonly<
  { ok: true; result: RoleResult } | { ok: false; reason: string }
>;

const unusable = (reason: string): Read => ({ ok: false, reason });

function readRole(out: string, role: string): Read {
  let text: string;
  try {
    text = readFileSync(join(out, `role-${role}.json`), "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return unusable(
      code === "ENOENT" ? "no output" : `unreadable (${code ?? "unknown"})`,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return unusable("invalid JSON");
  }
  return isRoleResult(value, role)
    ? { ok: true, result: value }
    : unusable("not a role result");
}

/** Reads each requested role's output, naming every one that cannot be used instead of dropping it. */
export function readRoleOutputs(
  out: string,
  roles: readonly string[],
): Readonly<{
  results: readonly RoleResult[];
  missing: readonly MissingOutput[];
}> {
  const results: RoleResult[] = [];
  const missing: MissingOutput[] = [];
  for (const role of roles) {
    const output = readRole(out, role);
    if (output.ok) results.push(output.result);
    else missing.push({ role, reason: output.reason });
  }
  return { results, missing };
}
