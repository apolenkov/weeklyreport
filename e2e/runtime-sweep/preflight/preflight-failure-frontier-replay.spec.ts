import { expect, test } from "@playwright/test";

test("failure-frontier replay stays in the isolated diagnostic mode", () => {
  expect(process.env.RUNTIME_SWEEP_PREFLIGHT_MODE).toBe("capacity-survey");
});
