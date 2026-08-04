import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { submitSectionSchema } from "./report";
import { trafficLightStatusSchema } from "./report-primitives.schema";

const uuid = () => randomUUID();
const projectId = uuid();

const validSubmit = () => ({
  reportSectionId: uuid(),
  version: 1,
  status: "draft" as const,
  projectStatuses: [{ projectId, status: "green" as const }],
  stageStatuses: [],
  activityStatuses: [],
  items: [],
  risks: [],
  decisions: [],
  confirmed: true as const,
});

describe("submitSectionSchema", () => {
  it("accepts a valid submit", () => {
    expect(submitSectionSchema.safeParse(validSubmit()).success).toBe(true);
  });

  it.each(trafficLightStatusSchema.options)(
    "accepts %s traffic-light status",
    (status) => {
      expect(
        submitSectionSchema.safeParse({
          ...validSubmit(),
          projectStatuses: [{ projectId, status }],
        }).success,
      ).toBe(true);
    },
  );

  it("rejects an invalid traffic-light status", () => {
    expect(
      submitSectionSchema.safeParse({
        ...validSubmit(),
        projectStatuses: [{ projectId, status: "blue" }],
      }).success,
    ).toBe(false);
  });

  it("rejects a project status without a traffic-light value", () => {
    expect(
      submitSectionSchema.safeParse({
        ...validSubmit(),
        projectStatuses: [{ projectId }],
      }).success,
    ).toBe(false);
  });

  it("requires confirmation", () => {
    expect(
      submitSectionSchema.safeParse({
        ...validSubmit(),
        confirmed: false,
      }).success,
    ).toBe(false);
  });

  it("rejects more than 100 project statuses", () => {
    const projectStatuses = Array.from({ length: 101 }, () => ({
      projectId: uuid(),
      status: "green" as const,
    }));
    expect(
      submitSectionSchema.safeParse({ ...validSubmit(), projectStatuses })
        .success,
    ).toBe(false);
  });

  it("rejects more than 100 activity statuses", () => {
    const activityStatuses = Array.from({ length: 101 }, () => ({
      activityId: uuid(),
      status: "green" as const,
    }));
    expect(
      submitSectionSchema.safeParse({ ...validSubmit(), activityStatuses })
        .success,
    ).toBe(false);
  });

  it("accepts an activity-only submit without project statuses", () => {
    expect(
      submitSectionSchema.safeParse({
        ...validSubmit(),
        projectStatuses: [],
      }).success,
    ).toBe(true);
  });
});
