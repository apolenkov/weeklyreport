import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { withOwnedResource } from "./owned-resource.ts";

void describe("withOwnedResource", () => {
  void it("closes the resource after a successful callback", async (context) => {
    const close = context.mock.fn(() => Promise.resolve());
    const use = context.mock.fn(() => Promise.resolve("result"));

    const result = await withOwnedResource(
      () => Promise.resolve({ close }),
      use,
    );

    assert.equal(result, "result");
    assert.equal(use.mock.callCount(), 1);
    assert.equal(close.mock.callCount(), 1);
  });

  void it("closes the resource when the callback throws", async (context) => {
    const close = context.mock.fn(() => Promise.resolve());
    const failure = new Error("test callback failed");
    const use = context.mock.fn(() => Promise.reject(failure));

    await assert.rejects(
      withOwnedResource(() => Promise.resolve({ close }), use),
      (error) => error === failure,
    );
    assert.equal(use.mock.callCount(), 1);
    assert.equal(close.mock.callCount(), 1);
  });

  void it("reports both the callback and cleanup failures", async () => {
    const useFailure = new Error("test callback failed");
    const closeFailure = new Error("context close failed");

    await assert.rejects(
      withOwnedResource(
        () =>
          Promise.resolve({
            close: () => Promise.reject(closeFailure),
          }),
        () => Promise.reject(useFailure),
      ),
      (error: unknown) =>
        error instanceof AggregateError &&
        error.errors[0] === useFailure &&
        error.errors[1] === closeFailure,
    );
  });
});
