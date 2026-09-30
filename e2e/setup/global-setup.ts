import { initializeSessions } from "../lead-form/browser.js";
import { verifyInstalledAgentBrowser } from "./agent-browser-version.js";
import { validateE2eRuntimeTarget } from "./runtime-target.js";

export async function globalSetup(signal: AbortSignal): Promise<void> {
  validateE2eRuntimeTarget("e2e-global-setup");
  await verifyInstalledAgentBrowser(signal);
  await initializeSessions(signal);
}
