import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { stageAssignmentSchema, stageSchema } from "./report";

const uuid = () => randomUUID();

describe("stageSchema", () => {
  it("accepts a valid stage", () => {
    expect(
      stageSchema.safeParse({
        id: uuid(),
        name: "Development",
        sortOrder: 0,
      }).success,
    ).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(
      stageSchema.safeParse({ id: uuid(), name: "", sortOrder: 0 }).success,
    ).toBe(false);
  });

  it("rejects a negative sort order", () => {
    expect(
      stageSchema.safeParse({
        id: uuid(),
        name: "Testing",
        sortOrder: -1,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-integer sort order", () => {
    expect(
      stageSchema.safeParse({
        id: uuid(),
        name: "Testing",
        sortOrder: 1.5,
      }).success,
    ).toBe(false);
  });

  it("rejects a non-UUID id", () => {
    expect(
      stageSchema.safeParse({
        id: "not-a-uuid",
        name: "Development",
        sortOrder: 0,
      }).success,
    ).toBe(false);
  });
});

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
