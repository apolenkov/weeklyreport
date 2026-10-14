import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, test } from "vitest";

// Control for the CI `dependency-scan` gate: `pnpm audit --audit-level high`
// must exit nonzero for a high/critical advisory and for an unreachable
// endpoint, and zero for a clean answer, against a synthetic registry.
const LOCKFILE = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    dependencies:
      left-pad:
        specifier: 1.3.0
        version: 1.3.0

packages:

  left-pad@1.3.0:
    resolution: {integrity: sha512-XI5MPzVNApjAyhQzphX8BkmKsKUxD4LdyK24iZeQGinBN9yTQT3bFlCBy/aVx2HrNcqQGsdot8ghrjyrvMCoEA==}

snapshots:

  left-pad@1.3.0: {}
`;

let answer: unknown = {};
let project = "";
const server = createServer((request, response) => {
  request.resume();
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(answer));
});
let registry = "";

beforeAll(async () => {
  project = mkdtempSync(join(tmpdir(), "audit-control-"));
  writeFileSync(
    join(project, "package.json"),
    '{"name":"audit-control","version":"1.0.0","private":true,"dependencies":{"left-pad":"1.3.0"}}',
  );
  writeFileSync(join(project, "pnpm-lock.yaml"), LOCKFILE);
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  registry = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
  rmSync(project, { recursive: true, force: true });
});

// Asynchronous on purpose: the stub registry shares this event loop.
const pnpmBinary = process.env.npm_execpath;

const audit = (url: string): Promise<number | null> =>
  new Promise((done) => {
    assert.ok(pnpmBinary, "run through pnpm so npm_execpath names the CLI");
    const child = spawn(
      pnpmBinary,
      [
        "audit",
        "--audit-level",
        "high",
        "--registry",
        url,
        "--config.fetch-retries=0",
        "--config.fetch-timeout=5000",
      ],
      { cwd: project, stdio: "ignore" },
    );
    child.on("close", done);
  });

const advisory = (severity: string): unknown => ({
  "left-pad": [
    {
      id: 1,
      url: "https://github.com/advisories/GHSA-synthetic-control",
      title: "synthetic control advisory",
      severity,
      vulnerable_versions: "<=1.3.0",
    },
  ],
});

test.each(["high", "critical"])(
  "a %s advisory fails the audit",
  async (severity) => {
    answer = advisory(severity);
    assert.notEqual(await audit(registry), 0);
  },
);

test("an unreachable audit endpoint fails the audit", async () => {
  assert.notEqual(await audit("http://127.0.0.1:9"), 0);
});

test("a clean answer passes the audit", async () => {
  answer = {};
  assert.equal(await audit(registry), 0);
});
