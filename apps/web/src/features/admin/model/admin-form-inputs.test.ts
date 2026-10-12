import { composeName } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  type AdminReminderPolicyFormInput,
  type AdminUserFormInput,
  MissingUserGroupError,
  type ReportingGroupFormInput,
  toAdminProjectInput,
  toAdminUserInput,
  toReminderPolicyInput,
  toReportingGroupInput,
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
    expect(result.isActive).toBe(true);
  });

  it("preserves an inactive user's lifecycle flag while editing", () => {
    const result = toAdminUserInput(baseForm, "the-existing-id", false);
    expect(result.isActive).toBe(false);
  });

  it.each([null, "", " "])(
    "rejects a non-viewer without a non-empty group (%s)",
    (groupId) => {
      expect(() =>
        toAdminUserInput({ ...baseForm, groupId }, "existing-id"),
      ).toThrow(new MissingUserGroupError());
    },
  );

  it("keeps a viewer group nullable through submit", () => {
    expect(
      toAdminUserInput(
        { ...baseForm, role: "viewer", groupId: null },
        "viewer-id",
      ).reportingGroupId,
    ).toBeNull();
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const groupCases: {
  label: string;
  form: ReportingGroupFormInput;
  expected: Omit<ReturnType<typeof toReportingGroupInput>, "id">;
}[] = [
  {
    label: "trims name/description and preserves explicit values",
    form: {
      name: " Platform Group ",
      description: "  Core platform team  ",
      archived: true,
      headUserId: "head-1",
    },
    expected: {
      name: "Platform Group",
      description: "Core platform team",
      archived: true,
      headUserId: "head-1",
    },
  },
  {
    label: "normalizes a blank description and null head to null",
    form: {
      name: "Ops",
      description: " ",
      archived: false,
      headUserId: null,
    },
    expected: {
      name: "Ops",
      description: null,
      archived: false,
      headUserId: null,
    },
  },
  {
    label: "defaults optional fields when they are omitted",
    form: { name: "Skeleton" },
    expected: {
      name: "Skeleton",
      description: null,
      archived: false,
      headUserId: null,
    },
  },
];

describe("toReportingGroupInput", () => {
  it.each(groupCases)("$label", ({ form, expected }) => {
    expect(toReportingGroupInput(form, "group-1")).toEqual({
      id: "group-1",
      ...expected,
    });
  });

  it("mints a UUID when no existing id is supplied", () => {
    expect(toReportingGroupInput({ name: "New Group" }).id).toMatch(
      UUID_PATTERN,
    );
  });
});

const reminderBase: AdminReminderPolicyFormInput = {
  kind: "deadline",
  offsetMinutes: -1440,
  timezone: "UTC",
  audience: "lead-with-draft",
  active: true,
  validFromIso: "2026-09-14",
  validUntilIso: "2026-09-21",
};

const reminderCases: {
  label: string;
  form: AdminReminderPolicyFormInput;
  expected: Omit<ReturnType<typeof toReminderPolicyInput>, "id">;
}[] = [
  {
    label: "maps all fields and converts the bounded window to UTC midnight",
    form: reminderBase,
    expected: {
      kind: "deadline",
      offsetMinutes: -1440,
      timezone: "UTC",
      audience: "lead-with-draft",
      active: true,
      validFrom: new Date("2026-09-14T00:00:00.000Z"),
      validUntil: new Date("2026-09-21T00:00:00.000Z"),
    },
  },
  {
    label: "maps an escalation policy with a null upper bound",
    form: {
      kind: "escalation",
      offsetMinutes: 120,
      timezone: "Europe/Berlin",
      audience: "head-of-late",
      active: false,
      validFromIso: "2026-01-05",
      validUntilIso: null,
    },
    expected: {
      kind: "escalation",
      offsetMinutes: 120,
      timezone: "Europe/Berlin",
      audience: "head-of-late",
      active: false,
      validFrom: new Date("2026-01-05T00:00:00.000Z"),
      validUntil: null,
    },
  },
];

describe("toReminderPolicyInput", () => {
  it.each(reminderCases)("$label", ({ form, expected }) => {
    expect(toReminderPolicyInput(form, "policy-9")).toEqual({
      id: "policy-9",
      ...expected,
    });
  });

  it("mints a UUID when no existing id is supplied", () => {
    expect(toReminderPolicyInput(reminderBase).id).toMatch(UUID_PATTERN);
  });
});
