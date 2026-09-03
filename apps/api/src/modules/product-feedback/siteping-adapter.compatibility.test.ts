import {
  createSitepingHandler,
  type SitepingStore,
} from "@siteping/adapter-prisma";
import { describe, expect, it } from "vitest";

describe("pinned SitePing adapter compatibility", () => {
  it("exposes the handler factory and consumed store methods", () => {
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
