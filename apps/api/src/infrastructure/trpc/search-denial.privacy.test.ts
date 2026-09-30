import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { logs } from "@opentelemetry/api-logs";
import type { ClsService } from "nestjs-cls";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { createAuditLogger } from "../../lib/audit-logger.js";
import { createAppLogger } from "../../lib/logger.js";
import { SearchService } from "../../modules/search/index.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { createSearchRouter } from "./routers/search.router.js";

const USER_ID = "44444444-4444-4444-8444-444444444444";
const SECRET = "SEARCH_PRIVATE_MARKER";

describe("search denial privacy", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["lead", "all"],
    ["viewer", "mine"],
  ] as const)(
    "keeps a denied %s query out of every log sink",
    async (role, scope) => {
      const logDir = mkdtempSync(join(tmpdir(), "search-log-privacy-"));
      onTestFinished(() => rmSync(logDir, { recursive: true, force: true }));
      const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const emit = vi.fn();
      vi.spyOn(logs, "getLogger").mockReturnValue({ emit } as never);
      const cls = {
        isActive: () => true,
        get: () => "search-request-id",
      } as unknown as ClsService;
      const logger = createAppLogger({
        minLevel: "debug",
        logDir,
        clsService: cls,
      });
      const searchService = new SearchService({
        search: () => Promise.resolve([]),
      });
      const caller = createSearchRouter({ searchService }).createCaller({
        session: {
          userId: USER_ID,
          email: "lead@test.local",
          name: "Test user",
          role,
          activeReportId: null,
          activeReportSectionId: null,
        },
        logger,
        auditLogger: createAuditLogger(logger),
        ip: "127.0.0.1",
        isPdfExport: false,
        pdfReportId: null,
      });

      await expect(
        caller.query({ q: SECRET, scope, limit: 20 }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expectDefined(logger.flush)();

      const file = readFileSync(join(logDir, "app.log"), "utf8");
      [
        stdout.mock.calls.map(([line]) => line).join(""),
        stderr.mock.calls.map(([line]) => line).join(""),
        file,
        JSON.stringify(emit.mock.calls),
      ].forEach((sink) => expect(sink).not.toContain(SECRET));
      const entries = file
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(entries.filter(({ event }) => event === "scope-denied")).toEqual([
        expect.objectContaining({
          event: "scope-denied",
          userId: USER_ID,
          role,
          ip: "127.0.0.1",
          attemptedScope: "search",
          resourceId: "search.query",
          correlationId: "search-request-id",
        }),
      ]);
    },
  );
});
