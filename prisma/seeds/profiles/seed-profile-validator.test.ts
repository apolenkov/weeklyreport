import { describe, expect, it } from "vitest";

import { assertProjectGroupIntegrity } from "./seed-profile-validator.js";

const LEAD = "a0000000-0000-4000-8000-000000000001";
const GROUP = "a0000000-0000-4000-8000-000000000002";
const OTHER_GROUP = "a0000000-0000-4000-8000-000000000003";
const PRODUCT = "a0000000-0000-4000-8000-000000000004";

describe("seed profile product-group integrity", () => {
  it("accepts the product edge that matches its lead's effective group", () => {
    expect(() =>
      assertProjectGroupIntegrity(
        "full",
        [{ id: LEAD, reportingGroupId: GROUP }],
        [{ id: PRODUCT, leadId: LEAD, groupProducts: [{ groupId: GROUP }] }],
      ),
    ).not.toThrow();
  });

  it("rejects a product edge assigned to another group", () => {
    expect(() =>
      assertProjectGroupIntegrity(
        "full",
        [{ id: LEAD, reportingGroupId: GROUP }],
        [
          {
            id: PRODUCT,
            leadId: LEAD,
            groupProducts: [{ groupId: OTHER_GROUP }],
          },
        ],
      ),
    ).toThrow(/product-group integrity failed/);
  });
});
