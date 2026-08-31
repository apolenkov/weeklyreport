import {
  type ItemWorkflowStatus,
  ReportSectionStatus,
  TrafficLightStatus,
} from "@prisma/client";

import {
  LEAD_1,
  LEAD_CLOUD_PM,
  LEAD_DEVOPS_PM,
  LEAD_DMITRY,
  LEAD_IGOR,
  LEAD_MARIA,
  LEAD_MOBILE_PM,
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

// `name` is the FULL display name and seeds each decision's `owner` as a label
// only — edit/delete rights come from the section's authorId, not this string.
// `label` is the short chip form, used only in demo prose.
export interface LeadCfg {
  id: string;
  productId: string;
  status: ReportSectionStatus;
  lightStatus: TrafficLightStatus;
  label: string;
  name: string;
}

// Active report — one section per lead, with a status / traffic-light mix so
// the dashboard has visible variety.
export const LEADS: readonly LeadCfg[] = [
  {
    id: LEAD_1,
    productId: PROD_CRM,
    status: ReportSectionStatus.draft,
    lightStatus: TrafficLightStatus.red,
    label: "Василий И.",
    name: "Иванов Василий Петрович",
  },
  {
    id: LEAD_MARIA,
    productId: PROD_MOBILE,
    status: ReportSectionStatus.submitted,
    lightStatus: TrafficLightStatus.yellow,
    label: "Мария К.",
    name: "Каштанова Мария Андреевна",
  },
  {
    id: LEAD_IGOR,
    productId: PROD_CLOUD,
    status: ReportSectionStatus.draft,
    lightStatus: TrafficLightStatus.green,
    label: "Игорь В.",
    name: "Ветров Игорь Олегович",
  },
  {
    id: LEAD_DMITRY,
    productId: PROD_DEVOPS,
    status: ReportSectionStatus.submitted,
    lightStatus: TrafficLightStatus.green,
    label: "Дмитрий С.",
    name: "Соснов Дмитрий Максимович",
  },
  {
    id: LEAD_OLGA,
    productId: PROD_PAYMENTS,
    status: ReportSectionStatus.draft,
    lightStatus: TrafficLightStatus.yellow,
    label: "Ольга Н.",
    name: "Незабудкина Ольга Сергеевна",
  },
  {
    id: LEAD_SERGEY,
    productId: PROD_HR,
    status: ReportSectionStatus.draft,
    lightStatus: TrafficLightStatus.green,
    label: "Сергей Т.",
    name: "Тополев Сергей Дмитриевич",
  },
  // PM leads — non-technical, Plan/Analysis/Design focus
  {
    id: LEAD_MOBILE_PM,
    productId: PROD_MOBILE,
    status: ReportSectionStatus.draft,
    lightStatus: TrafficLightStatus.yellow,
    label: "Борис С.",
    name: "Сиренев Борис",
  },
  {
    id: LEAD_CLOUD_PM,
    productId: PROD_CLOUD,
    status: ReportSectionStatus.draft,
    lightStatus: TrafficLightStatus.green,
    label: "Виктор Л.",
    name: "Липов Виктор",
  },
  {
    id: LEAD_DEVOPS_PM,
    productId: PROD_DEVOPS,
    status: ReportSectionStatus.draft,
    lightStatus: TrafficLightStatus.yellow,
    label: "Галина М.",
    name: "Малиновая Галина",
  },
];

export const ALL_PRODUCT_IDS: readonly string[] = [
  PROD_CRM,
  PROD_MOBILE,
  PROD_CLOUD,
  PROD_DEVOPS,
  PROD_PAYMENTS,
  PROD_HR,
  PROD_CRM_SALES,
  PROD_CRM_DATA,
  PROD_CRM_360,
];

// Russian weekly narrative for one lead; the per-group seed data below fills it in.
export interface LeadContent {
  currentItems: {
    text: string;
    tag: string;
    status: ItemWorkflowStatus;
    carriedOver?: boolean;
    pausedReason?: string;
  }[];
  nextItems: { text: string; tag: string; status?: ItemWorkflowStatus }[];
  risk?: {
    risk: string;
    impact: string;
    mitigation: string;
    severity: "at-risk" | "blocked";
  };
  decisions: {
    text: string;
    impact: string;
    deadline?: Date;
  }[];
  priorities: string[];
}
