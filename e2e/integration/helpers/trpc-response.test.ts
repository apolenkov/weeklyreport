import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { performAfterListenerArmed } from "./trpc-response.ts";

void describe("performAfterListenerArmed", () => {
  void it("arms the listener before invoking the action", async (context) => {
    const response = { id: "response" };
    const armListener = context.mock.fn(() => Promise.resolve(response));
    const action = context.mock.fn(() => {
      assert.equal(armListener.mock.callCount(), 1);
      return Promise.resolve();
    });

    const result = await performAfterListenerArmed(armListener, action);

    assert.equal(result, response);
    assert.equal(action.mock.callCount(), 1);
  });
});
