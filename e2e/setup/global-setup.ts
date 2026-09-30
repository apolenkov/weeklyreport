import { initializeSessions } from "../lead-form/browser.js";
import { prepareE2eData } from "./reset.js";

export async function globalSetup(signal: AbortSignal): Promise<void> {
  await prepareE2eData("demo", signal);
  await initializeSessions(signal);
}
