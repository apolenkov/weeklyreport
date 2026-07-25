import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { createAppRouter } from "./trpc.router.js";

// Null-byte q must be rejected as BAD_REQUEST at the router boundary
// (safeText) before the search service is invoked.

const NULL_BYTE = String.fromCharCode(0);

function buildCaller(query: ReturnType<typeof vi.fn>) {
  const deps = {
    searchService: { query },
  } as unknown as Parameters<typeof createAppRouter>[0];
  return createAppRouter(deps).createCaller({
    session: {
      userId: "44444444-4444-4444-8444-444444444444",
      email: "admin@test.local",
      name: "admin user",
      role: "admin",
      activeReportId: null,
      activeReportSectionId: null,
    },
    logger: createNullLogger(),
    auditLogger: createNullAuditLogger(),
    ip: "test-ip",
    isPdfExport: false,
    pdfReportId: null,
  });
}

describe("search.query — null-byte input guard", () => {
  it("rejects a null-byte `q` with BAD_REQUEST before the service runs", async () => {
    const query = vi.fn(() => Promise.resolve([]));
    const caller = buildCaller(query);

    await expect(
      caller.search.query({ q: `ab${NULL_BYTE}cd`, scope: "mine", limit: 20 }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(query).not.toHaveBeenCalled();
  });
});
