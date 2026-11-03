import assert from "node:assert/strict";

import pg from "pg";
import superjson from "superjson";

import { validateE2eRuntimeTarget } from "../setup/runtime-target.js";
import { command, headSession } from "./browser.js";
import { waitSnapshot } from "./helpers.js";

export async function assertMutation(procedure: string, expected: object) {
  const session = headSession();
  await waitSnapshot(
    async () => {
      const { requests } = await command(["network", "requests"], session);
      assert(Array.isArray(requests));
      const matches = requests.filter((request: unknown) => {
        assert(typeof request === "object" && request !== null);
        if (
          !("url" in request) ||
          typeof request.url !== "string" ||
          !request.url.includes(procedure)
        )
          return false;
        if (
          !("method" in request) ||
          request.method !== "POST" ||
          !("postData" in request)
        )
          return false;
        assert(typeof request.postData === "string");
        const paths = decodeURIComponent(new URL(request.url).pathname)
          .split("/trpc/")[1]
          ?.split(",");
        assert(paths);
        const batch: unknown = JSON.parse(request.postData);
        assert(typeof batch === "object" && batch !== null);
        const key = String(paths.indexOf(procedure));
        assert(key in batch);
        const input = superjson.parse(JSON.stringify(Reflect.get(batch, key)));
        assert.partialDeepStrictEqual(input, expected);
        return true;
      });
      if (matches.length === 0) return false;
      assert.equal(matches.length, 1, `Expected one ${procedure} POST`);
      return true;
    },
    `Expected ${procedure} request anchor`,
    session,
  );
}

export async function assertPersistedVerdict(
  sectionId: string,
  version: number,
): Promise<void> {
  const session = headSession();
  const target = validateE2eRuntimeTarget("e2e-verdict-check");
  const pool = new pg.Pool({ connectionString: target.e2eDatabaseUrl });
  try {
    await waitSnapshot(
      async () => {
        const result = await pool.query<{
          verdict: string;
          judgedVersion: number;
        }>(
          'SELECT verdict, "judgedVersion" FROM "SectionReview" WHERE "reportSectionId" = $1',
          [sectionId],
        );
        return (
          result.rows.length === 1 &&
          result.rows[0]?.verdict === "approved" &&
          result.rows[0].judgedVersion === version
        );
      },
      "Expected one persisted approval for the submitted version",
      session,
    );
  } finally {
    await pool.end();
  }
}
