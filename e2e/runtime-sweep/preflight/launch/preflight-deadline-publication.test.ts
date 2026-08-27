import { access, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { publishDeadlineBound } from "./preflight-deadline-publication.ts";

describe("deadline-bound publication", () => {
  it("rolls back a final file when cleanup fails after ownership transfers", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "deadline-publication-"));
    const finalPath = path.join(root, "PARENT_PASS.json");
    try {
      await expect(
        publishDeadlineBound({
          publish: async (markOwned) => {
            await writeFile(finalPath, "published", { flag: "wx" });
            markOwned();
            throw new Error("temporary cleanup failed");
          },
          rollback: () => unlink(finalPath),
        }),
      ).rejects.toThrow("temporary cleanup failed");
      await expect(access(finalPath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves publication and rollback failures together", async () => {
    const publicationFailure = new Error("publication failed after create");
    const rollbackFailure = new Error("rollback failed");
    const failure = await publishDeadlineBound({
      publish: (markOwned) => {
        markOwned();
        return Promise.reject(publicationFailure);
      },
      rollback: () => Promise.reject(rollbackFailure),
    }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([
      publicationFailure,
      rollbackFailure,
    ]);
  });
});
