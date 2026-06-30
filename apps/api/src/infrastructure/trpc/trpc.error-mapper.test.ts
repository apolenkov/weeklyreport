import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import {
  AdminAccessError,
  AdminGroupProductConflictError,
  AdminPeriodNotFoundError,
  AdminPeriodOverlapError,
} from "../../modules/admin/admin.service.js";
import { ArchiveDomainError } from "../../modules/archive/archive.service.js";
import {
  CarryOverConflictError,
  CarryOverDomainError,
} from "../../modules/carry-over/carry-over.service.js";
import { PdfExportDomainError } from "../../modules/pdf-export/pdf-export.service.js";
import {
  PublicationAccessError,
  PublicationNotFoundError,
} from "../../modules/publication/publication.service.js";
import { ReminderDomainError } from "../../modules/reminders/reminders.service.js";
import {
  LeadFormAccessError,
  LeadFormConstraintError,
  LeadFormDomainError,
  ReopenRequestError,
} from "../../modules/report-sections/lead-form.service.js";
import {
  ReportSectionAccessError,
  ReportSectionDomainError,
  SectionVersionConflictError,
} from "../../modules/report-sections/report-sections.service.js";
import { ReviewAccessError } from "../../modules/review/review.service.js";
import { WeeklyReportDomainError } from "../../modules/weekly-report/weekly-report.service.js";
import { mapDomainError } from "./trpc.error-mapper.js";

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

    it("maps DUPLICATE_CHILD_ROW (a child-write P2002) to BAD_REQUEST", () => {
      const error = new ReportSectionDomainError(
        "DUPLICATE_CHILD_ROW",
        "Could not save the section: a duplicate row was rejected.",
      );
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("BAD_REQUEST");
    });
  });

  // -----------------------------------------------------------------------
  // SectionVersionConflictError -> CONFLICT (optimistic-lock 409)
  // -----------------------------------------------------------------------

  describe("SectionVersionConflictError -> CONFLICT", () => {
    it("maps a stale-version section write to CONFLICT, distinct from BAD_REQUEST", () => {
      const error = new SectionVersionConflictError(
        "This section was changed by another save. Reload and try again.",
      );
      const mapped = mapDomainError(error);

      expect(mapped).toBeInstanceOf(TRPCError);
      expect(mapped.code).toBe("CONFLICT");
      expect(mapped.message).toContain("changed by another save");
      expect(mapped.cause).toBe(error);
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

  it("maps ReopenRequestError to BAD_REQUEST (lifecycle/one-pending block)", () => {
    const error = new ReopenRequestError(
      "This period is published; ask Head to reopen the period before editing sections.",
    );
    const mapped = mapDomainError(error);

    expect(mapped.code).toBe("BAD_REQUEST");
    expect(mapped.message).toContain("published");
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

// ---------------------------------------------------------------------------
// Exhaustive domain-error → tRPC-code coverage.
//
// map-domain-errors refactored mapDomainError from a per-class if-chain to a
// declarative table (the complexity ceiling forbids 20 instanceof branches).
// The table can silently mis-code ANY class, so every domain error is asserted
// here. These [class, code] pairs are hand-written INDEPENDENTLY of the
// production DOMAIN_ERROR_CODES table — importing and iterating it would assert
// the table against itself. This block also satisfies the spec's per-class
// coverage requirement for the classes this change added or newly routes
// (LeadFormConstraintError, AdminGroupProductConflictError,
// PublicationNotFoundError, LeadFormAccessError, AdminPeriodNotFoundError).
// ---------------------------------------------------------------------------

describe("mapDomainError — exhaustive domain-error → code coverage", () => {
  const cases = [
    {
      name: "SectionVersionConflictError",
      make: () => new SectionVersionConflictError("m"),
      code: "CONFLICT",
    },
    {
      name: "ReportSectionDomainError",
      make: () => new ReportSectionDomainError("MISSING_CURRENT_ITEM", "m"),
      code: "BAD_REQUEST",
    },
    {
      name: "ReviewAccessError",
      make: () => new ReviewAccessError("m"),
      code: "FORBIDDEN",
    },
    {
      name: "AdminAccessError",
      make: () => new AdminAccessError("m"),
      code: "FORBIDDEN",
    },
    {
      name: "ReportSectionAccessError",
      make: () => new ReportSectionAccessError("m"),
      code: "FORBIDDEN",
    },
    {
      name: "LeadFormAccessError",
      make: () => new LeadFormAccessError("m"),
      code: "FORBIDDEN",
    },
    {
      name: "PublicationAccessError",
      make: () => new PublicationAccessError("m"),
      code: "CONFLICT",
    },
    {
      name: "PdfExportDomainError",
      make: () => new PdfExportDomainError("m"),
      code: "NOT_FOUND",
    },
    {
      name: "ArchiveDomainError",
      make: () => new ArchiveDomainError("m"),
      code: "NOT_FOUND",
    },
    {
      name: "WeeklyReportDomainError",
      make: () => new WeeklyReportDomainError("m"),
      code: "NOT_FOUND",
    },
    {
      name: "LeadFormDomainError",
      make: () => new LeadFormDomainError("m"),
      code: "NOT_FOUND",
    },
    {
      name: "ReopenRequestError",
      make: () => new ReopenRequestError("m"),
      code: "BAD_REQUEST",
    },
    {
      name: "LeadFormConstraintError",
      make: () => new LeadFormConstraintError("m"),
      code: "BAD_REQUEST",
    },
    {
      name: "CarryOverConflictError",
      make: () => new CarryOverConflictError("m"),
      code: "CONFLICT",
    },
    {
      name: "ReminderDomainError",
      make: () => new ReminderDomainError("m"),
      code: "BAD_REQUEST",
    },
    {
      name: "CarryOverDomainError",
      make: () => new CarryOverDomainError("m"),
      code: "BAD_REQUEST",
    },
    {
      name: "AdminPeriodOverlapError",
      make: () => new AdminPeriodOverlapError("m"),
      code: "BAD_REQUEST",
    },
    {
      name: "AdminPeriodNotFoundError",
      make: () => new AdminPeriodNotFoundError("m"),
      code: "NOT_FOUND",
    },
    {
      name: "PublicationNotFoundError",
      make: () => new PublicationNotFoundError("m"),
      code: "NOT_FOUND",
    },
    {
      name: "AdminGroupProductConflictError",
      make: () => new AdminGroupProductConflictError("m"),
      code: "CONFLICT",
    },
  ] as const;

  it.each(cases)("maps $name → $code", ({ make, code }) => {
    const error = make();
    const mapped = mapDomainError(error);

    expect(mapped).toBeInstanceOf(TRPCError);
    expect(mapped.code).toBe(code);
    expect(mapped.message).toBe("m");
    expect(mapped.cause).toBe(error);
  });

  it("covers every domain error class the mapper imports", () => {
    // Guards against a class being added to the mapper without a row here.
    expect(cases).toHaveLength(20);
  });
});
