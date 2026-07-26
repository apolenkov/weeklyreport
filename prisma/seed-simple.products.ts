import type { PrismaClient } from "@prisma/client";

import {
  DEFAULT_REPORTING_GROUP_ID,
  FINANCE_GROUP_ID,
  LEAD_1,
  LEAD_DMITRY,
  LEAD_IGOR,
  LEAD_MARIA,
  LEAD_OLGA,
  LEAD_SERGEY,
  PROD_CLOUD,
  PROD_CRM,
  PROD_CRM_360,
  PROD_CRM_DATA,
  PROD_CRM_SALES,
  PROD_DEVOPS,
  PROD_HR,
  PROD_MOBILE,
  PROD_PAYMENTS,
} from "./seed-simple.ids.js";

const PRODUCT_ROWS = [
  { id: PROD_CRM, name: "Маркетинговый портал", leadId: LEAD_1 },
  { id: PROD_MOBILE, name: "Платформа интеграций", leadId: LEAD_MARIA },
  { id: PROD_CLOUD, name: "Внутренний BI", leadId: LEAD_IGOR },
  { id: PROD_DEVOPS, name: "DevOps-инструменты", leadId: LEAD_DMITRY },
  { id: PROD_PAYMENTS, name: "Платёжный шлюз", leadId: LEAD_OLGA },
  { id: PROD_HR, name: "HR-система", leadId: LEAD_SERGEY },
  // Vasily's extra products for small-MVP demo (product-switcher needs ≥2)
  { id: PROD_CRM_SALES, name: "CRM-Sales Hub", leadId: LEAD_1 },
  { id: PROD_CRM_DATA, name: "CRM-Data Lake", leadId: LEAD_1 },
  { id: PROD_CRM_360, name: "CRM-Customer 360", leadId: LEAD_1 },
].map((product) => ({ ...product, archived: false }));

// GroupProduct: one owning group per product (@@unique([productId])). Product
// group is the report grouping source of truth, so every product gets an
// explicit edge that matches its lead's reporting group.
const GROUP_PRODUCT_ROWS = [
  { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_CRM },
  { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_MOBILE },
  { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_CLOUD },
  { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_DEVOPS },
  { groupId: FINANCE_GROUP_ID, productId: PROD_PAYMENTS },
  { groupId: FINANCE_GROUP_ID, productId: PROD_HR },
  // Vasily's extra products belong to the same group as PROD_CRM
  { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_CRM_SALES },
  { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_CRM_DATA },
  { groupId: DEFAULT_REPORTING_GROUP_ID, productId: PROD_CRM_360 },
];

export async function seedProducts(prisma: PrismaClient): Promise<void> {
  console.log("[seed-simple] Creating products (RU names)...");
  await prisma.project.createMany({ data: PRODUCT_ROWS });
  await prisma.groupProduct.createMany({
    data: GROUP_PRODUCT_ROWS,
    skipDuplicates: true,
  });
}
