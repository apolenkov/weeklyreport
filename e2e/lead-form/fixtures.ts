import { after, afterEach, before, beforeEach } from "node:test";

import { globalSetup } from "../setup/global-setup.js";
import { prepareE2eData } from "../setup/reset.js";
import { installShutdown, runtimeSignal } from "../setup/shutdown.js";
import {
  beginTestSessions,
  closeOwnedSessions,
  disposeSessions,
} from "./browser.js";

const SETUP_TIMEOUT_MS = 120_000;
const CLEANUP_TIMEOUT_MS = 45_000;

export function registerE2eHooks(): void {
  let uninstallShutdown: (() => void) | undefined;
  before(
    async (context) => {
      uninstallShutdown = installShutdown(disposeSessions);
      await globalSetup(runtimeSignal(context.signal));
    },
    {
      timeout: SETUP_TIMEOUT_MS,
    },
  );
  beforeEach(
    async (context) => {
      const signal = runtimeSignal(context.signal);
      beginTestSessions(signal);
      await prepareE2eData("demo", signal);
    },
    { timeout: SETUP_TIMEOUT_MS },
  );
  afterEach(closeOwnedSessions, { timeout: CLEANUP_TIMEOUT_MS });
  after(
    async () => {
      try {
        await disposeSessions();
      } finally {
        uninstallShutdown?.();
      }
    },
    { timeout: CLEANUP_TIMEOUT_MS },
  );
}
