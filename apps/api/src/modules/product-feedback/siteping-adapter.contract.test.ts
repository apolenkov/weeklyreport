import {
  createSitepingHandler,
  type SitepingStore,
} from "@siteping/adapter-prisma";
import { describe, expect, it } from "vitest";

describe("SitePing adapter contract", () => {
  it("exposes the handler factory and store APIs used by WeeklyReport", () => {
    expect(createSitepingHandler).toBeTypeOf("function");
    const consumedMethods: readonly (keyof SitepingStore)[] = [
      "createFeedback",
      "getFeedbacks",
      "findByClientId",
      "updateFeedback",
      "deleteFeedback",
      "deleteAllFeedbacks",
      "verifyProjectOwnership",
    ];
    expect(consumedMethods).toHaveLength(7);
  });
});
