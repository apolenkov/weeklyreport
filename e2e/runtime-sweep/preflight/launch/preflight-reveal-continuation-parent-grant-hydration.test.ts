import { spawn } from "node:child_process";
import { unlink } from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { rememberedRevealContinuationAsset } from "../reveal/continuation/preflight-reveal-continuation-assets.ts";
import { PREFLIGHT_REVEAL_REDUCER_CHECKPOINT } from "../reveal/continuation/preflight-reveal-continuation-schemas.ts";
import { withSealedGrantFixture } from "./preflight-reveal-continuation-parent-test-fixture.ts";

const runHydrationChild = async (input: {
  readonly archiveRoot: string;
  readonly grantPath: string;
}): Promise<Readonly<{ exitCode: number; stdout: string; stderr: string }>> => {
  const ioUrl = pathToFileURL(
    path.resolve(
      "e2e/runtime-sweep/preflight/reveal/continuation/preflight-reveal-continuation-io.ts",
    ),
  ).href;
  const script = String.raw`
    import { readRevealContinuationGrant, hydrateRevealContinuationAssets } from ${JSON.stringify(ioUrl)};
    const grant = await readRevealContinuationGrant(${JSON.stringify({ archiveRoot: input.archiveRoot, filePath: input.grantPath })});
    if (grant === undefined) throw new Error("grant is missing in child process");
    await hydrateRevealContinuationAssets({ archiveRoot: ${JSON.stringify(input.archiveRoot)}, grant });
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
  return { exitCode, stdout, stderr };
};

describe("R188 grant asset hydration", () => {
  it("hydrates the complete graph in a fresh process", async () => {
    await withSealedGrantFixture(async ({ archiveRoot, sealed }) => {
      const { exitCode, stdout, stderr } = await runHydrationChild({
        archiveRoot,
        grantPath: sealed.path,
      });

      expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" });
      expect(stdout.trim()).toBe("ok");
    });
  });

  it("rejects a missing checkpoint leaf in a fresh process", async () => {
    await withSealedGrantFixture(async ({ archiveRoot, sealed }) => {
      const checkpoint = rememberedRevealContinuationAsset({
        artifact: PREFLIGHT_REVEAL_REDUCER_CHECKPOINT,
        ref: sealed.grant.reducerState.checkpointRef,
      });
      if (checkpoint?.artifact !== PREFLIGHT_REVEAL_REDUCER_CHECKPOINT)
        throw new Error("Checkpoint fixture is unavailable");
      const controlRef = checkpoint.controls.refs[0];
      if (controlRef === undefined)
        throw new Error("Checkpoint fixture has no control leaf");
      await unlink(
        path.join(
          archiveRoot,
          "continuation",
          "assets",
          "preflight_reveal_control",
          `${controlRef}.json`,
        ),
      );

      const result = await runHydrationChild({
        archiveRoot,
        grantPath: sealed.path,
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toMatch(/ENOENT|cannot read content asset/iu);
    });
  });
});
