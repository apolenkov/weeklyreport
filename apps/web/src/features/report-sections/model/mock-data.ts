import type { Product } from "./types";

const DESIGN_ASSIGNEE = "Petrova M.";
const DEVOPS_ASSIGNEE = "Sidorov P.";

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "crm",
    name: "CRM Platform",
    overallStatus: "at-risk",
    stages: [
      {
        stageName: "Planning",
        status: "on-track",
        ownership: "locked",
        assignee: "PM",
      },
      {
        stageName: "Analysis",
        status: "on-track",
        ownership: "locked",
        assignee: "Ivanov A.",
      },
      {
        stageName: "Design",
        status: "on-track",
        ownership: "locked",
        assignee: DESIGN_ASSIGNEE,
      },
      {
        stageName: "Dev",
        status: "at-risk",
        ownership: "mine",
        assignee: "Тимлид 1",
        tooltip: "At Risk: Delay in OAuth2 due to partner API limits",
      },
      {
        stageName: "Testing",
        status: "on-track",
        ownership: "locked",
        assignee: "Novikova E.",
      },
      {
        stageName: "DevOps",
        status: "on-track",
        ownership: "locked",
        assignee: DEVOPS_ASSIGNEE,
      },
      {
        stageName: "Support",
        status: "on-track",
        ownership: "locked",
        assignee: "Support",
      },
    ],
  },
  {
    id: "analytics",
    name: "Data Analytics Suite",
    overallStatus: "blocked",
    riskSummary: "2 blockers",
    riskCount: 2,
    stages: [
      {
        stageName: "Analysis",
        status: "on-track",
        ownership: "locked",
        assignee: "Ivanov A.",
      },
      {
        stageName: "Dev",
        status: "blocked",
        ownership: "locked",
        assignee: "Kozlov D.",
      },
      {
        stageName: "Testing",
        status: "blocked",
        ownership: "mine",
        assignee: "Тимлид 1",
        tooltip: "Blocked: ETL testing blocked — waiting for Dev fix",
      },
      {
        stageName: "DevOps",
        status: "on-track",
        ownership: "locked",
        assignee: DEVOPS_ASSIGNEE,
      },
    ],
  },
  {
    id: "mobile",
    name: "Mobile Applications",
    overallStatus: "at-risk",
    riskSummary: "1 risk",
    riskCount: 1,
    stages: [
      {
        stageName: "Design",
        status: "at-risk",
        ownership: "locked",
        assignee: DESIGN_ASSIGNEE,
      },
      {
        stageName: "Dev",
        status: "at-risk",
        ownership: "locked",
        assignee: "Smirnov K.",
      },
      {
        stageName: "DevOps",
        status: "on-track",
        ownership: "mine",
        assignee: "Тимлид 1",
        tooltip: "Your stage - On Track",
      },
    ],
  },
  {
    id: "cloud",
    name: "Cloud Infrastructure",
    overallStatus: "at-risk",
    riskSummary: "1 risk",
    riskCount: 1,
    stages: [
      {
        stageName: "Analysis",
        status: "on-track",
        ownership: "locked",
        assignee: "Ivanov A.",
      },
      {
        stageName: "Dev",
        status: "at-risk",
        ownership: "mine",
        assignee: "Тимлид 1",
        tooltip: "At Risk: PgBouncer migration requires 30 min downtime",
      },
      {
        stageName: "Testing",
        status: "on-track",
        ownership: "locked",
        assignee: "Novikova E.",
      },
      {
        stageName: "DevOps",
        status: "on-track",
        ownership: "locked",
        assignee: DEVOPS_ASSIGNEE,
      },
    ],
  },
  {
    id: "aiml",
    name: "AI/ML Platform",
    overallStatus: "on-track",
    stages: [
      {
        stageName: "Planning",
        status: "on-track",
        ownership: "locked",
        assignee: "PM",
      },
      {
        stageName: "Analysis",
        status: "on-track",
        ownership: "locked",
        assignee: "Ivanov A.",
      },
      {
        stageName: "Design",
        status: "on-track",
        ownership: "locked",
        assignee: DESIGN_ASSIGNEE,
      },
      {
        stageName: "Dev",
        status: "on-track",
        ownership: "locked",
        assignee: "Smirnov K.",
      },
      {
        stageName: "Testing",
        status: "empty",
        ownership: "mine",
        assignee: "Тимлид 1",
      },
      {
        stageName: "Support",
        status: "on-track",
        ownership: "locked",
        assignee: "Support",
      },
    ],
  },
  {
    id: "gateway",
    name: "Integration Gateway",
    overallStatus: "on-track",
    stages: [
      {
        stageName: "Analysis",
        status: "on-track",
        ownership: "locked",
        assignee: "Ivanov A.",
      },
      {
        stageName: "Design",
        status: "on-track",
        ownership: "locked",
        assignee: DESIGN_ASSIGNEE,
      },
      {
        stageName: "Dev",
        status: "empty",
        ownership: "mine",
        assignee: "Тимлид 1",
      },
    ],
  },
];
