/**
 * Mock data and type definitions for Dashboard and Weekly Report pages.
 * Real data will come from tRPC endpoints in a later phase.
 */
import type { RecordCommentView } from "@customreport/shared";

// ---- Shared Types ----

export type LeadStatus = "submitted" | "draft" | "pending";

export type ProductStatus = "on-track" | "at-risk" | "blocked";

export interface TrafficLight {
  status: ProductStatus;
  icon: string;
}

export interface LeadInfo {
  id: string;
  reportId?: string;
  initials: string;
  name: string;
  role: string;
  status: LeadStatus;
  trafficLights: TrafficLight[];
  lastActivity: string;
  isCurrentUser: boolean;
  productCount?: number;
  reportContentCount?: number;
}

// ---- Dashboard Types ----

export interface KpiData {
  submitted: number;
  total: number;
  lastWeekSubmitted: number;
  lastWeekTotal: number;
  pendingCount: number;
  deadlineLabel: string;
  deadlineTime: string;
  blockedCount: number;
  atRiskCount: number;
  decisionCount: number;
}

export interface BlockedAtRiskItem {
  id: string;
  severity: "blocked" | "at-risk";
  product: string;
  stage: string;
  assignee: string;
  description: string;
}

// ---- Weekly Report Types ----

export interface PortfolioProduct {
  id: string;
  initials: string;
  name: string;
  status: ProductStatus;
  statusLabel: string;
  leads: string;
  currentWeekCount: number;
  nextWeekCount: number;
  riskCount: number;
}

export interface ReportItem {
  id: string;
  stageLead: string;
  /** SDLC stage name for the accordion gutter; live data always sets it. */
  stage?: string;
  /** Contributing lead's initials for the gutter; live data always sets it. */
  owner?: string;
  text: string;
  // Mirrors the mapper ItemStatus union (rework-item-status-model) — keep the
  // two ReportItem declarations in sync (known dual-type hazard).
  status:
    | "in-progress"
    | "completed"
    | "planned"
    | "paused"
    | "postponed"
    | "blocked";
  /** Priority rank (1 = top) when the item is a flagged priority; null otherwise. */
  priorityRank?: number | null;
  /** review-acknowledgement: reviewer comments anchored to this item's DB id. */
  comments?: RecordCommentView[];
  /** review-acknowledgement: true when the current caller may review this row's group. */
  canReview?: boolean;
}

export interface ReportRisk {
  id: string;
  badge: string;
  /** SDLC stage name for the gutter; live data always sets it. */
  stage?: string;
  /** Contributing lead's initials for the gutter; live data always sets it. */
  owner?: string;
  severity: "blocked" | "at-risk";
  text: string;
  /** Structured fields for the risk row; live data always sets them. */
  problem?: string;
  impact?: string;
  mitigation?: string;
  /** review-acknowledgement: reviewer comments anchored to this risk's DB id. */
  comments?: RecordCommentView[];
  /** review-acknowledgement: true when the current caller may review this row's group. */
  canReview?: boolean;
}

export interface ReportDecision {
  id: string;
  badge: string;
  /** Contributing lead's initials for the gutter; live data always sets it. */
  owner?: string;
  text: string;
  /** review-acknowledgement: reviewer comments anchored to this decision's DB id. */
  comments?: RecordCommentView[];
  /** review-acknowledgement: true when the current caller may review this row's group. */
  canReview?: boolean;
}

export interface ReportPriority {
  rank: number;
  text: string;
}

export interface ProductReport {
  id: string;
  authorIds?: string[];
  initials: string;
  name: string;
  status: ProductStatus;
  statusLabel: string;
  leads: string;
  /**
   * Real `ReportSection.id` UUID for AI advisory wiring.
   * Threaded through `mapWeeklyReport` from the first lead section that
   * authored content for this product. Optional because not every product
   * has a submitting lead in every period.
   */
  sectionId?: string;
  needsAttention?: string;
  needsAttentionSeverity?: "blocked" | "at-risk";
  currentWeek: ReportItem[];
  nextWeek: ReportItem[];
  risks: ReportRisk[];
  decisions: ReportDecision[];
  priorities: ReportPriority[];
}

export interface ReportPeriod {
  id: string;
  weekLabel: string;
  dateRange: string;
  isCurrent: boolean;
}

