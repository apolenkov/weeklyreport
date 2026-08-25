import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  readFile: vi.fn(),
}));

import { readSourceArtifact } from "./source-artifact.ts";

describe("source artifact IO taxonomy", () => {
  it("preserves a generic filesystem failure by reference", async () => {
    const infrastructure = Object.assign(new Error("storage unavailable"), {
      code: "EIO",
    });
    vi.mocked(readFile).mockRejectedValueOnce(infrastructure);

    await expect(readSourceArtifact("/archive/SOURCE.json")).rejects.toBe(
      infrastructure,
    );
  });
});
