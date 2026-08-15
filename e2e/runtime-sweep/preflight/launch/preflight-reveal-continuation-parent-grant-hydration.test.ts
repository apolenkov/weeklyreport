import { spawn } from "node:child_process";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { withSealedGrantFixture } from "./preflight-reveal-continuation-parent-test-fixture.ts";

describe("R188 grant asset hydration", () => {
  it("hydrates the complete graph in a fresh process", async () => {
    await withSealedGrantFixture(async ({ archiveRoot, sealed }) => {
      const ioUrl = pathToFileURL(
        path.resolve(
          "e2e/runtime-sweep/preflight/reveal/continuation/preflight-reveal-continuation-io.ts",
        ),
      ).href;
      const script = String.raw`
        import { readRevealContinuationGrant, hydrateRevealContinuationAssets } from ${JSON.stringify(ioUrl)};
        const grant = await readRevealContinuationGrant(${JSON.stringify({ archiveRoot, filePath: sealed.path })});
        if (grant === undefined) throw new Error("grant is missing in child process");
        await hydrateRevealContinuationAssets({ archiveRoot: ${JSON.stringify(archiveRoot)}, grant });
        process.stdout.write("ok\n");
      `;
      const child = spawn(
        process.execPath,
        ["--import", "tsx/esm", "--input-type=module", "-e", script],
        { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (value: Buffer) => {
        stdout += value.toString("utf8");
      });
      child.stderr.on("data", (value: Buffer) => {
        stderr += value.toString("utf8");
      });
      const exitCode = await new Promise<number>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code) => resolve(code ?? -1));
      });

      expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
      expect(stdout.trim()).toBe("ok");
    });
  });
});
