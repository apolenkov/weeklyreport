// The canonical product and SDLC-stage catalogues: 12 products (2 per lead) and
// 7 stages. IDs and lead assignments are the stable keys UUID-keyed fixtures and
// E2E assertions rely on; product names are RU Cyrillic demo data.

import {
  LEAD_1_ID,
  LEAD_DMITRY_ID,
  LEAD_IGOR_ID,
  LEAD_MARIA_ID,
  LEAD_OLGA_ID,
  LEAD_SERGEY_ID,
} from "./seed-identifiers.js";

export interface SeedProduct {
  id: string;
  name: string;
  leadId: string;
}

export const SEED_PRODUCTS: readonly SeedProduct[] = [
  {
    id: "a0000000-0000-4000-8000-000000000201",
    name: "Маркетинговый портал",
    leadId: LEAD_1_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000202",
    name: "Аналитический хаб",
    leadId: LEAD_1_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000203",
    name: "Платформа интеграций",
    leadId: LEAD_MARIA_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000204",
    name: "Платформа e-commerce",
    leadId: LEAD_MARIA_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000205",
    name: "Внутренний BI",
    leadId: LEAD_IGOR_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000206",
    name: "AI/ML конвейер",
    leadId: LEAD_IGOR_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000207",
    name: "DevOps-инструменты",
    leadId: LEAD_DMITRY_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000208",
    name: "Шлюз безопасности",
    leadId: LEAD_DMITRY_ID,
  },
  {
    id: "a0000000-0000-4000-8000-000000000209",
    name: "Платёжный шлюз",
    leadId: LEAD_OLGA_ID,
  },
  {
    id: "a0000000-0000-4000-8000-00000000020a",
    name: "Партнёрский портал",
    leadId: LEAD_OLGA_ID,
  },
  {
    id: "a0000000-0000-4000-8000-00000000020b",
    name: "HR-система",
    leadId: LEAD_SERGEY_ID,
  },
  {
    id: "a0000000-0000-4000-8000-00000000020c",
    name: "Учёт ресурсов",
    leadId: LEAD_SERGEY_ID,
  },
] as const;

export interface SeedStage {
  id: string;
  name: string;
  sortOrder: number;
}

// Full names ('Development', not 'Dev') because the admin E2E assertions match
// the admin mock STAGE_NAMES verbatim.
export const SEED_STAGES: readonly SeedStage[] = [
  {
    id: "a0000000-0000-4000-8000-000000000701",
    name: "Planning",
    sortOrder: 0,
  },
  {
    id: "a0000000-0000-4000-8000-000000000702",
    name: "Analysis",
    sortOrder: 1,
  },
  { id: "a0000000-0000-4000-8000-000000000703", name: "Design", sortOrder: 2 },
  {
    id: "a0000000-0000-4000-8000-000000000704",
    name: "Development",
    sortOrder: 3,
  },
  { id: "a0000000-0000-4000-8000-000000000705", name: "Testing", sortOrder: 4 },
  { id: "a0000000-0000-4000-8000-000000000706", name: "DevOps", sortOrder: 5 },
  { id: "a0000000-0000-4000-8000-000000000707", name: "Support", sortOrder: 6 },
] as const;
