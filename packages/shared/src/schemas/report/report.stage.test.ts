import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { stageAssignmentSchema } from "../report.js";

const uuid = () => randomUUID();

describe("stageAssignmentSchema", () => {
  const validAssignment = () => ({
    id: uuid(),
    userId: uuid(),
    stageId: uuid(),
    projectId: uuid(),
    stageName: "Development",
  });

  it("accepts an assignment with every field", () => {
    expect(
      stageAssignmentSchema.safeParse({
        ...validAssignment(),
        userName: "Alice",
      }).success,
    ).toBe(true);
  });

  it("accepts an assignment without the optional user name", () => {
    expect(stageAssignmentSchema.safeParse(validAssignment()).success).toBe(
      true,
    );
  });

  it("rejects an empty stage name", () => {
    expect(
      stageAssignmentSchema.safeParse({
        ...validAssignment(),
        stageName: "",
      }).success,
    ).toBe(false);
  });

  it("rejects a non-UUID user id", () => {
    expect(
      stageAssignmentSchema.safeParse({
        ...validAssignment(),
        userId: "not-uuid",
      }).success,
    ).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(
      stageAssignmentSchema.safeParse({ id: uuid(), stageName: "Development" })
        .success,
    ).toBe(false);
  });
});
