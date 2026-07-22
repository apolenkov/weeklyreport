import { composeName } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  type AdminUserFormInput,
  toAdminProjectInput,
  toAdminUserInput,
  UnresolvedProjectLeadError,
} from "./admin-form-inputs";

// The mapper owns the `name === composeName(parts)` invariant so the Users tab
// cannot submit a separately-entered display name that drifts from its parts.
const baseForm: AdminUserFormInput = {
  lastName: "Иванов",
  firstName: "Пётр",
  middleName: "Сергеевич",
  position: "Lead Engineer",
  email: "ivanov@test.local",
  role: "lead",
  groupId: "a0000000-0000-4000-8000-000000000301",
};

describe("toAdminUserInput", () => {
  it("recomputes name from the structured parts in surname-first order", () => {
    const result = toAdminUserInput(baseForm, "existing-id");
    expect(result.name).toBe("Иванов Пётр Сергеевич");
    expect(result.name).toBe(
      composeName({
        lastName: "Иванов",
        firstName: "Пётр",
        middleName: "Сергеевич",
      }),
    );
  });

  it("trims the parts and drops a blank middle name to null", () => {
    const result = toAdminUserInput(
      {
        ...baseForm,
        lastName: " Петров ",
        firstName: " Анна ",
        middleName: " ",
      },
      "existing-id",
    );
    expect(result.lastName).toBe("Петров");
    expect(result.firstName).toBe("Анна");
    expect(result.middleName).toBeNull();
    // No trailing space from the dropped middle name.
    expect(result.name).toBe("Петров Анна");
  });

  it("drops a blank position to null", () => {
    const result = toAdminUserInput(
      { ...baseForm, position: " " },
      "existing-id",
    );
    expect(result.position).toBeNull();
  });

  it("uses the supplied existingId when editing", () => {
    const result = toAdminUserInput(baseForm, "the-existing-id");
    expect(result.id).toBe("the-existing-id");
  });
});

describe("toAdminProjectInput", () => {
  it("uses the caller-resolved lead name", () => {
    const result = toAdminProjectInput(
      {
        name: " Platform ",
        leadOwnerId: "lead-1",
        leadName: " Lead One ",
      },
      "project-1",
    );

    expect(result).toMatchObject({
      id: "project-1",
      name: "Platform",
      leadId: "lead-1",
      leadName: "Lead One",
    });
  });

  it.each([undefined, "", " ".repeat(3)])(
    "fails when the caller has not resolved a lead name (%s)",
    (leadName) => {
      expect(() =>
        toAdminProjectInput({
          name: "Platform",
          leadOwnerId: "missing-lead",
          leadName,
        }),
      ).toThrow(new UnresolvedProjectLeadError("missing-lead"));
    },
  );
});
