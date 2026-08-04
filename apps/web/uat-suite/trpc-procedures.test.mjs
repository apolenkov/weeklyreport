import assert from "node:assert/strict";
import test from "node:test";

import { assertUniqueProcedurePaths } from "./trpc-procedures.mjs";

test("accepts distinct fully-qualified procedure paths", () => {
  const procedures = [
    { namespace: "admin", name: "list", kind: "query" },
    { namespace: "reports", name: "list", kind: "query" },
  ];
  assert.equal(assertUniqueProcedurePaths(procedures), procedures);
});

test("rejects duplicate fully-qualified procedure paths", () => {
  assert.throws(
    () =>
      assertUniqueProcedurePaths([
        { namespace: "admin", name: "save", kind: "query" },
        { namespace: "admin", name: "save", kind: "mutation" },
      ]),
    /duplicate tRPC procedure path admin\.save: query conflicts with mutation/,
  );
});
