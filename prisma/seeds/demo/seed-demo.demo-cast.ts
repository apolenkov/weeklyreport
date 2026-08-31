// demo profile cast — role-shaped co-ownership across Vasily's three products.
// Vasily owns Development everywhere (+ Planning on BI); Maria owns Testing;
// Igor owns DevOps. The same colleague owns the same stage on each product
// (consistent, not random). BI leaves only Support unowned to show a vacant role.

import type { SeedProduct } from "../support/seed-constants.js";
import {
  LEAD_1_ID,
  LEAD_IGOR_ID,
  LEAD_MARIA_ID,
  SEED_PRODUCTS,
} from "../support/seed-constants.js";
import type { DemoLead, DemoProduct } from "./seed-demo.types.js";

function requireProductId(product: SeedProduct | undefined): string {
  if (!product)
    throw new Error("seed-demo: expected canonical product missing");
  return product.id;
}

export const PROD_PORTAL = requireProductId(SEED_PRODUCTS[0]); // Маркетинговый портал
export const PROD_INTEGRATIONS = requireProductId(SEED_PRODUCTS[2]); // Платформа интеграций
export const PROD_BI = requireProductId(SEED_PRODUCTS[4]); // Внутренний BI

export const VASILY_LABEL = "Василий И.";
export const MARIA_LABEL = "Мария К.";
export const IGOR_LABEL = "Игорь В.";

export const DEMO_LEADS: readonly DemoLead[] = [
  {
    id: LEAD_1_ID,
    email: "lead1@customreport.local",
    name: VASILY_LABEL,
    samlId: "lead-1",
  },
  {
    id: LEAD_MARIA_ID,
    email: "maria@customreport.local",
    name: MARIA_LABEL,
    samlId: "lead-maria",
  },
  {
    id: LEAD_IGOR_ID,
    email: "igor@customreport.local",
    name: IGOR_LABEL,
    samlId: "lead-igor",
  },
];

export const DEMO_PRODUCTS: readonly DemoProduct[] = [
  { id: PROD_PORTAL, name: "Маркетинговый портал", leadId: LEAD_1_ID },
  { id: PROD_INTEGRATIONS, name: "Платформа интеграций", leadId: LEAD_1_ID },
  { id: PROD_BI, name: "Внутренний BI", leadId: LEAD_1_ID },
];
