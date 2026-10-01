import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  decisionInputSchema,
  itemInputSchema,
  riskInputSchema,
  riskSeveritySchema,
} from "../report.js";

// Fixtures

const uuid = () => randomUUID();
const validItem = () => ({
  projectId: uuid(),
  type: "current" as const,
  text: "Ship feature X",
  tag: "feature",
  workflowStatus: "in_progress" as const,
  carriedOver: false,
  // stageNames is required (min 1) on the write contract.
  stageNames: ["Development"],
});

const validRisk = () => ({
  projectId: uuid(),
  risk: "Deadline may slip",
  impact: "Revenue loss",
  mitigation: "Hire contractor",
  // severity is required (no default) on the write contract.
  severity: "at-risk" as const,
  // stageNames is required (min 1) on the write contract.
  stageNames: ["Development"],
});

const validDecision = () => ({
  // XOR parent: a decision is product- or activity-parented. The fixture sets
  // a product so the write-path XOR superRefine accepts it.
  productId: uuid(),
  text: "Upgrade to PostgreSQL 16",
  owner: "Alice",
  impact: "Better performance",
  // stageNames is required (min 1) on the write contract.
  stageNames: ["Development"],
});

describe("itemInputSchema — safeText", () => {
  it.each([
    {
      label: "exactly 1 visible character",
      text: "A",
      success: true,
    },
    {
      label: "0 characters (empty string)",
      text: "",
      success: false,
    },
    {
      label: "at max length (500 chars)",
      text: "A".repeat(500),
      success: true,
    },
    {
      label: "exceeding max length (501 chars)",
      text: "A".repeat(501),
      success: false,
    },
  ] as const)("$success for item text $label", ({ text, success }) => {
    const result = itemInputSchema.safeParse({ ...validItem(), text });
    expect(result.success).toBe(success);
  });

  it(String.raw`rejects item text containing null byte \u0000`, () => {
    const item = { ...validItem(), text: "Hello\u0000World" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Text must not contain null bytes");
    }
  });

  it(
    String.raw`rejects item text that is only zero-width spaces \u200B`,
    () => {
      const item = { ...validItem(), text: "\u200B\u200B\u200B" };
      const result = itemInputSchema.safeParse(item);
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message);
        expect(messages).toContain("Text must contain visible characters");
      }
    },
  );

  it("accepts item text with zero-width space mixed with real text", () => {
    const item = { ...validItem(), text: "\u200BHello" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("rejects item text that is only whitespace", () => {
    const item = { ...validItem(), text: " ".repeat(3) };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it(String.raw`rejects item text that is only \uFEFF (BOM)`, () => {
    const item = { ...validItem(), text: "\uFEFF" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it("accepts tag with exactly 1 character", () => {
    const item = { ...validItem(), tag: "X" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it("rejects tag with 51 characters (exceeds max 50)", () => {
    const item = { ...validItem(), tag: "A".repeat(51) };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });

  it("rejects tag containing null byte", () => {
    const item = { ...validItem(), tag: "bug\u0000fix" };
    const result = itemInputSchema.safeParse(item);
    expect(result.success).toBe(false);
  });
});

// riskInputSchema — safeText on risk/impact/mitigation

describe("riskInputSchema — safeText", () => {
  it("accepts a valid risk", () => {
    const result = riskInputSchema.safeParse(validRisk());
    expect(result.success).toBe(true);
  });

  it("accepts explicit blocked severity", () => {
    const result = riskInputSchema.safeParse({
      ...validRisk(),
      severity: "blocked",
    });
    expect(result.success).toBe(true);
    expect(result.data?.severity).toBe("blocked");
  });

  it("rejects unknown severity", () => {
    const result = riskSeveritySchema.safeParse("critical");
    expect(result.success).toBe(false);
  });

  it("rejects a risk payload without severity", () => {
    const { severity: _severity, ...withoutSeverity } = validRisk();
    const result = riskInputSchema.safeParse(withoutSeverity);
    expect(result.success).toBe(false);
  });

  it("rejects risk text with null byte", () => {
    const risk = { ...validRisk(), risk: "Risk\u0000here" };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
  });

  it("rejects impact text with null byte", () => {
    const risk = { ...validRisk(), impact: "Impact\u0000here" };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
  });

  it("rejects mitigation text with null byte", () => {
    const risk = { ...validRisk(), mitigation: "Mitigate\u0000here" };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
  });

  it("rejects risk text that is only zero-width spaces", () => {
    const risk = { ...validRisk(), risk: "\u200B\u200C\u200D" };
    const result = riskInputSchema.safeParse(risk);
    expect(result.success).toBe(false);
  });
});

// Product-parented decision fixtures include a concrete SDLC stage; activity-
// parented records would intentionally omit stages.

describe("decisionInputSchema — safeText", () => {
  it("accepts a valid decision", () => {
    const result = decisionInputSchema.safeParse(validDecision());
    expect(result.success).toBe(true);
  });

  it("rejects decision text with null byte", () => {
    const d = { ...validDecision(), text: "Decide\u0000this" };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(false);
  });

  it("rejects owner with null byte", () => {
    const d = { ...validDecision(), owner: "Bob\u0000Smith" };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(false);
  });

  it("rejects owner exceeding 200 chars", () => {
    const d = { ...validDecision(), owner: "A".repeat(201) };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(false);
  });

  it("accepts deadline as null", () => {
    const d = { ...validDecision(), deadline: null };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(true);
  });

  it("accepts resolvedAt as null", () => {
    const d = { ...validDecision(), resolvedAt: null };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(true);
  });

  it("coerces deadline string to Date", () => {
    const d = { ...validDecision(), deadline: "2026-04-15" };
    const result = decisionInputSchema.safeParse(d);
    expect(result.success).toBe(true);
    if (!result.success) {
      throw result.error;
    }
    expect(result.data.deadline).toBeInstanceOf(Date);
  });
});
