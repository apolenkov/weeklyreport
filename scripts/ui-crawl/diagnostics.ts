import { execFileSync } from "node:child_process";
import { loadavg } from "node:os";

import { STALL_MS } from "./constants.ts";

export function isRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Swap use and load of the machine, to tell a starved host from a crashed page. */
function hostState(): string {
  try {
    const swap = execFileSync("/usr/sbin/sysctl", ["-n", "vm.swapusage"], {
      encoding: "utf8",
    }).trim();
    return `${swap}; load ${loadavg()
      .map((n) => n.toFixed(1))
      .join(" ")}`;
  } catch {
    return "host state unknown";
  }
}

const RESTART_FLAGS = ["launched", "relaunchedBrowser", "restartedBackground"];

/** What went wrong with the browser during a run: slow calls and restarts, for the speed profile. */
export function createDiagnostics(label: string) {
  /** Calls slower than STALL_MS. */
  const stalls: { kind: string; ms: number; at: string }[] = [];
  /** agent-browser reports in every result when it had to start Chrome or its daemon again. */
  const restarts: { kind: string; flags: string; at: string }[] = [];
  const at = (): string => new Date().toISOString();
  return {
    stalls,
    restarts,
    noteCall(kind: string, ms: number): void {
      if (process.env.CRAWL_TRACE)
        console.error(`[${label}] ${kind} ${Math.round(ms)} ms`);
      if (ms > STALL_MS) stalls.push({ kind, ms: Math.round(ms), at: at() });
    },
    noteLifecycle(entry: unknown, kind: string): void {
      const result = isRecord(entry) ? entry.result : null;
      const life = isRecord(result) ? result.lifecycle : null;
      if (!isRecord(life)) return;
      const flags = RESTART_FLAGS.filter((flag) => life[flag] === true).join(
        ",",
      );
      if (!flags) return;
      restarts.push({ kind, flags, at: at() });
      console.error(
        `[${label}] browser restart (${flags}) at ${kind}; ${hostState()}`,
      );
    },
  };
}
