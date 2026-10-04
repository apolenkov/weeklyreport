import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

import { CLI_TIMEOUT_MS, MAX_BUFFER_BYTES } from "./constants.ts";

const BIN = process.env.AGENT_BROWSER_BIN ?? "agent-browser";

type Env = Readonly<Record<string, string | undefined>>;

export type Step = Readonly<{
  ok: boolean;
  error: string | null;
  value: unknown;
}>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One named agent-browser session; every call is a plain CLI invocation. */
export function createBrowser(label: string, timeoutMs = CLI_TIMEOUT_MS) {
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
    { encoding: "utf8" },
  ).trim();
  assert.match(session, /^[a-zA-Z0-9-]+$/, "unexpected session id");
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
      if (stdout.trim().startsWith("[")) return stdout;
      throw error;
    }
  };

  /** Runs commands in one CLI call; a failed command does not stop the rest. */
  const batch = (commands: readonly (readonly string[])[]): readonly Step[] => {
    const parsed: unknown = JSON.parse(
      exec(["batch", "--json"], JSON.stringify(commands)),
    );
    assert.ok(Array.isArray(parsed), "batch: expected an array");
    return parsed.map((entry: unknown): Step => {
      assert.ok(isRecord(entry), "batch: malformed entry");
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
  return { session, batch, evaluate, close };
}

export type Browser = ReturnType<typeof createBrowser>;