// ---- Mock Data: Dashboard ----

export const MOCK_KPI: KpiData = {
  submitted: 4,
  total: 6,
  lastWeekSubmitted: 6,
  lastWeekTotal: 6,
  pendingCount: 2,
  deadlineLabel: "2d 5h",
  deadlineTime: "Friday 18:00",
  blockedCount: 2,
  atRiskCount: 3,
  decisionCount: 2,
};

export const MOCK_LEADS: LeadInfo[] = [
  {
    id: "lead1",
    initials: "AP",
    name: "Тимлид 1",
    role: "Dev Lead",
    status: "submitted",
    trafficLights: [
      { status: "on-track", icon: "\u2713" },
      { status: "blocked", icon: "\u2715" },
      { status: "at-risk", icon: "!" },
      { status: "on-track", icon: "\u2713" },
      { status: "on-track", icon: "\u2713" },
      { status: "on-track", icon: "\u2713" },
    ],
    lastActivity: "2h ago",
    isCurrentUser: true,
    productCount: 6,
  },
  {
    id: "maria",
    initials: "MK",
    name: "Maria K.",
    role: "QA Lead",
    status: "submitted",
    trafficLights: [
      { status: "on-track", icon: "\u2713" },
      { status: "on-track", icon: "\u2713" },
      { status: "blocked", icon: "\u2715" },
      { status: "on-track", icon: "\u2713" },
    ],
    lastActivity: "5h ago",
    isCurrentUser: false,
    productCount: 4,
  },
  {
    id: "igor",
    initials: "IV",
    name: "Igor V.",
    role: "Mobile Lead",
    status: "submitted",
    trafficLights: [
      { status: "at-risk", icon: "!" },
      { status: "on-track", icon: "\u2713" },
      { status: "on-track", icon: "\u2713" },
    ],
    lastActivity: "1d ago",
    isCurrentUser: false,
    productCount: 3,
  },
  {
    id: "dmitry",
    initials: "DS",
    name: "Dmitry S.",
    role: "Platform Lead",
    status: "submitted",
    trafficLights: [
      { status: "on-track", icon: "\u2713" },
      { status: "on-track", icon: "\u2713" },
      { status: "on-track", icon: "\u2713" },
      { status: "on-track", icon: "\u2713" },
      { status: "on-track", icon: "\u2713" },
    ],
    lastActivity: "3h ago",
    isCurrentUser: false,
    productCount: 5,
  },
  {
    id: "olga",
    initials: "ON",
    name: "Olga N.",
    role: "Auth Lead",
    status: "draft",
    trafficLights: [],
    lastActivity: "Saved 1h ago",
    isCurrentUser: false,
    productCount: 2,
  },
  {
    id: "sergey",
    initials: "ST",
    name: "Sergey T.",
    role: "Infra Lead",
    status: "pending",
    trafficLights: [],
    lastActivity: "Not started",
    isCurrentUser: false,
    productCount: 2,
  },
];

export const MOCK_BLOCKED_AT_RISK: BlockedAtRiskItem[] = [
  {
    id: "bar1",
    severity: "blocked",
    product: "Data Analytics",
    stage: "Dev",
    assignee: "Kozlov D.",
    description:
      "\u0423\u0442\u0435\u0447\u043A\u0430 \u043F\u0430\u043C\u044F\u0442\u0438 ETL, \u043F\u0430\u0442\u0447 \u0432\u0435\u043D\u0434\u043E\u0440\u0430 25 \u0430\u043F\u0440\u0435\u043B\u044F",
  },
  {
    id: "bar2",
    severity: "blocked",
    product: "Data Analytics",
    stage: "Testing",
    assignee: "Тимлид 1",
    description:
      "\u0422\u0435\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u2014 \u043E\u0436\u0438\u0434\u0430\u0435\u043C \u0444\u0438\u043A\u0441 Dev",
  },
  {
    id: "bar3",
    severity: "at-risk",
    product: "CRM Platform",
    stage: "Dev",
    assignee: "Тимлид 1",
    description:
      "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430 OAuth2 \u0438\u0437-\u0437\u0430 \u043B\u0438\u043C\u0438\u0442\u043E\u0432 API \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430",
  },
  {
    id: "bar4",
    severity: "at-risk",
    product: "Cloud Infrastructure",
    stage: "Dev",
    assignee: "Тимлид 1",
    description:
      "PgBouncer \u043C\u0438\u0433\u0440\u0430\u0446\u0438\u044F \u2014 downtime 30 \u043C\u0438\u043D",
  },
  {
    id: "bar5",
    severity: "at-risk",
    product: "Mobile Applications",
    stage: "Design+Dev",
    assignee: "Igor V.",
    description:
      "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430 \u0442\u043E\u043A\u0435\u043D\u043E\u0432 \u0434\u0438\u0437\u0430\u0439\u043D\u0430, \u0440\u0438\u0441\u043A \u0441\u0434\u0432\u0438\u0433\u0430 \u0441\u043F\u0440\u0438\u043D\u0442\u0430",
  },
];

