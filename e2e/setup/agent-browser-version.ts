import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);

export const AGENT_BROWSER_VERSION = "0.38.2";

/** Accepts only the exact pinned release; prereleases such as 0.38.1-rc.1 fail. */
export function assertAgentBrowserVersion(output: string): void {
  const actual = output.trim().split(/\s+/u).at(-1) ?? "";
  if (actual !== AGENT_BROWSER_VERSION) {
    throw new Error(
      `E2E requires agent-browser ${AGENT_BROWSER_VERSION}, found ${JSON.stringify(actual)}`,
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
