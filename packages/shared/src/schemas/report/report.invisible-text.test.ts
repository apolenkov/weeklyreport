import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { writeStageNamesField } from "../primitives/report-primitives.schema.js";
import { decisionInputSchema, riskInputSchema, safeText } from "../report.js";
import { riskReadModelSchema } from "../report-sections/section-record.schema.js";

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
    ["empty text", ""],
    ["spaces", " ".repeat(3)],
    ["non-breaking space", "\u00A0"],
    ["zero-width space", "​"],
    ["zero-width non-joiner", "‌"],
    ["zero-width joiner", "‍"],
    ["byte-order mark", "﻿"],
    ["soft hyphen", "\u00AD"],
    ["combining grapheme joiner", "\u034F"],
    ["Mongolian vowel separator", "\u180E"],
    ["word joiner", "\u2060"],
    ["repeated word joiner", "\u2060\u2060"],
    ["function application", "\u2061"],
    ["invisible times", "\u2062"],
    ["invisible separator", "\u2063"],
    ["invisible plus", "\u2064"],
    ["Arabic letter mark", "\u061C"],
    ["left-to-right and right-to-left marks", "\u200E\u200F"],
    ["bidi embeddings and overrides", "\u202A\u202E\u202C"],
    ["bidi isolates and legacy directional controls", "\u2066\u2069\u206F"],
    ["Hangul fillers", "\u115F\u1160\u3164\uFFA0"],
    ["Khmer inherent-vowel signs", "\u17B4\u17B5"],
    ["Mongolian variation selectors", "\u180B\u180C\u180D\u180F"],
    ["BMP variation selectors", "\uFE00\uFE0F"],
    ["supplemental variation selectors", "\u{E0100}\u{E01EF}"],
    ["language and emoji tags", "\u{E0001}\u{E0067}\u{E007F}"],
    ["shorthand format controls", "\u{1BCA0}\u{1BCA3}"],
    ["musical format controls", "\u{1D173}\u{1D17A}"],
    [
      "reserved default-ignorable points",
      "\u2065\uFFF0\uFFF8\u{E0000}\u{E0002}\u{E0080}\u{E01F0}\u{E0FFF}",
    ],
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
    "\u061Cمرحبا",
    "\u2067שלום\u2069",
    "字\u{E0100}",
    "❤\uFE0F",
    "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    "\u1820\u180B",
    "\u3164한\u2065\u{E0000}",
    "\u0378",
  ])("preserves accepted text %j", (value) => {
    expect(safeText().parse(value)).toBe(value);
  });
});

describe("stage-name visible-content validation", () => {
  it("preserves stored residual default-ignorable text and stage names", () => {
    const storedRisk = {
      ...validRisk(),
      id: uuid(),
      stableId: uuid(),
      activityId: null,
      risk: "\u3164",
      stageNames: ["\u3164"],
    };
    expect(riskReadModelSchema.parse(storedRisk)).toEqual(storedRisk);
  });

  it("rejects a default-ignorable-only write stage name", () => {
    const result = writeStageNamesField.safeParse([" \u3164\t"]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map(({ message }) => message)).toContain(
        "Stage must contain visible characters",
      );
    }
  });

  it("guards write stage names without changing visible text", () => {
    expect(
      writeStageNamesField.safeParse([
        " \u2060\u00AD\u034F\u180E\u2061\u2062\u2063\u2064\t",
      ]).success,
    ).toBe(false);
    const names = [" Разработка\u2060 ", "👩\u200D💻", "e\u0301"];
    expect(writeStageNamesField.parse(names)).toEqual(names);
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
