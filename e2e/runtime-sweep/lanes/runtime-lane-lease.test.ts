import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { acquireRuntimeLaneLease } from "./runtime-lane-lease.ts";

describe("runtime lane lease", () => {
  it("rejects a second owner while the first process holds canonical resources", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "runtime-lane-lease-"));
    const lock = path.join(root, "lease");
    const first = await acquireRuntimeLaneLease("/archive/first.json", lock);

    await expect(
      acquireRuntimeLaneLease("/archive/second.json", lock),
    ).rejects.toThrow(/leased by pid=/u);
    expect(await readFile(path.join(lock, "owner.json"), "utf8")).toContain(
      "/archive/first.json",
    );

    await first.release();
    const second = await acquireRuntimeLaneLease("/archive/second.json", lock);
    await second.release();
  });
});
