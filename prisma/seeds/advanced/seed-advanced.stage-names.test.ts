import { describe, expect, it } from "vitest";

import {
  LEAD_1_ID,
  LEAD_OLGA_ID,
  SEED_PRODUCTS,
  SEED_STAGES,
} from "../support/seed-constants.js";
import {
  PRODUCT_MARKETING_PORTAL,
  PRODUCT_PAYMENT_GATEWAY,
} from "./seed-advanced.anchors.js";
import {
  ownedStageName,
  ownedStageNameAt,
  ownedStageNames,
} from "./seed-advanced.stage-names.js";

const STAGE_NAMES = SEED_STAGES.map((stage) => stage.name);

describe("advanced seed stage selection", () => {
  it("resolves owned stage names for every seeded product lead", () => {
    for (const product of SEED_PRODUCTS) {
      const names = ownedStageNames(product.leadId, product.id);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        expect(STAGE_NAMES).toContain(name);
      }
    }
  });

  it("cycles only owned stages for repeated rows on one product", () => {
    for (let seed = 0; seed < 12; seed += 1) {
      expect(ownedStageNames(LEAD_OLGA_ID, PRODUCT_PAYMENT_GATEWAY)).toContain(
        ownedStageNameAt(LEAD_OLGA_ID, PRODUCT_PAYMENT_GATEWAY, seed),
      );
    }
  });

  it("keeps an owned preferred stage", () => {
    expect(
      ownedStageName(LEAD_OLGA_ID, PRODUCT_PAYMENT_GATEWAY, "DevOps"),
    ).toBe("DevOps");
  });

  it("moves an unowned preference to the nearest owned stage", () => {
    // The primary lead owns Planning/Analysis/Design on the marketing portal.
    expect(
      ownedStageName(LEAD_1_ID, PRODUCT_MARKETING_PORTAL, "Development"),
    ).toBe("Design");
  });

  it("rejects a lead with no assignment on the product", () => {
    expect(() =>
      ownedStageNameAt(LEAD_OLGA_ID, PRODUCT_MARKETING_PORTAL, 0),
    ).toThrow(/owns no stage/);
  });
});
