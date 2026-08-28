import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "vitest";

const PROCESS_TIMEOUT_MS = 20_000;
const READY_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 20;
const require = createRequire(import.meta.url);
const playwrightCli = require.resolve("@playwright/test/cli");
const playwrightTestUrl = pathToFileURL(
  require.resolve("@playwright/test"),
).href;

type ProbeMode = "failure" | "interruption" | "timeout";

interface ProbeReceipt {
  readonly errors: readonly string[];
  readonly fullStatus: string;
  readonly portFree: boolean;
  readonly testStatus: string;
}

interface ProbeResult {
  readonly code: number | null;
  readonly receipt: ProbeReceipt;
  readonly signal: NodeJS.Signals | null;
  readonly stderr: string;
  readonly stdout: string;
}

const reservePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Could not reserve a loopback probe port."));
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });

const waitForFile = async (filePath: string): Promise<void> => {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await readFile(filePath, "utf8");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  throw new Error(`Playwright probe did not start: ${filePath}`);
};

const serverSource = `
import { createServer } from "node:http";
const server = createServer((_request, response) => response.end("ok"));
const stop = () => server.close(() => process.exit(0));
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
server.listen(Number(process.env.PROBE_PORT), "127.0.0.1");
`;

const specSource = `
import playwrightTest from "${playwrightTestUrl}";
import { writeFileSync } from "node:fs";
const { expect, test } = playwrightTest;
test("cleanup probe", async () => {
  writeFileSync(process.env.PROBE_READY_FILE, "ready");
  if (process.env.PROBE_MODE === "failure") expect(1).toBe(2);
  await new Promise(resolve => setTimeout(resolve, 60_000));
});
`;

const reporterSource = `
import { writeFile } from "node:fs/promises";
import net from "node:net";
const portIsFree = port => new Promise(resolve => {
  const socket = net.createConnection({ host: "127.0.0.1", port });
  socket.setTimeout(500);
  socket.once("connect", () => { socket.destroy(); resolve(false); });
  socket.once("error", () => resolve(true));
  socket.once("timeout", () => { socket.destroy(); resolve(false); });
});
export default class ProbeReporter {
  constructor(options) { this.errors = []; this.options = options; this.testStatus = "missing"; }
  onError(error) { this.errors.push(error.message); }
  onTestEnd(_test, result) { this.testStatus = result.status; }
  async onEnd(result) {
    await writeFile(this.options.receiptPath, JSON.stringify({
      fullStatus: result.status,
      errors: this.errors,
      portFree: await portIsFree(this.options.port),
      testStatus: this.testStatus,
    }));
  }
}
`;

const configSource = `
const mode = process.env.PROBE_MODE;
export default {
  testDir: import.meta.dirname,
  testMatch: "probe.spec.mjs",
  timeout: mode === "timeout" ? 100 : 120_000,
  workers: 1,
  reporter: [["./probe-reporter.mjs", {
    port: Number(process.env.PROBE_PORT),
    receiptPath: process.env.PROBE_RECEIPT_FILE,
  }]],
  webServer: {
    command: "node probe-server.mjs",
    cwd: import.meta.dirname,
    url: "http://127.0.0.1:" + process.env.PROBE_PORT,
    reuseExistingServer: false,
  },
};
`;

const runProbe = async (mode: ProbeMode): Promise<ProbeResult> => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "weeklyreport-playwright-cleanup-"),
  );
  const readyFile = path.join(directory, "ready.txt");
  const receiptFile = path.join(directory, "receipt.json");
  const port = await reservePort();
  try {
    await Promise.all([
      writeFile(path.join(directory, "playwright.config.mjs"), configSource),
      writeFile(path.join(directory, "probe-reporter.mjs"), reporterSource),
      writeFile(path.join(directory, "probe-server.mjs"), serverSource),
      writeFile(path.join(directory, "probe.spec.mjs"), specSource),
    ]);
    const child = spawn(
      process.execPath,
      [playwrightCli, "test", "--config", "playwright.config.mjs"],
      {
        cwd: directory,
        env: {
          ...process.env,
          PROBE_MODE: mode,
          PROBE_PORT: String(port),
          PROBE_READY_FILE: readyFile,
          PROBE_RECEIPT_FILE: receiptFile,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    if (mode === "interruption") {
      await waitForFile(readyFile);
      child.kill("SIGINT");
    }
    const exit = await new Promise<{
      code: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    const receipt = JSON.parse(
      await readFile(receiptFile, "utf8"),
    ) as ProbeReceipt;
    if (receipt.testStatus === "missing") {
      throw new Error(
        `Playwright probe did not load a test:\n${receipt.errors.join("\n")}\n${stdout}\n${stderr}`,
      );
    }
    return { ...exit, receipt, stderr, stdout };
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
};

test(
  "runs reporter cleanup after a failing test and web-server teardown",
  async () => {
    const result = await runProbe("failure");
    expect(result.code).not.toBe(0);
    expect(result.receipt).toEqual({
      errors: [],
      fullStatus: "failed",
      portFree: true,
      testStatus: "failed",
    });
  },
  PROCESS_TIMEOUT_MS,
);

test(
  "runs reporter cleanup after a timed-out test and web-server teardown",
  async () => {
    const result = await runProbe("timeout");
    expect(result.code).not.toBe(0);
    expect(result.receipt).toEqual({
      errors: [],
      fullStatus: "failed",
      portFree: true,
      testStatus: "timedOut",
    });
  },
  PROCESS_TIMEOUT_MS,
);

test(
  "runs reporter cleanup after SIGINT and web-server teardown",
  async () => {
    const result = await runProbe("interruption");
    expect(result.code).not.toBe(0);
    expect(result.signal).toBeNull();
    expect(result.receipt).toEqual({
      errors: [],
      fullStatus: "interrupted",
      portFree: true,
      testStatus: "interrupted",
    });
  },
  PROCESS_TIMEOUT_MS,
);
