// Minimal profile cast: one product owner and one non-owner colleague.

import type { SeedProduct } from "../support/seed-constants.js";
import {
  LEAD_1_ID,
  LEAD_MARIA_ID,
  SEED_PRODUCTS,
} from "../support/seed-constants.js";
import type { DemoLead, DemoProduct } from "./seed-demo.types.js";

function requireProductId(product: SeedProduct | undefined): string {
  if (!product)
    throw new Error("seed-demo: expected canonical product missing");
  return product.id;
}

const PROD_PORTAL = requireProductId(SEED_PRODUCTS[0]); // Маркетинговый портал

const VASILY_LABEL = "Василий И.";
const MARIA_LABEL = "Мария К.";

export const DEMO_LEADS: readonly DemoLead[] = [
  {
    id: LEAD_1_ID,
    email: "lead1@weeklyreport.local",
    name: VASILY_LABEL,
    samlId: "lead-1",
  },
  {
    id: LEAD_MARIA_ID,
    email: "maria@weeklyreport.local",
    name: MARIA_LABEL,
    samlId: "lead-maria",
  },
];

export const DEMO_PRODUCTS: readonly DemoProduct[] = [
  { id: PROD_PORTAL, name: "Маркетинговый портал", leadId: LEAD_1_ID },
];
