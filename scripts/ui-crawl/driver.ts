import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import { CLI_TIMEOUT_MS, MAX_BUFFER_BYTES } from "./constants.ts";
import { createDiagnostics, isRecord } from "./diagnostics.ts";

const BIN = process.env.AGENT_BROWSER_BIN ?? "agent-browser";

type Env = Readonly<Record<string, string | undefined>>;

export type Step = Readonly<{
  ok: boolean;
  error: string | null;
  value: unknown;
}>;

function completeBatch(stdout: string): boolean {
  try {
    const parsed: unknown = JSON.parse(stdout);
    return (
      Array.isArray(parsed) &&
      parsed.every(
        (entry: unknown) =>
          isRecord(entry) && typeof entry.success === "boolean",
      )
    );
  } catch {
    return false;
  }
}

function sessionId(label: string, timeoutMs: number): string {
  const session = execFileSync(
    BIN,
    [
      "session",
      "id",
      "--scope",
      "worktree",
      "--prefix",
      `crawl-${label}-${Date.now()}-${process.pid}`,
    ],
    { encoding: "utf8", timeout: timeoutMs, maxBuffer: MAX_BUFFER_BYTES },
  ).trim();
  assert.match(session, /^[a-zA-Z0-9-]+$/, "unexpected session id");
  return session;
}

/** One named agent-browser session; every call is a plain CLI invocation. */
export function createBrowser(label: string, timeoutMs = CLI_TIMEOUT_MS) {
  const session = sessionId(label, timeoutMs);
  /** Wall time per kind of CLI call, for the speed profile. */
  const profile = new Map<string, { calls: number; ms: number }>();
  const diagnostics = createDiagnostics(label);
  const env: Env = { ...process.env, AGENT_BROWSER_SESSION: session };
  /** A batch with a failed command exits non-zero but still prints every result: keep that output. */
  const exec = (args: readonly string[], input?: string): string => {
    try {
      return execFileSync(BIN, [...args], {
        env,
        encoding: "utf8",
        input,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER_BYTES,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error: unknown) {
      const stdout =
        isRecord(error) && typeof error.stdout === "string" ? error.stdout : "";
      const exited =
        isRecord(error) &&
        typeof error.status === "number" &&
        error.status !== 0;
      if (exited && args[0] === "batch" && completeBatch(stdout)) return stdout;
      throw error;
    }
  };

  /** Runs commands in one CLI call; a failed command does not stop the rest. */
  const batch = (commands: readonly (readonly string[])[]): readonly Step[] => {
    const started = performance.now();
    const kind = commands.map((c) => c[0]).join("+");
    let parsed: unknown;
    try {
      parsed = JSON.parse(exec(["batch", "--json"], JSON.stringify(commands)));
    } finally {
      const took = performance.now() - started;
      diagnostics.noteCall(kind, took);
      const entry = profile.get(kind) ?? { calls: 0, ms: 0 };
      profile.set(kind, { calls: entry.calls + 1, ms: entry.ms + took });
    }
    assert.ok(Array.isArray(parsed), "batch: expected an array");
    for (const entry of parsed) diagnostics.noteLifecycle(entry, kind);
    return parsed.map((entry: unknown): Step => {
      assert.ok(isRecord(entry), "batch: malformed entry");
      assert.equal(
        typeof entry.success,
        "boolean",
        "batch: missing success flag",
      );
      const result = entry.result;
      const value =
        isRecord(result) && "result" in result ? result.result : result;
      const error = typeof entry.error === "string" ? entry.error : null;
      return { ok: entry.success === true, error, value };
    });
  };

  const evaluate = (source: string): unknown => {
    const [step] = batch([["eval", source]]);
    assert.ok(step?.ok, `eval failed: ${step?.error ?? "no result"}`);
    return step.value;
  };

  const close = (): void => {
    try {
      exec(["close"]);
    } catch {
      // the daemon may already be gone
    }
  };
  return {
    session,
    batch,
    evaluate,
    close,
    profile,
    stalls: diagnostics.stalls,
    restarts: diagnostics.restarts,
  };
}

export type Browser = ReturnType<typeof createBrowser>;
