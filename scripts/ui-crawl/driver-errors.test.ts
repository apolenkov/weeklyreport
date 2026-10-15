import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
const root = join(import.meta.dirname, "../../output/crawl-cli-tests");
const dirs: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
async function driver(script: string, interpreter = process.execPath) {
  mkdirSync(root, { recursive: true });
  const dir = mkdtempSync(join(root, "cli-"));
  dirs.push(dir);
  const file = join(dir, "cli.cjs");
  writeFileSync(file, `#!${interpreter}\n${script}`);
  chmodSync(file, 0o700);
  // The first exec of a freshly written file costs far more than later ones
  // (about 200 ms median, near 1 s under CPU load, against 16 ms warm), which
  // alone can exhaust the 1 s budget of the timeout cases. Pay it outside the
  // budget; "session" is the one argument every fixture answers quickly.
  execFileSync(file, ["session"], { stdio: "ignore", timeout: 30_000 });
  vi.stubEnv("AGENT_BROWSER_BIN", file);
  vi.resetModules();
  return import("./driver.ts");
}
describe("crawler CLI failure protocol", () => {
  it("does not salvage stdout from a timed-out batch", async () => {
    const { createBrowser } = await driver(
      String.raw`if [ "$1" = session ]; then printf '%s\n' fixture-session; else printf '%s\n' '[{"success":true,"result":"observed"}]'; exec sleep 3; fi`,
      "/bin/sh",
    );
    const browser = createBrowser("fixture", 1000);
    let failure: unknown;
    try {
      browser.batch([["snapshot"]]);
    } catch (error: unknown) {
      failure = error;
    }
    expect(failure).toMatchObject({
      code: "ETIMEDOUT",
      stdout: '[{"success":true,"result":"observed"}]\n',
    });
  });
  it("bounds session bootstrap by the configured timeout", async () => {
    const { createBrowser } = await driver(
      "setTimeout(()=>console.log('fixture-session'),600)",
    );
    expect(() => createBrowser("fixture", 100)).toThrow(
      expect.objectContaining({ code: "ETIMEDOUT" }),
    );
  });
  it("preserves nonzero exit and stderr when batch JSON is truncated", async () => {
    const { createBrowser } = await driver(
      "if(process.argv[2]==='session')console.log('fixture-session');else{process.stdout.write('[{');process.stderr.write('CLI ROOT FAILURE');process.exit(7)}",
    );
    const browser = createBrowser("fixture");
    let error: unknown;
    try {
      browser.batch([["snapshot"]]);
    } catch (error_) {
      error = error_;
    }
    expect(error).toMatchObject({ status: 7 });
    expect(String((error as { stderr?: unknown }).stderr)).toContain(
      "CLI ROOT FAILURE",
    );
  });
  it("keeps complete failed-command results available by entry", async () => {
    const { createBrowser } = await driver(
      "if(process.argv[2]==='session')console.log('fixture-session');else{console.log(JSON.stringify([{success:false,error:'command unavailable'},{success:true,result:{result:'observed'}}]));process.exit(7)}",
    );
    const browser = createBrowser("fixture");
    expect(browser.batch([["snapshot"], ["eval", "true"]])).toEqual([
      { ok: false, error: "command unavailable", value: undefined },
      { ok: true, error: null, value: "observed" },
    ]);
  });
});
