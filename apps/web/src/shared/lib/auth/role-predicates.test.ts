import type { Role } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import {
  isAdmin,
  isHead,
  isHeadLike,
  isLead,
  isViewer,
} from "./role-predicates";

const ROLE_STATES: readonly (Role | null)[] = [
  "lead",
  "head",
  "admin",
  "viewer",
  null,
];

const TRUTH_TABLE: readonly {
  name: string;
  predicate: (role: Role | null) => boolean;
  trueFor: readonly (Role | null)[];
}[] = [
  { name: "isHead", predicate: isHead, trueFor: ["head"] },
  { name: "isAdmin", predicate: isAdmin, trueFor: ["admin"] },
  { name: "isLead", predicate: isLead, trueFor: ["lead"] },
  { name: "isViewer", predicate: isViewer, trueFor: ["viewer"] },
  { name: "isHeadLike", predicate: isHeadLike, trueFor: ["head", "admin"] },
];

describe.each(TRUTH_TABLE)(
  "role-predicates: $name",
  ({ predicate, trueFor }) => {
    it.each(ROLE_STATES)("%s", (state) => {
      const expected = trueFor.includes(state);
      expect(predicate(state)).toBe(expected);
    });
  },
);
