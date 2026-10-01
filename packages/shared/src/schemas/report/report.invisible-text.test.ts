import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { decisionInputSchema, riskInputSchema, safeText } from "../report.js";

const uuid = () => randomUUID();
const invisibleTextMessage = "Text must contain visible characters";

const validRisk = () => ({
  projectId: uuid(),
  risk: "Deadline may slip",
  impact: "Revenue loss",
  mitigation: "Hire contractor",
  severity: "at-risk" as const,
  stageNames: ["Development"],
});

const validDecision = () => ({
  productId: uuid(),
  text: "Upgrade to PostgreSQL 16",
  owner: "Alice",
  impact: "Better performance",
  stageNames: ["Development"],
});

function expectInvisibleTextRejected(value: string): void {
  const result = safeText().safeParse(value);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.map(({ message }) => message)).toContain(
      invisibleTextMessage,
    );
  }
}

describe("safeText visible-content validation", () => {
  it.each([
    ["spaces", " ".repeat(3)],
    ["zero-width space", "​"],
    ["zero-width non-joiner", "‌"],
    ["zero-width joiner", "‍"],
    ["byte-order mark", "﻿"],
    ["control whitespace", "\t\n\r"],
    ["mixed invisible characters", " ​‌‍﻿\t"],
  ])("rejects %s", (_label, value) => {
    expectInvisibleTextRejected(value);
  });

  it.each(["A", "hello world"])("accepts visible text %s", (value) => {
    expect(safeText().safeParse(value).success).toBe(true);
  });
});

describe("record invisible-content validation", () => {
  it.each([
    ["risk impact", () => ({ ...validRisk(), impact: " ".repeat(3) })],
    ["risk mitigation", () => ({ ...validRisk(), mitigation: " ".repeat(3) })],
  ])("rejects invisible %s", (_label, createInput) => {
    const result = riskInputSchema.safeParse(createInput());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map(({ message }) => message)).toContain(
        invisibleTextMessage,
      );
    }
  });

  it.each([
    ["decision text", () => ({ ...validDecision(), text: " ".repeat(3) })],
    ["decision impact", () => ({ ...validDecision(), impact: " ".repeat(3) })],
  ])("rejects invisible %s", (_label, createInput) => {
    const result = decisionInputSchema.safeParse(createInput());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map(({ message }) => message)).toContain(
        invisibleTextMessage,
      );
    }
  });
});
