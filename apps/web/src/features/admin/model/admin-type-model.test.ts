import { describe, expect, it } from "vitest";

import { EMPTY_ACTIVITY_FORM, parseJiraAccounts } from "./activity-form";
import type { AdminGroupView, AdminUserView } from "./admin-types";
import { emptyForm } from "./user-form";
import {
  filterAdminUsers,
  USER_ROLE_FILTER_OPTIONS,
  userGroupFilterOptions,
} from "./user-table-filters";

const GROUP: AdminGroupView = {
  id: "g1",
  name: "Platform",
  description: null,
  archived: false,
  headUserId: null,
};
const ARCHIVED_GROUP: AdminGroupView = {
  id: "g2",
  name: "Legacy",
  description: null,
  archived: true,
  headUserId: null,
};

const USER: AdminUserView = {
  id: "u1",
  name: "Ivan Petrov",
  lastName: "Petrov",
  firstName: "Ivan",
  middleName: null,
  position: null,
  email: "ivan@example.com",
  role: "lead",
  groupId: "g1",
  department: "Platform",
  isActive: true,
};

describe("emptyForm — no fabricated empty group id", () => {
  it("chooses an active group or null for a new user", () => {
    expect(emptyForm([GROUP, ARCHIVED_GROUP]).groupId).toBe("g1");
    expect(emptyForm([ARCHIVED_GROUP]).groupId).toBeNull();
  });

  it("returns null (not '') when no group is selectable", () => {
    expect(emptyForm([]).groupId).toBeNull();
  });
});

describe("EMPTY_ACTIVITY_FORM — absent group stays null", () => {
  it("does not encode an empty-string group id", () => {
    expect(EMPTY_ACTIVITY_FORM.groupId).toBeNull();
  });

  it("trims and preserves the order of Jira accounts", () => {
    const accounts = parseJiraAccounts(" ACME , PLATFORM ");
    expect(accounts).toEqual(["ACME", "PLATFORM"]);
  });
});

describe("user-table-filters — discriminated 'all' values", () => {
  it("encodes 'all roles' as a discriminated value, not an empty string", () => {
    expect(USER_ROLE_FILTER_OPTIONS[0]).toEqual({
      value: "all",
      label: "All roles",
    });
  });

  it("encodes 'all groups' as a discriminated value, not an empty string", () => {
    expect(userGroupFilterOptions([GROUP])[0]).toEqual({
      value: "all",
      label: "All groups",
    });
  });

  it("includes a user when role is 'all' and group absence is explicit", () => {
    const filtered = filterAdminUsers([USER], {
      search: "",
      role: "all",
      groupId: null,
      status: "all",
    });
    expect(filtered).toEqual([USER]);
  });

  it("excludes a user when a specific role filter does not match", () => {
    const filtered = filterAdminUsers([USER], {
      search: "",
      role: "head",
      groupId: null,
      status: "all",
    });
    expect(filtered).toEqual([]);
  });
});