export const MOCK_PENDING_LEADS = ["Olga N.", "Sergey T."];

// ---- Mock Data: Weekly Report ----

export const MOCK_REPORT_PERIODS: ReportPeriod[] = [
  {
    id: "2026-W16",
    weekLabel: "Week 16",
    dateRange: "Apr 14\u201320",
    isCurrent: true,
  },
  {
    id: "2026-W15",
    weekLabel: "Week 15",
    dateRange: "Apr 7\u201313",
    isCurrent: false,
  },
  {
    id: "2026-W14",
    weekLabel: "Week 14",
    dateRange: "Mar 31\u2013Apr 6",
    isCurrent: false,
  },
  {
    id: "2026-W13",
    weekLabel: "Week 13",
    dateRange: "Mar 24\u201330",
    isCurrent: false,
  },
  {
    id: "2026-W12",
    weekLabel: "Week 12",
    dateRange: "Mar 17\u201323",
    isCurrent: false,
  },
  {
    id: "2026-W11",
    weekLabel: "Week 11",
    dateRange: "Mar 10\u201316",
    isCurrent: false,
  },
];

export const MOCK_PORTFOLIO: PortfolioProduct[] = [
  {
    id: "crm",
    initials: "CR",
    name: "CRM Platform",
    status: "at-risk",
    statusLabel: "At Risk \u00B7 OAuth2 dependency delay",
    leads: "Тимлид 1 \u00B7 Maria K.",
    currentWeekCount: 5,
    nextWeekCount: 3,
    riskCount: 1,
  },
  {
    id: "analytics",
    initials: "DA",
    name: "Data Analytics Suite",
    status: "blocked",
    statusLabel: "Blocked \u00B7 ETL memory issue",
    leads: "Maria K. \u00B7 Тимлид 1",
    currentWeekCount: 4,
    nextWeekCount: 2,
    riskCount: 2,
  },
  {
    id: "mobile",
    initials: "MA",
    name: "Mobile Applications",
    status: "at-risk",
    statusLabel: "At Risk \u00B7 Navigation redesign",
    leads: "Igor V. \u00B7 Тимлид 1",
    currentWeekCount: 4,
    nextWeekCount: 1,
    riskCount: 1,
  },
  {
    id: "cloud",
    initials: "CI",
    name: "Cloud Infrastructure",
    status: "at-risk",
    statusLabel: "At Risk \u00B7 PgBouncer migration window",
    leads: "Тимлид 1 \u00B7 Sidorov P.",
    currentWeekCount: 3,
    nextWeekCount: 2,
    riskCount: 1,
  },
  {
    id: "aiml",
    initials: "AI",
    name: "AI/ML Platform",
    status: "on-track",
    statusLabel: "On Track \u00B7 Smirnov, lead 1",
    leads: "Smirnov K. \u00B7 Тимлид 1",
    currentWeekCount: 3,
    nextWeekCount: 2,
    riskCount: 0,
  },
  {
    id: "gateway",
    initials: "IG",
    name: "Integration Gateway",
    status: "on-track",
    statusLabel: "On Track \u00B7 lead 1",
    leads: "Тимлид 1",
    currentWeekCount: 2,
    nextWeekCount: 1,
    riskCount: 0,
  },
  {
    id: "payment",
    initials: "PG",
    name: "Payment Gateway",
    status: "on-track",
    statusLabel: "On Track \u00B7 Dmitry S.",
    leads: "Dmitry S.",
    currentWeekCount: 2,
    nextWeekCount: 1,
    riskCount: 0,
  },
  {
    id: "auth",
    initials: "AS",
    name: "Auth Service",
    status: "on-track",
    statusLabel: "On Track \u00B7 Olga N.",
    leads: "Olga N.",
    currentWeekCount: 2,
    nextWeekCount: 1,
    riskCount: 0,
  },
  {
    id: "notif",
    initials: "NH",
    name: "Notification Hub",
    status: "on-track",
    statusLabel: "On Track \u00B7 Sergey T.",
    leads: "Sergey T.",
    currentWeekCount: 2,
    nextWeekCount: 1,
    riskCount: 0,
  },
  {
    id: "admin",
    initials: "AP",
    name: "Admin Portal",
    status: "at-risk",
    statusLabel: "At Risk \u00B7 RBAC approval pending",
    leads: "Dmitry S.",
    currentWeekCount: 2,
    nextWeekCount: 0,
    riskCount: 1,
  },
  {
    id: "logging",
    initials: "LP",
    name: "Logging Platform",
    status: "on-track",
    statusLabel: "On Track \u00B7 Dmitry S.",
    leads: "Dmitry S.",
    currentWeekCount: 2,
    nextWeekCount: 1,
    riskCount: 0,
  },
  {
    id: "cdn",
    initials: "CD",
    name: "CDN Service",
    status: "on-track",
    statusLabel: "On Track \u00B7 Sergey T.",
    leads: "Sergey T.",
    currentWeekCount: 2,
    nextWeekCount: 1,
    riskCount: 0,
  },
];

