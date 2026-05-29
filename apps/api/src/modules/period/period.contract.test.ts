import type { UserSession } from "@customreport/shared";
import { describe, expect, it } from "vitest";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  PeriodAccessError,
  type PeriodRepository,
  PeriodService,
} from "./period.service";

/* ------------------------------------------------------------------ */
/*  Fixed test UUIDs                                                   */
/* ------------------------------------------------------------------ */

const reportId = "22222222-2222-4222-8222-222222222222";

const headSession: UserSession = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "head@customreport.local",
  name: "Department Head",
  role: "head",
  activeReportId: reportId,
  activeReportSectionId: null,
};

/* ------------------------------------------------------------------ */
/*  Report factory                                                     */
/* ------------------------------------------------------------------ */

interface MockReport {
  id: string;
  status: string;
  periodStatus: string;
  publishedAt: Date | null;
}

function makeReport(overrides: Partial<MockReport> = {}): MockReport {
  return {
    id: reportId,
    status: "draft",
    periodStatus: "open",
    publishedAt: null,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  In-memory mock repository                                          */
/* ------------------------------------------------------------------ */

function createRepository(report: MockReport | null): PeriodRepository & {
  getReport(): MockReport | null;
} {
  let current = report ? structuredClone(report) : null;

  return {
    async getReportById(id: string) {
      if (!current || id !== current.id) {
        return null;
      }

      return structuredClone(current);
    },

    async publishPeriod(id: string, _userId: string) {
      if (current && id === current.id) {
        current = {
          ...current,
          status: "published",
          periodStatus: "published",
          publishedAt: new Date(),
        };
      }
    },

    async reopenPeriod(id: string) {
      if (current && id === current.id) {
        current = {
          ...current,
          periodStatus: "reopened",
        };
      }
    },

    getReport() {
      return current ? structuredClone(current) : null;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  publishPeriod                                                      */
/* ------------------------------------------------------------------ */

describe("PeriodService — contract tests", () => {
  describe("publishPeriod", () => {
    it("succeeds for an open period", async () => {
      const report = makeReport({ periodStatus: "open" });
      const service = new PeriodService(createRepository(report));

      const result = await service.publishPeriod(reportId, headSession);

      expect(result).toEqual({ success: true, reportId });
    });

    it("succeeds for a reopened period", async () => {
      const report = makeReport({ periodStatus: "reopened" });
      const service = new PeriodService(createRepository(report));

      const result = await service.publishPeriod(reportId, headSession);

      expect(result).toEqual({ success: true, reportId });
    });

    it("throws PeriodAccessError for already-published period", async () => {
      const report = makeReport({
        periodStatus: "published",
        publishedAt: new Date("2026-04-10T16:00:00.000Z"),
      });
      const service = new PeriodService(createRepository(report));

      await expect(
        service.publishPeriod(reportId, headSession),
      ).rejects.toBeInstanceOf(PeriodAccessError);

      await expect(
        service.publishPeriod(reportId, headSession),
      ).rejects.toThrow("Period is already published.");
    });

    it("throws when report not found", async () => {
      const service = new PeriodService(createRepository(null));

      await expect(
        service.publishPeriod(
          "99999999-9999-4999-8999-999999999999",
          headSession,
        ),
      ).rejects.toThrow("not found");
    });

    it("records publishedAt and publishedById via repository", async () => {
      const report = makeReport({ periodStatus: "open" });
      const repo = createRepository(report);
      const service = new PeriodService(repo);

      await service.publishPeriod(reportId, headSession);

      const updated = repo.getReport();
      expect(updated).not.toBeNull();
      expect(expectDefined(updated).periodStatus).toBe("published");
      expect(expectDefined(updated).publishedAt).toBeInstanceOf(Date);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  reopenPeriod                                                     */
  /* ---------------------------------------------------------------- */

  describe("reopenPeriod", () => {
    it("succeeds for a published period", async () => {
      const report = makeReport({
        status: "published",
        periodStatus: "published",
        publishedAt: new Date("2026-04-10T16:00:00.000Z"),
      });
      const service = new PeriodService(createRepository(report));

      const result = await service.reopenPeriod(reportId);

      expect(result).toEqual({ success: true, reportId });
    });

    it("throws PeriodAccessError for non-published period (open)", async () => {
      const report = makeReport({ periodStatus: "open" });
      const service = new PeriodService(createRepository(report));

      await expect(service.reopenPeriod(reportId)).rejects.toBeInstanceOf(
        PeriodAccessError,
      );

      await expect(service.reopenPeriod(reportId)).rejects.toThrow(
        "Only published periods can be reopened.",
      );
    });

    it("throws PeriodAccessError for non-published period (reopened)", async () => {
      const report = makeReport({ periodStatus: "reopened" });
      const service = new PeriodService(createRepository(report));

      await expect(service.reopenPeriod(reportId)).rejects.toBeInstanceOf(
        PeriodAccessError,
      );

      await expect(service.reopenPeriod(reportId)).rejects.toThrow(
        "Only published periods can be reopened.",
      );
    });

    it("throws when report not found", async () => {
      const service = new PeriodService(createRepository(null));

      await expect(
        service.reopenPeriod("99999999-9999-4999-8999-999999999999"),
      ).rejects.toThrow("not found");
    });

    it("updates periodStatus to reopened via repository", async () => {
      const report = makeReport({
        status: "published",
        periodStatus: "published",
        publishedAt: new Date("2026-04-10T16:00:00.000Z"),
      });
      const repo = createRepository(report);
      const service = new PeriodService(repo);

      await service.reopenPeriod(reportId);

      const updated = repo.getReport();
      expect(updated).not.toBeNull();
      expect(expectDefined(updated).periodStatus).toBe("reopened");
    });
  });
});
