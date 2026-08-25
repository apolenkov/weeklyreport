import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { resourcesFor } from "../shards/resources/preflight-shard-resource-proof-test-support.ts";
import {
  nextDistDirForNextConfig,
  parseRuntimeNextLane,
  RUNTIME_NEXT_LANES,
  runtimeNextDistName,
  staleRuntimeNextDistNames,
} from "./runtime-next-dist.ts";

const WEB_ROOT = path.join(process.cwd(), "apps", "web");

describe("runtime Next dist ownership", () => {
  it("rejects a non-proof-relative dist path", () => {
    expect(() => nextDistDirForNextConfig(WEB_ROOT, ".next")).toThrow(
      "normalized absolute path",
    );
  });

  it("maps proof.resources.nextDistDir through Next config semantics", () => {
    const proof = {
      resources: resourcesFor(path.join(process.cwd(), ".runtime-shard"), 0),
    };
    const configDistDir = nextDistDirForNextConfig(
      WEB_ROOT,
      proof.resources.nextDistDir,
    );

    expect(path.join(WEB_ROOT, proof.resources.nextDistDir)).not.toBe(
      proof.resources.nextDistDir,
    );
    expect(path.isAbsolute(configDistDir)).toBe(false);
    expect(path.join(WEB_ROOT, configDistDir)).toBe(
      proof.resources.nextDistDir,
    );
  });

  it.each(RUNTIME_NEXT_LANES)("accepts %s", (lane) => {
    expect(parseRuntimeNextLane(lane)).toBe(lane);
  });

  it.each([undefined, ".next", "../.next", "other"])("rejects %s", (value) => {
    expect(() => parseRuntimeNextLane(value)).toThrow(
      "Unknown runtime Next lane",
    );
  });

  it("removes dead owners without touching live, current, or foreign dirs", () => {
    const ownerPid = 42;
    const livePid = 43;
    const deadPid = 44;
    const names = [
      runtimeNextDistName("sweep", ownerPid),
      runtimeNextDistName("sweep", livePid),
      runtimeNextDistName("sweep", deadPid),
      runtimeNextDistName("preflight", deadPid),
      ".next",
      ".next-runtime-sweep-not-a-pid",
    ];

    expect(
      staleRuntimeNextDistNames(
        names,
        "sweep",
        ownerPid,
        (pid) => pid === livePid,
      ),
    ).toEqual([runtimeNextDistName("sweep", deadPid)]);
  });
});
