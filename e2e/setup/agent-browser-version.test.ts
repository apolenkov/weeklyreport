import assert from "node:assert/strict";
import test from "node:test";

import {
  AGENT_BROWSER_VERSION,
  assertAgentBrowserVersion,
  parseAgentBrowserVersion,
} from "./agent-browser-version.js";

void test("agent-browser version is parsed from CLI output", () => {
  assert.equal(parseAgentBrowserVersion("agent-browser 0.38.1\n"), "0.38.1");
  assert.equal(parseAgentBrowserVersion("0.38.1"), "0.38.1");
  assert.equal(parseAgentBrowserVersion("no version"), undefined);
});

void test("only the pinned agent-browser version is accepted", () => {
  assert.doesNotThrow(() =>
    assertAgentBrowserVersion(`agent-browser ${AGENT_BROWSER_VERSION}\n`),
  );
  assert.throws(
    () => assertAgentBrowserVersion("agent-browser 0.39.0\n"),
    /requires agent-browser 0\.38\.1, found 0\.39\.0/u,
  );
  assert.throws(() => assertAgentBrowserVersion(""), /found ""/u);
});
