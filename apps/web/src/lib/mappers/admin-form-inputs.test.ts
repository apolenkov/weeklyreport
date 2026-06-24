import { composeName } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { type AdminUserFormInput, toAdminUserInput } from "./admin-form-inputs";

/**
 * add-structured-user-name (review finding P2): `toAdminUserInput` is the
 * client-side owner of the `name === composeName(parts)` invariant for the admin
 * Users tab. It MUST recompute `name` from the trimmed surname-first parts and
 * never carry a separately-entered display name.
 */
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
