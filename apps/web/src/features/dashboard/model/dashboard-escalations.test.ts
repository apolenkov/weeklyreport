import { describe, expect, it } from "vitest";

import {
  escalationToBlockedItem,
  groupByProduct,
} from "./dashboard-escalations";

const FIRST_PRODUCT_ID = "10000000-0000-4000-8000-000000000001";
const SECOND_PRODUCT_ID = "10000000-0000-4000-8000-000000000002";
const AUTHOR_ID = "10000000-0000-4000-8000-000000000003";

describe("escalationToBlockedItem", () => {
  it("maps an escalation without synthesizing a persisted-looking id", () => {
    const item = escalationToBlockedItem({
      type: "blocked",
      productId: FIRST_PRODUCT_ID,
      productName: "Analytics",
      stageName: "Development",
      authorId: AUTHOR_ID,
      leadName: "Bob Lead",
      description: "ETL memory leak",
    });

    expect(item).toEqual({
      productId: FIRST_PRODUCT_ID,
      authorId: AUTHOR_ID,
      severity: "blocked",
      product: "Analytics",
      stage: "Development",
      assignee: "Bob L.",
      description: "ETL memory leak",
    });
    // Product/author identities are real; an escalation record id is not.
    expect("id" in item).toBe(false);
  });

  it("keeps distinct same-name products in separate identity groups", () => {
    const item = (productId: string, description: string) =>
      escalationToBlockedItem({
        type: "at_risk",
        productId,
        productName: "Platform",
        stageName: null,
        authorId: AUTHOR_ID,
        leadName: "Alex Lead",
        description,
      });

    expect(
      groupByProduct([
        item(FIRST_PRODUCT_ID, "First product"),
        item(SECOND_PRODUCT_ID, "Second product"),
      ]).map((group) => ({
        productId: group.productId,
        descriptions: group.items.map(({ description }) => description),
      })),
    ).toEqual([
      { productId: FIRST_PRODUCT_ID, descriptions: ["First product"] },
      { productId: SECOND_PRODUCT_ID, descriptions: ["Second product"] },
    ]);
  });
});
