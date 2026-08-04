import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import {
  AdminAccessError,
  AdminGroupProductConflictError,
  AdminPeriodAlreadyArchivedError,
  AdminPeriodNotFoundError,
  AdminPeriodOverlapError,
  AdminPeriodStaleStateError,
  AdminReopenRequestAlreadyProcessedError,
  AdminReopenRequestNotFoundError,
  AdminUserConflictError,
  AdminUserReportingGroupRequiredError,
} from "../../modules/admin/index.js";
import { ArchiveDomainError } from "../../modules/archive/index.js";
import {
  CarryOverConflictError,
  CarryOverDomainError,
} from "../../modules/carry-over/index.js";
import { PdfExportDomainError } from "../../modules/pdf-export/index.js";
import {
  PeriodAccessError,
  PeriodLifecycleIntegrityError,
  PeriodNotFoundError,
  PeriodScopeError,
} from "../../modules/period/index.js";
import {
  ProjectActivityConflictError,
  ProjectActivityDomainError,
  ProjectActivityNotFoundError,
} from "../../modules/project-activity/index.js";
import { PublicationNotFoundError } from "../../modules/publication/index.js";
import {
  ReminderDomainError,
  ReminderScopeError,
} from "../../modules/reminders/index.js";
import {
  LeadFormAccessError,
  LeadFormConstraintError,
  LeadFormDomainError,
  ReopenRequestError,
} from "../../modules/report-sections/index.js";
import {
  ReportSectionAccessError,
  ReportSectionDomainError,
  ReportSectionNotFoundError,
  SectionVersionConflictError,
} from "../../modules/report-sections/index.js";
import {
  ReviewAccessError,
  ReviewConstraintError,
  ReviewNotFoundError,
  ReviewVersionConflictError,
} from "../../modules/review/index.js";
import { WeeklyReportDomainError } from "../../modules/weekly-report/index.js";
import {
  DOMAIN_ERROR_CODES,
  mapDomainError,
  withDomainErrorMapping,
} from "./trpc.error-mapper.js";

