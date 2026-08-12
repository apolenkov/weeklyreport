import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  publishRuntimeLaneStaging,
  runtimeLaneCanonicalRoot,
} from "./runtime-lane-merge-publication.ts";

describe("runtime lane merge publication", () => {
  it("publishes cells and baseline through one canonical directory rename", async () => {
    const archiveRoot = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "runtime-merge-publication-")),
    );
    const staging = path.join(archiveRoot, "merge-staging", "digest");
    await mkdir(path.join(staging, "cells"), { recursive: true });
    await mkdir(path.join(staging, "baseline"));
    await Promise.all([
      writeFile(path.join(staging, "cells", "cell.json"), "cell\n"),
      writeFile(path.join(staging, "baseline", "ledger.jsonl"), "ledger\n"),
    ]);

    await publishRuntimeLaneStaging(archiveRoot, staging);

    const canonical = runtimeLaneCanonicalRoot(archiveRoot);
    await expect(
      readFile(path.join(canonical, "cells", "cell.json"), "utf8"),
    ).resolves.toBe("cell\n");
    await expect(
      readFile(path.join(canonical, "baseline", "ledger.jsonl"), "utf8"),
    ).resolves.toBe("ledger\n");
  });
});
