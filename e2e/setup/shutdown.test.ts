import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";

const shutdownModule = new URL("./shutdown.js", import.meta.url).href;
const workerSource = `
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { installShutdown, runtimeSignal, trackRuntimeOperation } from ${JSON.stringify(shutdownModule)};
const signal = runtimeSignal();
const closed = new Set();
installShutdown(async () => {
  assert.equal(closed.size, 2, 'Owned children must close before cleanup');
  assert.throws(() => runtimeSignal(new AbortController().signal), /interrupted/);
  process.send('blocked');
  await new Promise((resolve, reject) => process.send('cleanup', (error) => {
    if (error) reject(error);
    else resolve();
  }));
});
let readyCount = 0;
for (const kind of ['preparation', 'client']) {
  const child = spawn(process.execPath, ['-e', "process.send('ready'); process.stdin.resume()"], {
    detached: kind === 'preparation',
    stdio: ['pipe', 'ignore', 'ignore', 'ipc'],
  });
  process.send('owned:' + kind + ':' + child.pid);
  signal.addEventListener('abort', () => {
    if (kind === 'preparation') process.kill(-child.pid, 'SIGKILL');
    else child.kill('SIGTERM');
  }, { once: true });
  const completion = new Promise((resolve) => child.once('close', () => {
    closed.add(kind);
    process.send('closed:' + kind);
    resolve();
  }));
  void trackRuntimeOperation(completion);
  child.once('message', () => {
    readyCount += 1;
    if (readyCount === 2) process.send('ready');
  });
}
`;

function terminate(pid: number, processGroup: boolean): void {
  try {
    process.kill(processGroup ? -pid : pid, "SIGKILL");
  } catch {
    // The synthetic child may already have exited.
  }
}

void test(
  "SIGTERM reaps owned preparation and client before cleanup and prevents more work",
  { timeout: 10_000 },
  async () => {
    const messages: string[] = [];
    const owned: { pid: number; processGroup: boolean; kind: string }[] = [];
    const worker = spawn(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", workerSource],
      {
        detached: true,
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      },
    );
    let stderr = "";
    worker.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const readiness = new Promise<void>((resolve) => {
      worker.on("message", (message: unknown) => {
        if (typeof message !== "string") return;
        messages.push(message);
        const identity = /^owned:(preparation|client):(\d+)$/u.exec(message);
        if (identity)
          owned.push({
            pid: Number(identity[2]),
            processGroup: identity[1] === "preparation",
            kind: identity[1] ?? "",
          });
        if (message === "ready") resolve();
      });
    });
    const closed = once(worker, "close", { signal: AbortSignal.timeout(5000) });
    try {
      await Promise.race([
        readiness,
        closed.then(() => {
          throw new Error(`Synthetic worker exited before ready: ${stderr}`);
        }),
      ]);
      assert(worker.kill("SIGTERM"));
      const result: unknown = await closed;
      assert(Array.isArray(result));
      assert.equal(result[0], 143, stderr);
      assert.equal(result[1], null);
      assert(messages.includes("closed:preparation"));
      assert(messages.includes("closed:client"));
      assert.deepEqual(messages.slice(-2), ["blocked", "cleanup"]);
      for (const child of owned) {
        assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" });
      }
    } finally {
      if (
        worker.pid !== undefined &&
        worker.exitCode === null &&
        worker.signalCode === null
      ) {
        terminate(worker.pid, true);
      }
      for (const child of owned) {
        if (!messages.includes(`closed:${child.kind}`))
          terminate(child.pid, child.processGroup);
      }
    }
  },
);