describe("mapDomainError", () => {
  it("returns TRPCError instances unchanged", () => {
    const original = new TRPCError({ code: "NOT_FOUND", message: "Gone" });
    const mapped = mapDomainError(original);

    expect(mapped).toBe(original);
    expect(mapped.code).toBe("NOT_FOUND");
  });

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

  describe("ReportSectionNotFoundError -> NOT_FOUND", () => {
    it("maps a vanished report on a section write to NOT_FOUND, not BAD_REQUEST", () => {
      const error = new ReportSectionNotFoundError(
        "The report no longer exists.",
      );
      const mapped = mapDomainError(error);

      expect(mapped.code).toBe("NOT_FOUND");
      expect(mapped.message).toContain("no longer exists");
      expect(mapped.cause).toBe(error);
    });
  });

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

  it("maps ReviewAccessError to FORBIDDEN", () => {
    const error = new ReviewAccessError("Head role required.");
    const mapped = mapDomainError(error);

    expect(mapped.code).toBe("FORBIDDEN");
    expect(mapped.message).toBe("Head role required.");
  });

  it("maps AdminAccessError to FORBIDDEN", () => {
    const error = new AdminAccessError(
      "Admin panel is available only to head users.",
    );
    const mapped = mapDomainError(error);

    expect(mapped.code).toBe("FORBIDDEN");
    expect(mapped.message).toContain("head users");
  });

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

  // AdminPeriodOverlapError → BAD_REQUEST so the «period already exists»
  // message pipes verbatim to the admin toast.
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

// Exhaustive coverage: codes hand-typed independently of DOMAIN_ERROR_CODES
// (self-assert would prove nothing). Membership check against the production
// table fails if a class is added/dropped without a matching row here.

describe("mapDomainError — exhaustive domain-error → code coverage", () => {
  const cases = [
    {
      name: "SectionVersionConflictError",
      make: () => new SectionVersionConflictError("m"),
      code: "CONFLICT",
    },
    {
      name: "ReportSectionNotFoundError",
      make: () => new ReportSectionNotFoundError("m"),
      code: "NOT_FOUND",
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
      name: "ReviewVersionConflictError",
      make: () => new ReviewVersionConflictError("m"),
      code: "CONFLICT",
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
    {
      name: "PeriodScopeError",
      make: () => new PeriodScopeError("m"),
      code: "FORBIDDEN",
    },
    {
      name: "PeriodNotFoundError",
      make: () => new PeriodNotFoundError("m"),
      code: "NOT_FOUND",
    },
    {
      name: "PeriodAccessError",
      make: () => new PeriodAccessError("m"),
      code: "BAD_REQUEST",
    },
    {
      name: "PeriodLifecycleIntegrityError",
      make: () => new PeriodLifecycleIntegrityError(),
      code: "INTERNAL_SERVER_ERROR",
      message: "Stored period lifecycle is inconsistent.",
    },
    {
      name: "ReviewNotFoundError",
      make: () => new ReviewNotFoundError("m"),
      code: "NOT_FOUND",
    },
    {
      name: "ReviewConstraintError",
      make: () => new ReviewConstraintError("m"),
      code: "BAD_REQUEST",
    },
    {
      name: "ReminderScopeError",
      make: () => new ReminderScopeError("m"),
      code: "FORBIDDEN",
    },
    {
      name: "AdminPeriodAlreadyArchivedError",
      make: () => new AdminPeriodAlreadyArchivedError("m"),
      code: "CONFLICT",
    },
    {
      name: "AdminPeriodStaleStateError",
      make: () => new AdminPeriodStaleStateError("m"),
      code: "CONFLICT",
    },
    {
      name: "AdminReopenRequestNotFoundError",
      make: () => new AdminReopenRequestNotFoundError("m"),
      code: "NOT_FOUND",
    },
    {
      name: "AdminReopenRequestAlreadyProcessedError",
      make: () => new AdminReopenRequestAlreadyProcessedError("m"),
      code: "CONFLICT",
    },
    {
      name: "AdminUserConflictError",
      make: () => new AdminUserConflictError("m"),
      code: "CONFLICT",
    },
    {
      name: "AdminUserReportingGroupRequiredError",
      make: () => new AdminUserReportingGroupRequiredError("m"),
      code: "BAD_REQUEST",
    },
    {
      name: "ProjectActivityNotFoundError",
      make: () => new ProjectActivityNotFoundError("m"),
      code: "NOT_FOUND",
    },
    {
      name: "ProjectActivityDomainError",
      make: () => new ProjectActivityDomainError("m"),
      code: "BAD_REQUEST",
    },
    {
      name: "ProjectActivityConflictError",
      make: () => new ProjectActivityConflictError("m"),
      code: "CONFLICT",
    },
  ] as const;

  it.each(cases)("maps $name → $code", (testCase) => {
    const error = testCase.make();
    const mapped = mapDomainError(error);

    expect(mapped).toBeInstanceOf(TRPCError);
    expect(mapped.code).toBe(testCase.code);
    expect(mapped.message).toBe("message" in testCase ? testCase.message : "m");
    expect(mapped.cause).toBe(error);
  });

  it("covers every domain error class the mapper imports", () => {
    // Class-membership check only (codes stay hand-typed above): every
    // DomainErrorCtor in DOMAIN_ERROR_CODES must have exactly one row above,
    // and every row above must construct a class the table actually maps.
    const mappedCtors = DOMAIN_ERROR_CODES.map(([Ctor]) => Ctor);
    const testedCtors = cases.map((c) => c.make().constructor);

    expect(new Set(testedCtors).size).toBe(testedCtors.length);
    expect(testedCtors).toHaveLength(mappedCtors.length);
    for (const Ctor of mappedCtors) {
      expect(testedCtors).toContain(Ctor);
    }
  });
});

// PeriodAccessError stays unmapped (state/policy 500s are a separate concern).

describe("mapDomainError — period lifecycle authz", () => {
  it("maps lifecycle corruption to a fixed internal message", () => {
    const error = Object.assign(new PeriodLifecycleIntegrityError(), {
      persistedValue: "published|archived|secret-user-id",
    });
    const mapped = mapDomainError(error);

    expect(mapped.code).toBe("INTERNAL_SERVER_ERROR");
    expect(mapped.message).toBe("Stored period lifecycle is inconsistent.");
    expect(mapped.message).not.toContain(error.persistedValue);
  });

  it("maps PeriodScopeError to FORBIDDEN, not INTERNAL_SERVER_ERROR", () => {
    const mapped = mapDomainError(new PeriodScopeError("out of scope"));

    expect(mapped.code).toBe("FORBIDDEN");
    expect(mapped.code).not.toBe("INTERNAL_SERVER_ERROR");
  });

  it("maps PeriodNotFoundError to NOT_FOUND, not INTERNAL_SERVER_ERROR", () => {
    const mapped = mapDomainError(new PeriodNotFoundError("missing"));

    expect(mapped.code).toBe("NOT_FOUND");
    expect(mapped.code).not.toBe("INTERNAL_SERVER_ERROR");
  });

  it("leaves PeriodAccessError mapped to BAD_REQUEST (state/policy failures, not internal errors)", () => {
    const mapped = mapDomainError(new PeriodAccessError("already published"));

    expect(mapped.code).toBe("BAD_REQUEST");
    expect(mapped.code).not.toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("withDomainErrorMapping", () => {
  it("returns a successful resolver result unchanged", async () => {
    await expect(
      withDomainErrorMapping(() => Promise.resolve({ ok: true })),
    ).resolves.toEqual({ ok: true });
  });

  it("maps a rejected domain error through the canonical mapper", async () => {
    await expect(
      withDomainErrorMapping(() =>
        Promise.reject(new WeeklyReportDomainError("missing")),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "missing" });
  });
});
