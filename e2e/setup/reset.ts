import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateE2eRuntimeTarget } from "./runtime-target.js";
import { runtimeSignal, trackRuntimeOperation } from "./shutdown.js";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const PREPARATION_SCRIPT = path.resolve(REPO_ROOT, "e2e/setup/prepare.ts");
const CHILD_TIMEOUT_MS = 90_000;

export type E2eSeedProfile = "demo" | "minimal";
export type E2eScenario = "archived-fill-only" | "section-item-limit";

export function parseE2eScenario(
  profile: E2eSeedProfile,
  scenario: unknown,
): E2eScenario | undefined {
  if (scenario === undefined) return undefined;
  if (scenario === "archived-fill-only") {
    if (profile !== "minimal") {
      throw new Error("The archived Fill scenario requires the minimal seed");
    }
    return scenario;
  }
  if (scenario === "section-item-limit") {
    if (profile !== "demo") {
      throw new Error("The section item-limit scenario requires the demo seed");
    }
    return scenario;
  }
  throw new Error("Unknown E2E scenario");
}

function maskDatabaseUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.username = "***";
    parsed.password = "***";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "<redacted>";
  }
}

function killGroup(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // Process group may already be gone.
  }
}

function waitForPreparation(
  child: ChildProcess,
  scriptName: string,
  signal: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let failure: Error | undefined;
    function stop(error: Error): void {
      failure ??= error;
      killGroup(child.pid);
    }
    const timeout = setTimeout(
      () =>
        stop(
          new Error(
            `[${scriptName}] preparation timed out after ${CHILD_TIMEOUT_MS}ms`,
          ),
        ),
      CHILD_TIMEOUT_MS,
    );
    const onExit = (): void => killGroup(child.pid);
    const onAbort = (): void =>
      stop(
        new Error(`[${scriptName}] preparation cancelled`, {
          cause: signal.reason,
        }),
      );

    function cleanup(): void {
      clearTimeout(timeout);
      process.removeListener("exit", onExit);
      signal.removeEventListener("abort", onAbort);
    }
    process.on("exit", onExit);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();

    child.once("error", (error: Error) => {
      stop(
        new Error(
          `[${scriptName}] preparation process error: ${error.message}`,
        ),
      );
    });
    child.once(
      "close",
      (code: number | null, signal: NodeJS.Signals | null) => {
        if (code !== 0 || signal !== null) {
          const reason =
            code !== null && code !== 0
              ? `exit code ${code}`
              : `signal ${signal ?? "unknown"}`;
          stop(new Error(`[${scriptName}] preparation exited with ${reason}`));
        }
        cleanup();
        if (failure) reject(failure);
        else resolve();
      },
    );
  });
}

export async function prepareE2eData(
  profile: E2eSeedProfile,
  signal: AbortSignal,
  scenario?: E2eScenario,
): Promise<void> {
  const cancellation = runtimeSignal(signal);
  const selectedScenario = parseE2eScenario(profile, scenario);
  const scriptName = `e2e-prepare-${profile}`;
  const target = validateE2eRuntimeTarget(scriptName);
  console.log(
    `[${scriptName}] PostgreSQL target: ${maskDatabaseUrl(target.e2eDatabaseUrl)}`,
  );
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      PREPARATION_SCRIPT,
      profile,
      ...(selectedScenario === undefined ? [] : [selectedScenario]),
    ],
    {
      cwd: REPO_ROOT,
      stdio: "inherit",
      shell: false,
      // Reset, seed, and Prisma overlay share one owned, cancellable group.
      detached: true,
      env: {
        ...process.env,
        DATABASE_URL: target.e2eDatabaseUrl,
        REDIS_DB: target.redisDb,
        REDIS_HOST: target.redisHost,
        REDIS_PORT: String(target.redisPort),
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: target.consentToken,
      },
    },
  );
  await trackRuntimeOperation(
    waitForPreparation(child, scriptName, cancellation),
  );
}
