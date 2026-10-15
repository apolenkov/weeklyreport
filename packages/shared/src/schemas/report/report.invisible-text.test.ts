import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  currentStageNamesField,
  writeStageNamesField,
} from "../primitives/report-primitives.schema.js";
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
    ["soft hyphen", "\u00AD"],
    ["combining grapheme joiner", "\u034F"],
    ["Mongolian vowel separator", "\u180E"],
    ["word joiner", "\u2060"],
    ["function application", "\u2061"],
    ["invisible times", "\u2062"],
    ["invisible separator", "\u2063"],
    ["invisible plus", "\u2064"],
    ["control whitespace", "\t\n\r"],
    ["mixed invisible characters", " ​‌‍﻿\t"],
    [
      "mixed selected characters",
      "\u00AD\u034F\u180E\u2060\u2061\u2062\u2063\u2064",
    ],
  ])("rejects %s", (_label, value) => {
    expectInvisibleTextRejected(value);
    expectInvisibleTextRejected(`\t${value} \n`);
  });

  it.each([
    "A",
    "hello world",
    " Привет мир ",
    "\u2060中文\u00AD",
    "مرحبا",
    "می\u200Cروم",
    "e\u0301",
    "a\u034F\u0301",
    "👩\u200D💻",
    "a\u180E\u2061\u2062\u2063\u2064\uFEFFb",
  ])("preserves visible text %j", (value) => {
    expect(safeText().parse(value)).toBe(value);
  });
});

describe("stage-name visible-content validation", () => {
  it.each([
    ["current read", currentStageNamesField],
    ["write", writeStageNamesField],
  ] as const)(
    "guards %s stage names without changing visible text",
    (_label, schema) => {
      expect(
        schema.safeParse([
          " \u2060\u00AD\u034F\u180E\u2061\u2062\u2063\u2064\t",
        ]).success,
      ).toBe(false);
      const names = [" Разработка\u2060 ", "👩\u200D💻", "e\u0301"];
      expect(schema.parse(names)).toEqual(names);
    },
  );
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
