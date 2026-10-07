import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

import { createBrowser } from "./driver.ts";

/** A separate HTTP process can respond while the synchronous production CLI waits. */
export async function browserFixture(html: string) {
  await using resources = new AsyncDisposableStack();
  const source = `import {createServer} from 'node:http';
    const server = createServer((request, response) => {
      response.setHeader('Content-Type', 'text/html');
      response.end(${JSON.stringify(html)});
    });
    server.listen(0, '127.0.0.1', () => console.log('http://127.0.0.1:' + server.address().port));`;
  const server = spawn(
    process.execPath,
    ["--input-type=module", "-e", source],
    {
      stdio: ["ignore", "pipe", "inherit"],
    },
  );
  resources.defer(async () => {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, "exit");
      server.kill();
      await exited;
    }
  });
  const received: readonly unknown[] = await once(server.stdout, "data", {
    signal: AbortSignal.timeout(5000),
  });
  const [chunk] = received;
  const url = String(chunk).trim();
  assert.equal(new URL(url).hostname, "127.0.0.1");
  const browser = createBrowser("task-287-fixture");
  resources.defer(() => browser.close());
  const open = (): void => {
    const [step] = browser.batch([["open", url]]);
    assert.ok(step?.ok, step?.error ?? "Fixture navigation failed");
  };
  open();
  const cleanup = resources.move();
  return { browser, url, open, close: () => cleanup.disposeAsync() };
}
