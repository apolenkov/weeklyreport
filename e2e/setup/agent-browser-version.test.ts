import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_BROWSER_VERSION,
  assertAgentBrowserVersion,
} from "./agent-browser-version.js";

void test("only the exact pinned agent-browser version is accepted", () => {
  assert.doesNotThrow(() =>
    assertAgentBrowserVersion(`agent-browser ${AGENT_BROWSER_VERSION}\n`),
  );
  assert.doesNotThrow(() => assertAgentBrowserVersion(AGENT_BROWSER_VERSION));
  for (const output of [
    "agent-browser 0.39.0\n",
    "agent-browser 0.38.2-rc.1\n",
    "agent-browser 10.38.2",
    "",
  ]) {
    assert.throws(
      () => assertAgentBrowserVersion(output),
      /requires agent-browser 0\.38\.2, found "/u,
    );
  }
});
