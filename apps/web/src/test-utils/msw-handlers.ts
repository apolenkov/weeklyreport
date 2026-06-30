import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import superjson from "superjson";

const API_URL = "http://localhost:3001/trpc";

// ---- Mock data factories matching Zod schemas from @customreport/shared ----

function createMockSection() {
  return {
    reportSectionId: "00000000-0000-0000-0000-000000000001",
    reportId: "00000000-0000-0000-0000-000000000010",
    authorId: "00000000-0000-0000-0000-000000000002",
    authorName: "Test Lead",
    version: 1,
    status: "draft" as const,
    submittedAt: null,
    projects: [
      {
        projectId: "00000000-0000-0000-0000-000000000020",
        projectName: "Test Project",
        trafficLight: "green" as const,
      },
    ],
    items: [],
    risks: [],
    decisions: [],
    priorities: [],
  };
}

function createMockDashboardRows() {
  return [
    {
      leadId: "00000000-0000-0000-0000-000000000002",
      leadName: "Test Lead",
      role: "lead" as const,
      projectNames: ["Test Project"],
      status: "draft" as const,
      submittedAt: null,
    },
  ];
}

function createMockAssembledReport() {
  return {
    reportId: "00000000-0000-0000-0000-000000000010",
    periodStart: new Date("2026-04-01T00:00:00.000Z"),
    periodEnd: new Date("2026-04-07T00:00:00.000Z"),
    deadline: new Date("2026-04-04T00:00:00.000Z"),
    status: "draft" as const,
    publishedAt: null,
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green" as const,
      totals: { green: 1, yellow: 0, red: 0 },
    },
    sections: [],
  };
}

function createMockAdminSnapshot() {
  return {
    users: [],
    projects: [],
    periods: [],
    reminderRules: [],
    reminderExecutions: [],
  };
}

// tRPC batch format: GET /trpc/namespace.procedure?batch=1&input=...
// Response: [{ result: { data: ... } }]
// For single non-batched: { result: { data: ... } }

export const handlers = [
  // Queries (GET with batch format)
  http.get(`${API_URL}/*`, ({ request }) => {
    const url = new URL(request.url);
    const pathname = url.pathname.replace("/trpc/", "");
    const isBatch = url.searchParams.has("batch");
    const procedures = pathname.split(",");

    const results = procedures.map((proc) => {
      switch (proc) {
        case "reports.getActive":
          return { result: { data: superjson.serialize(createMockSection()) } };
        case "review.dashboard":
          return {
            result: { data: superjson.serialize(createMockDashboardRows()) },
          };
        case "review.assembledReport":
          return {
            result: { data: superjson.serialize(createMockAssembledReport()) },
          };
        case "admin.snapshot":
          return {
            result: { data: superjson.serialize(createMockAdminSnapshot()) },
          };
        case "archive.list":
          return { result: { data: superjson.serialize([]) } };
        case "archive.detail":
          return {
            result: {
              data: superjson.serialize({
                summary: {
                  reportId: "00000000-0000-0000-0000-000000000010",
                  periodStart: new Date("2026-04-01T00:00:00.000Z"),
                  periodEnd: new Date("2026-04-07T00:00:00.000Z"),
                  publishedAt: new Date("2026-04-05T00:00:00.000Z"),
                  publishedByName: "Head User",
                  portfolioStatus: "green" as const,
                },
                report: {
                  ...createMockAssembledReport(),
                  status: "published" as const,
                  publishedAt: new Date("2026-04-05T00:00:00.000Z"),
                  publishedByName: "Head User",
                },
              }),
            },
          };
        case "pdfExport.status":
          return {
            result: {
              data: superjson.serialize({
                jobId: "00000000-0000-0000-0000-000000000030",
                reportId: "00000000-0000-0000-0000-000000000010",
                status: "completed" as const,
                requestedAt: new Date("2026-04-05T00:00:00.000Z"),
                completedAt: new Date("2026-04-05T00:01:00.000Z"),
                checksum: "abc123",
                templateVersion: "1.0.0",
                artifactUrl: "/mock.pdf",
              }),
            },
          };
        default:
          return { result: { data: superjson.serialize(null) } };
      }
    });

    return HttpResponse.json(isBatch ? results : results[0]);
  }),

  // Mutations (POST)
  http.post(`${API_URL}/*`, ({ request }) => {
    const url = new URL(request.url);
    const pathname = url.pathname.replace("/trpc/", "");
    const procedures = pathname.split(",");

    const results = procedures.map((proc) => {
      switch (proc) {
        case "reports.saveDraft":
          return { result: { data: superjson.serialize(createMockSection()) } };
        case "reports.submit":
          return {
            result: {
              data: superjson.serialize({
                ...createMockSection(),
                status: "submitted" as const,
              }),
            },
          };
        case "review.publish":
          return {
            result: {
              data: superjson.serialize({
                ...createMockAssembledReport(),
                status: "published" as const,
              }),
            },
          };
        case "pdfExport.request":
          return {
            result: {
              data: superjson.serialize({
                jobId: "00000000-0000-0000-0000-000000000030",
                reportId: "00000000-0000-0000-0000-000000000010",
                status: "queued" as const,
                requestedAt: new Date("2026-04-05T00:00:00.000Z"),
                completedAt: null,
                checksum: null,
                templateVersion: "1.0.0",
                artifactUrl: null,
              }),
            },
          };
        default:
          return { result: { data: superjson.serialize(null) } };
      }
    });

    return HttpResponse.json(results.length === 1 ? results[0] : results);
  }),
];

export const server = setupServer(...handlers);
