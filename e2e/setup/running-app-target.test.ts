import assert from "node:assert";
import test from "node:test";

import {
  assertRunningAppTarget,
  RUNTIME_TARGET_URL,
} from "./running-app-target.js";

const SIGNAL = new AbortController().signal;

function trpcResponse(json: unknown, status = 200): Response {
  return new Response(JSON.stringify({ result: { data: { json } } }), {
    status,
  });
}

async function expectRejection(
  response: Response | Error,
  includes: string,
): Promise<void> {
  await assert.rejects(
    assertRunningAppTarget(SIGNAL, () =>
      response instanceof Error
        ? Promise.reject(response)
        : Promise.resolve(response),
    ),
    (error: unknown) => {
      assert(error instanceof Error);
      assert(
        error.message.includes(includes),
        `Expected message to include "${includes}", got: ${error.message}`,
      );
      return true;
    },
  );
}

void test("accepts an app on customreport_e2e and Redis DB 15", async () => {
  let requested = "";
  await assertRunningAppTarget(SIGNAL, (url) => {
    requested = url;
    return Promise.resolve(
      trpcResponse({ database: "customreport_e2e", redisDb: 15 }),
    );
  });
  assert.strictEqual(requested, RUNTIME_TARGET_URL);
});

void test("rejects an app on another database", async () => {
  await expectRejection(
    trpcResponse({ database: "customreport", redisDb: 15 }),
    "customreport_e2e",
  );
});

void test("rejects an app whose Redis clients use DB 0", async () => {
  await expectRejection(
    trpcResponse({ database: "customreport_e2e", redisDb: 0 }),
    "Redis DB 15",
  );
});

void test("rejects a malformed probe body", async () => {
  await expectRejection(
    trpcResponse({ database: "customreport_e2e" }),
    "unexpected body",
  );
});

void test("rejects an app without the probe procedure", async () => {
  await expectRejection(new Response("{}", { status: 404 }), "HTTP 404");
});

void test("rejects an unreachable app", async () => {
  await expectRejection(new Error("connect ECONNREFUSED"), "ECONNREFUSED");
});

void test("a lane run accepts only its own database and Redis DB", async () => {
  const previous = process.env.E2E_LANE;
  process.env.E2E_LANE = "a";
  try {
    await assertRunningAppTarget(SIGNAL, () =>
      Promise.resolve(
        trpcResponse({ database: "customreport_e2e_lane_a_test", redisDb: 1 }),
      ),
    );
    await expectRejection(
      trpcResponse({ database: "customreport_e2e", redisDb: 15 }),
      "customreport_e2e_lane_a_test",
    );
    await expectRejection(
      trpcResponse({ database: "customreport_e2e_lane_b_test", redisDb: 2 }),
      "customreport_e2e_lane_a_test",
    );
    await expectRejection(
      trpcResponse({ database: "customreport_e2e_lane_a_test", redisDb: 2 }),
      "Redis DB 1",
    );
  } finally {
    if (previous === undefined) delete process.env.E2E_LANE;
    else process.env.E2E_LANE = previous;
  }
});
