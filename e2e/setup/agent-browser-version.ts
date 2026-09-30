import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);

export const AGENT_BROWSER_VERSION = "0.38.1";

/** Extracts the first semantic version from `agent-browser --version` output. */
export function parseAgentBrowserVersion(output: string): string | undefined {
  return /\b\d+\.\d+\.\d+\b/.exec(output)?.[0];
}

export function assertAgentBrowserVersion(output: string): void {
  const actual = parseAgentBrowserVersion(output);
  if (actual !== AGENT_BROWSER_VERSION) {
    throw new Error(
      `E2E requires agent-browser ${AGENT_BROWSER_VERSION}, found ${actual ?? JSON.stringify(output.trim())}`,
    );
  }
}

/** Fails fast before any browser session when the installed CLI is not the pinned version. */
export async function verifyInstalledAgentBrowser(
  signal: AbortSignal,
): Promise<void> {
  const { stdout } = await execute("agent-browser", ["--version"], {
    encoding: "utf8",
    timeout: 40_000,
    signal,
  });
  assertAgentBrowserVersion(stdout);
}