export const MOCK_PRODUCT_REPORTS: ProductReport[] = [
  {
    id: "crm",
    initials: "CR",
    name: "CRM Platform",
    status: "at-risk",
    statusLabel: "At Risk",
    leads: "Тимлид 1 \u00B7 Maria K.",
    needsAttention:
      "OAuth2 integration is slowed by partner API limits, which pushes the SSO portal work into next week.",
    needsAttentionSeverity: "at-risk",
    currentWeek: [
      {
        id: "crm-cw1",
        stageLead: "Dev \u00B7 AP",
        text: "\u0418\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044F OAuth2 \u0434\u043B\u044F \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0441\u043A\u043E\u0433\u043E API",
        status: "in-progress",
      },
      {
        id: "crm-cw2",
        stageLead: "Dev \u00B7 AP",
        text: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 rate limiter \u0434\u043B\u044F API",
        status: "completed",
      },
      {
        id: "crm-cw3",
        stageLead: "Dev \u00B7 AP",
        text: "\u041E\u043F\u0442\u0438\u043C\u0438\u0437\u0430\u0446\u0438\u044F \u043F\u043E\u0438\u0441\u043A\u0430 \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u0432",
        status: "in-progress",
      },
      {
        id: "crm-cw4",
        stageLead: "Dev \u00B7 AP",
        text: "\u041B\u043E\u0433\u0438\u043A\u0430 \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0445 \u0432\u044B\u0437\u043E\u0432\u043E\u0432 webhook",
        status: "completed",
      },
      {
        id: "crm-cw5",
        stageLead: "Analysis \u00B7 MK",
        text: "\u0420\u0435\u0432\u044C\u044E \u0442\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u0439 \u043A \u043A\u043B\u0438\u0435\u043D\u0442\u0441\u043A\u043E\u043C\u0443 \u043F\u043E\u0440\u0442\u0430\u043B\u0443",
        status: "completed",
      },
    ],
    nextWeek: [
      {
        id: "crm-nw1",
        stageLead: "Planned",
        text: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0444\u0440\u0435\u0439\u043C\u0432\u043E\u0440\u043A\u0430 A/B \u0442\u0435\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F",
        status: "planned",
      },
      {
        id: "crm-nw2",
        stageLead: "Planned",
        text: "SSO \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044F \u043A\u043B\u0438\u0435\u043D\u0442\u0441\u043A\u043E\u0433\u043E \u043F\u043E\u0440\u0442\u0430\u043B\u0430",
        status: "planned",
      },
      {
        id: "crm-nw3",
        stageLead: "Planned",
        text: "MVP \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440\u0430 email \u0448\u0430\u0431\u043B\u043E\u043D\u043E\u0432",
        status: "planned",
      },
    ],
    risks: [
      {
        id: "crm-r1",
        badge: "CRM \u00B7 Dev",
        severity: "at-risk",
        text: "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430 OAuth2 \u0438\u0437-\u0437\u0430 \u043B\u0438\u043C\u0438\u0442\u043E\u0432 API \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430. \u0421\u0434\u0432\u0438\u0433 SSO \u043F\u043E\u0440\u0442\u0430\u043B\u0430 \u043D\u0430 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u043D\u0435\u0434\u0435\u043B\u044E.",
      },
    ],
    decisions: [],
    priorities: [
      {
        rank: 1,
        text: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C OAuth2 \u0434\u043B\u044F CRM Platform",
      },
      {
        rank: 2,
        text: "\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C SSO-\u043F\u043E\u0442\u043E\u043A \u0434\u043B\u044F \u043A\u043B\u0438\u0435\u043D\u0442\u0441\u043A\u043E\u0433\u043E \u043F\u043E\u0440\u0442\u0430\u043B\u0430",
      },
    ],
  },
  {
    id: "analytics",
    initials: "DA",
    name: "Data Analytics Suite",
    status: "blocked",
    statusLabel: "Blocked",
    leads: "Maria K. \u00B7 Тимлид 1",
    needsAttention:
      "ETL memory leak is the blocking issue for the analytics stream and needs the vendor patch before the release path can move.",
    needsAttentionSeverity: "blocked",
    currentWeek: [
      {
        id: "da-cw1",
        stageLead: "Dev \u00B7 MK",
        text: "\u0418\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0443\u0442\u0435\u0447\u043A\u0438 \u043F\u0430\u043C\u044F\u0442\u0438 \u0432 ETL \u043F\u0430\u0439\u043F\u043B\u0430\u0439\u043D\u0435",
        status: "blocked",
      },
      {
        id: "da-cw2",
        stageLead: "Analysis \u00B7 MK",
        text: "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 \u0434\u0430\u043D\u043D\u044B\u0445 \u0434\u043B\u044F BI \u0434\u0430\u0448\u0431\u043E\u0440\u0434\u0430",
        status: "in-progress",
      },
      {
        id: "da-cw3",
        stageLead: "Testing \u00B7 AP",
        text: "\u0420\u0435\u0433\u0440\u0435\u0441\u0441\u0438\u043E\u043D\u043D\u043E\u0435 \u0442\u0435\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 ETL \u043F\u0430\u0439\u043F\u043B\u0430\u0439\u043D\u0430",
        status: "in-progress",
      },
      {
        id: "da-cw4",
        stageLead: "Testing \u00B7 AP",
        text: "\u041D\u0430\u0433\u0440\u0443\u0437\u043E\u0447\u043D\u043E\u0435 \u0442\u0435\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 BI \u0434\u0430\u0448\u0431\u043E\u0440\u0434\u0430",
        status: "completed",
      },
    ],
    nextWeek: [
      {
        id: "da-nw1",
        stageLead: "Planned",
        text: "\u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u0432\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u0438 \u043A\u0430\u0447\u0435\u0441\u0442\u0432\u0430 \u0434\u0430\u043D\u043D\u044B\u0445",
        status: "planned",
      },
      {
        id: "da-nw2",
        stageLead: "Planned",
        text: "\u0410\u043B\u0435\u0440\u0442\u044B \u043E\u0431\u043D\u0430\u0440\u0443\u0436\u0435\u043D\u0438\u044F \u0430\u043D\u043E\u043C\u0430\u043B\u0438\u0439 \u0432 \u0440\u0435\u0430\u043B\u044C\u043D\u043E\u043C \u0432\u0440\u0435\u043C\u0435\u043D\u0438",
        status: "planned",
      },
    ],
    risks: [
      {
        id: "da-r1",
        badge: "Analytics \u00B7 Dev",
        severity: "blocked",
        text: "\u0423\u0442\u0435\u0447\u043A\u0430 \u043F\u0430\u043C\u044F\u0442\u0438 ETL, OOM \u043D\u0430 >10GB. \u041F\u0430\u0442\u0447 \u0432\u0435\u043D\u0434\u043E\u0440\u0430 \u043E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F 25 \u0430\u043F\u0440\u0435\u043B\u044F.",
      },
      {
        id: "da-r2",
        badge: "Analytics \u00B7 Testing",
        severity: "at-risk",
        text: "QA \u043E\u043A\u043D\u043E \u043C\u043E\u0436\u0435\u0442 \u0441\u0434\u0432\u0438\u043D\u0443\u0442\u044C\u0441\u044F \u043D\u0430 2\u20133 \u0434\u043D\u044F \u0438\u0437-\u0437\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0441\u0442\u0438 \u043A\u043E\u043C\u0430\u043D\u0434\u044B.",
      },
    ],
    decisions: [],
    priorities: [],
  },
  {
    id: "mobile",
    initials: "MA",
    name: "Mobile Applications",
    status: "at-risk",
    statusLabel: "At Risk",
    leads: "Igor V. \u00B7 Тимлид 1",
    needsAttention:
      "Navigation redesign is waiting on final design-system tokens, so the mobile sprint still has schedule risk.",
    needsAttentionSeverity: "at-risk",
    currentWeek: [
      {
        id: "ma-cw1",
        stageLead: "Design \u00B7 IV",
        text: "\u0420\u0435\u0434\u0438\u0437\u0430\u0439\u043D \u043D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u0438 iOS \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F",
        status: "in-progress",
      },
      {
        id: "ma-cw2",
        stageLead: "Dev \u00B7 IV",
        text: "\u0418\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044F push-\u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439 Android",
        status: "in-progress",
      },
      {
        id: "ma-cw3",
        stageLead: "DevOps \u00B7 AP",
        text: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 CI/CD \u0434\u043B\u044F iOS \u0441\u0431\u043E\u0440\u043E\u043A",
        status: "in-progress",
      },
      {
        id: "ma-cw4",
        stageLead: "Analysis \u00B7 IV",
        text: "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u043E\u0433\u043E \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F onboarding",
        status: "completed",
      },
    ],
    nextWeek: [
      {
        id: "ma-nw1",
        stageLead: "Planned",
        text: "MVP \u0441\u0435\u0440\u0432\u0438\u0441\u0430 push-\u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439",
        status: "planned",
      },
    ],
    risks: [
      {
        id: "ma-r1",
        badge: "Mobile",
        severity: "at-risk",
        text: "\u0422\u043E\u043A\u0435\u043D\u044B \u0434\u0438\u0437\u0430\u0439\u043D-\u0441\u0438\u0441\u0442\u0435\u043C\u044B \u043D\u0435 \u0444\u0438\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u044B, \u0435\u0441\u0442\u044C \u0440\u0438\u0441\u043A \u0441\u0434\u0432\u0438\u0433\u0430 \u043C\u043E\u0431\u0438\u043B\u044C\u043D\u043E\u0433\u043E \u0441\u043F\u0440\u0438\u043D\u0442\u0430.",
      },
    ],
    decisions: [],
    priorities: [],
  },
  {
    id: "cloud",
    initials: "CI",
    name: "Cloud Infrastructure",
    status: "at-risk",
    statusLabel: "At Risk",
    leads: "Тимлид 1 \u00B7 Sidorov P.",
    needsAttention:
      "PgBouncer migration still needs a coordinated maintenance window, so the infrastructure track remains at risk.",
    needsAttentionSeverity: "at-risk",
    currentWeek: [
      {
        id: "ci-cw1",
        stageLead: "Dev \u00B7 AP",
        text: "\u041C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433 K8s + \u0430\u043B\u0435\u0440\u0442\u044B Grafana",
        status: "completed",
      },
      {
        id: "ci-cw2",
        stageLead: "Dev \u00B7 AP",
        text: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u043F\u0443\u043B\u0430 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0439 PgBouncer",
        status: "in-progress",
      },
      {
        id: "ci-cw3",
        stageLead: "DevOps \u00B7 SP",
        text: "\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u043F\u043B\u0430\u043D\u0430 \u043C\u0438\u0433\u0440\u0430\u0446\u0438\u0438 \u0431\u0435\u0437 \u043E\u0442\u043A\u0430\u0442\u0430 SLA",
        status: "in-progress",
      },
    ],
    nextWeek: [
      {
        id: "ci-nw1",
        stageLead: "Planned",
        text: "\u041C\u0438\u0433\u0440\u0430\u0446\u0438\u044F CI/CD \u043D\u0430 GitHub Actions",
        status: "planned",
      },
      {
        id: "ci-nw2",
        stageLead: "Planned",
        text: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0430\u0432\u0430\u0440\u0438\u0439\u043D\u043E\u0433\u043E \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F \u0434\u043B\u044F PgBouncer",
        status: "planned",
      },
    ],
    risks: [
      {
        id: "ci-r1",
        badge: "Cloud \u00B7 Dev",
        severity: "at-risk",
        text: "PgBouncer \u043C\u0438\u0433\u0440\u0430\u0446\u0438\u044F \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u043E\u043A\u043D\u0430 downtime \u043E\u043A\u043E\u043B\u043E 30 \u043C\u0438\u043D\u0443\u0442 \u0438 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0439 \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0446\u0438\u0438.",
      },
    ],
    decisions: [
      {
        id: "ci-d1",
        badge: "Cloud",
        text: "\u041E\u0434\u043E\u0431\u0440\u0435\u043D\u0438\u0435 \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0433\u043E Redis \u043A\u043B\u0430\u0441\u0442\u0435\u0440\u0430 \u0434\u043B\u044F \u043A\u0435\u0448\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F",
      },
    ],
    priorities: [],
  },
  {
    id: "aiml",
    initials: "AI",
    name: "AI/ML Platform",
    status: "on-track",
    statusLabel: "On Track",
    leads: "Smirnov K. \u00B7 Тимлид 1",
    currentWeek: [
      {
        id: "ai-cw1",
        stageLead: "Testing \u00B7 AP",
        text: "\u041F\u0430\u0439\u043F\u043B\u0430\u0439\u043D \u043E\u0431\u0443\u0447\u0435\u043D\u0438\u044F \u043C\u043E\u0434\u0435\u043B\u0435\u0439 v2",
        status: "in-progress",
      },
      {
        id: "ai-cw2",
        stageLead: "Dev \u00B7 SK",
        text: "\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F \u0434\u043B\u044F model serving",
        status: "completed",
      },
      {
        id: "ai-cw3",
        stageLead: "DevOps \u00B7 SK",
        text: "\u0411\u0430\u0437\u043E\u0432\u044B\u0439 \u043C\u043E\u043D\u0438\u0442\u043E\u0440\u0438\u043D\u0433 GPU \u043D\u043E\u0434",
        status: "in-progress",
      },
    ],
    nextWeek: [
      {
        id: "ai-nw1",
        stageLead: "Planned",
        text: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0430\u0432\u0442\u043E\u0441\u043A\u0435\u0439\u043B\u0438\u043D\u0433\u0430 GPU \u043A\u043B\u0430\u0441\u0442\u0435\u0440\u0430",
        status: "planned",
      },
      {
        id: "ai-nw2",
        stageLead: "Planned",
        text: "\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0442\u0435\u0441\u0442\u043E\u0432\u043E\u0433\u043E \u043A\u043E\u043D\u0442\u0443\u0440\u0430 \u0434\u043B\u044F inference API",
        status: "planned",
      },
    ],
    risks: [],
    decisions: [
      {
        id: "ai-d1",
        badge: "AI/ML",
        text: "\u0412\u044B\u0431\u043E\u0440 \u043C\u0435\u0436\u0434\u0443 AWS SageMaker \u0438 self-hosted \u0434\u043B\u044F model serving",
      },
    ],
    priorities: [],
  },
  {
    id: "gateway",
    initials: "IG",
    name: "Integration Gateway",
    status: "on-track",
    statusLabel: "On Track",
    leads: "Тимлид 1",
    currentWeek: [
      {
        id: "ig-cw1",
        stageLead: "Dev \u00B7 AP",
        text: "\u041F\u0440\u043E\u0442\u043E\u0442\u0438\u043F \u043C\u043E\u0441\u0442\u0430 REST \u2192 gRPC",
        status: "in-progress",
      },
      {
        id: "ig-cw2",
        stageLead: "Analysis \u00B7 AP",
        text: "\u0411\u0430\u0437\u043E\u0432\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0432\u043D\u0435\u0448\u043D\u0438\u0445 \u0438\u043D\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0439",
        status: "completed",
      },
    ],
    nextWeek: [
      {
        id: "ig-nw1",
        stageLead: "Planned",
        text: "\u041F\u0440\u043E\u0435\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0441\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u0438 \u0432\u0435\u0440\u0441\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F API",
        status: "planned",
      },
    ],
    risks: [],
    decisions: [],
    priorities: [],
  },
];
