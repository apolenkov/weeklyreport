import { initializeSessions } from "../lead-form/browser.js";
import { validateE2eRuntimeTarget } from "./runtime-target.js";

export async function globalSetup(signal: AbortSignal): Promise<void> {
  validateE2eRuntimeTarget("e2e-global-setup");
  await initializeSessions(signal);
}
