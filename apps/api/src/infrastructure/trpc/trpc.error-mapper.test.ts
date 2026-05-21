import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";

import { mapDomainError } from "./trpc.error-mapper.js";
import { ReportSectionDomainError } from "../../modules/report-sections/report-sections.service.js";
import { ReviewAccessError } from "../../modules/review/review.service.js";
import { PublicationAccessError } from "../../modules/publication/publication.service.js";
import {
  AdminAccessError,
  AdminPeriodOverlapError,
} from "../../modules/admin/admin.service.js";
import { PdfExportDomainError } from "../../modules/pdf-export/pdf-export.service.js";
import { ReminderDomainError } from "../../modules/reminders/reminders.service.js";
import { CarryOverDomainError } from "../../modules/carry-over/carry-over.service.js";
import { ArchiveDomainError } from "../../modules/archive/archive.service.js";
import { WeeklyReportDomainError } from "../../modules/weekly-report/weekly-report.service.js";
import { LeadFormDomainError } from "../../modules/report-sections/lead-form.service.js";

describe("mapDomainError", () => {
  // -----------------------------------------------------------------------
  // Pass-through: TRPCError instances should be returned as-is
  // -----------------------------------------------------------------------

  it("returns TRPCError instances unchanged", () => {
    const original = new TRPCError({ code: "NOT_FOUND", message: "Gone" });
    const mapped = mapDomainError(original);

    expect(mapped).toBe(original);
    expect(mapped.code).toBe("NOT_FOUND");
  });

  // -----------------------------------------------------------------------
  // ReportSectionDomainError -> BAD_REQUEST
  // -----------------------------------------------------------------------

  describe("ReportSectionDomainError -> BAD_REQUEST", () => {
    it("maps SECTION_ALREADY_SUBMITTED to BAD_REQUEST", () => {
      const error = new ReportSectionDomainError(
        "SECTION_ALREADY_SUBMITTED",
        "Submitted sections are read-only.",
      );
      const mapped = mapDomainError(error);

      expect(mapped).toBeInstanceOf(TRPCError);
      expect(mapped.code).toBe("BAD_REQUEST");
      expect(mapped.message).toBe("Submitted sections are read-only.");
    });

    it("maps MISSING_TRAFFIC_LIGHT to BAD_REQUEST", () => {
      const error = new ReportSectionDomainError(
        "MISSING_TRAFFIC_LIGHT",
        "Project X must have a traffic light status.",
      );
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("BAD_REQUEST");
      expect(mapped.message).toContain("traffic light");
    });

    it("maps MISSING_CURRENT_ITEM to BAD_REQUEST", () => {
      const error = new ReportSectionDomainError(
        "MISSING_CURRENT_ITEM",
        "Project X needs at least one Current Week item.",
      );
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("BAD_REQUEST");
    });

    it("preserves cause reference", () => {
      const error = new ReportSectionDomainError(
        "MISSING_CURRENT_ITEM",
        "Project X needs at least one Current Week item.",
      );
      const mapped = mapDomainError(error);

      expect(mapped.cause).toBe(error);
    });
  });

  // -----------------------------------------------------------------------
  // ReviewAccessError -> FORBIDDEN
  // -----------------------------------------------------------------------

  it("maps ReviewAccessError to FORBIDDEN", () => {
    const error = new ReviewAccessError("Head role required.");
    const mapped = mapDomainError(error);

    expect(mapped.code).toBe("FORBIDDEN");
    expect(mapped.message).toBe("Head role required.");
  });

  // -----------------------------------------------------------------------
  // AdminAccessError -> FORBIDDEN
  // -----------------------------------------------------------------------

  it("maps AdminAccessError to FORBIDDEN", () => {
    const error = new AdminAccessError(
      "Admin panel is available only to head users.",
    );
    const mapped = mapDomainError(error);

    expect(mapped.code).toBe("FORBIDDEN");
    expect(mapped.message).toContain("head users");
  });

  // -----------------------------------------------------------------------
  // PublicationAccessError -> CONFLICT
  // -----------------------------------------------------------------------

  describe("PublicationAccessError -> CONFLICT", () => {
    it('maps "already published" to CONFLICT', () => {
      const error = new PublicationAccessError(
        "Report has already been published.",
      );
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("CONFLICT");
      expect(mapped.message).toContain("already been published");
    });

    it('maps "immutable" to CONFLICT', () => {
      const error = new PublicationAccessError(
        "Published reports are immutable.",
      );
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("CONFLICT");
    });
  });

  // -----------------------------------------------------------------------
  // PdfExportDomainError -> NOT_FOUND
  // -----------------------------------------------------------------------

  describe("PdfExportDomainError -> NOT_FOUND", () => {
    it('maps "requires published report" to NOT_FOUND', () => {
      const error = new PdfExportDomainError(
        "PDF export requires a published report.",
      );
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("NOT_FOUND");
    });

    it('maps "job not found" to NOT_FOUND', () => {
      const error = new PdfExportDomainError(
        "PDF export job abc was not found.",
      );
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("NOT_FOUND");
    });
  });

  // -----------------------------------------------------------------------
  // ArchiveDomainError -> NOT_FOUND
  // -----------------------------------------------------------------------

  it("maps ArchiveDomainError to NOT_FOUND", () => {
    const error = new ArchiveDomainError("Archive report xyz was not found.");
    const mapped = mapDomainError(error);

    expect(mapped.code).toBe("NOT_FOUND");
    expect(mapped.message).toContain("not found");
  });

  it("maps WeeklyReportDomainError to NOT_FOUND", () => {
    const error = new WeeklyReportDomainError("Report xyz was not found.");
    const mapped = mapDomainError(error);

    expect(mapped.code).toBe("NOT_FOUND");
    expect(mapped.message).toContain("not found");
    expect(mapped.cause).toBe(error);
  });

  it("maps LeadFormDomainError to NOT_FOUND", () => {
    const error = new LeadFormDomainError(
      "No section found for user in report xyz.",
    );
    const mapped = mapDomainError(error);

    expect(mapped.code).toBe("NOT_FOUND");
    expect(mapped.message).toContain("No section found");
    expect(mapped.cause).toBe(error);
  });

  // -----------------------------------------------------------------------
  // ReminderDomainError -> BAD_REQUEST
  // -----------------------------------------------------------------------

  // UFB-063: AdminPeriodOverlapError -> BAD_REQUEST so the «period
  // already exists» message pipes verbatim to the admin toast.
  describe("AdminPeriodOverlapError -> BAD_REQUEST", () => {
    it("maps overlap error to BAD_REQUEST with the original message", () => {
      const error = new AdminPeriodOverlapError(
        "A period already exists for these dates: 2026-05-04…2026-05-10.",
      );
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("BAD_REQUEST");
      expect(mapped.message).toBe(
        "A period already exists for these dates: 2026-05-04…2026-05-10.",
      );
      expect(mapped.cause).toBe(error);
    });
  });

  describe("ReminderDomainError -> BAD_REQUEST", () => {
    it('maps "rule not found" to BAD_REQUEST', () => {
      const error = new ReminderDomainError("Reminder rule abc was not found.");
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("BAD_REQUEST");
    });

    it('maps "requires active rule" to BAD_REQUEST', () => {
      const error = new ReminderDomainError(
        "Reminder execution requires an active rule.",
      );
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("BAD_REQUEST");
    });
  });

  // -----------------------------------------------------------------------
  // CarryOverDomainError -> BAD_REQUEST
  // -----------------------------------------------------------------------

  describe("CarryOverDomainError -> BAD_REQUEST", () => {
    it('maps "same source and target" to BAD_REQUEST', () => {
      const error = new CarryOverDomainError(
        "Carry-over requires different source and target reports.",
      );
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("BAD_REQUEST");
    });

    it('maps "requires both sections" to BAD_REQUEST', () => {
      const error = new CarryOverDomainError(
        "Carry-over requires both source and target sections.",
      );
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("BAD_REQUEST");
    });
  });

  // -----------------------------------------------------------------------
  // Unknown errors -> INTERNAL_SERVER_ERROR
  // -----------------------------------------------------------------------

  describe("unknown errors -> INTERNAL_SERVER_ERROR", () => {
    it("maps generic Error to INTERNAL_SERVER_ERROR", () => {
      const error = new Error("Something unexpected");
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("INTERNAL_SERVER_ERROR");
      expect(mapped.message).toBe("Unexpected error");
    });

    it("maps string to INTERNAL_SERVER_ERROR", () => {
      const mapped = mapDomainError("string error");

      expect(mapped.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("maps null to INTERNAL_SERVER_ERROR", () => {
      const mapped = mapDomainError(null);

      expect(mapped.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("maps undefined to INTERNAL_SERVER_ERROR", () => {
      const mapped = mapDomainError(undefined);

      expect(mapped.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("maps object to INTERNAL_SERVER_ERROR", () => {
      const mapped = mapDomainError({ code: "CUSTOM", message: "fail" });

      expect(mapped.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("does not leak internal error details", () => {
      const error = new Error(
        "DB connection string: postgres://user:pass@host/db",
      );
      const mapped = mapDomainError(error);

      expect(mapped.message).toBe("Unexpected error");
      expect(mapped.message).not.toContain("postgres");
    });
  });
});
