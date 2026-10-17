import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const require = createRequire(import.meta.url);

// The conditional wrapper depends on these native KEYS/ARGV and cleanup bytes.
const REVIEWED_NATIVE_CONTENT_SHA256 =
  "f2acb16fda20ccac200abd5289a8910e48870d454c1577b19bd375ab809bb4b6";

describe("BullMQ terminal-removal dependency contract", () => {
  it("requires the reviewed BullMQ version and native removal signature", () => {
    const { removeJob } = z
      .object({
        removeJob: z.object({
          name: z.string(),
          content: z.string(),
          keys: z.number().int(),
        }),
      })
      .parse(require("bullmq/dist/cjs/scripts/removeJob-2.js"));
    const metadata: unknown = JSON.parse(
      readFileSync(require.resolve("bullmq/package.json"), "utf8"),
    );
    expect(
      metadata,
      "Re-review native terminal-removal compatibility when BullMQ changes",
    ).toMatchObject({ name: "bullmq", version: "6.3.16" });
    expect({ name: removeJob.name, keys: removeJob.keys }).toEqual({
      name: "removeJob",
      keys: 2,
    });

    expect(
      createHash("sha256").update(removeJob.content).digest("hex"),
      "Re-review native compiled cleanup and its KEYS[1..2]/ARGV[1..3] contract",
    ).toBe(REVIEWED_NATIVE_CONTENT_SHA256);
  });
});
