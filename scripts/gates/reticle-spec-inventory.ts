import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  consumeFenceLine,
  extractOutcomes,
  type FenceDelimiter,
  type OpenSpecOutcome,
} from "./reticle-spec-outcomes.ts";

export type { OpenSpecOutcome } from "./reticle-spec-outcomes.ts";

const SPEC_FILE_NAME = "spec.md";
const REQUIREMENT_HEADING_LEVEL = 3;
const SCENARIO_HEADING_LEVEL = 4;
const MAX_HEADING_LEVEL = 6;
const REQUIREMENT = "Requirement";
const SCENARIO = "Scenario";

export interface OpenSpecScenario {
  readonly spec: string;
  readonly requirement: string;
  readonly scenario: string;
  readonly normativeText: string;
  readonly fingerprint: string;
  readonly outcomes: readonly OpenSpecOutcome[];
}

export interface OpenSpecInventorySummary {
  readonly specs: number;
  readonly requirements: number;
  readonly scenarios: number;
  readonly outcomes: number;
}

function normalizeNormativeBlock(lines: readonly string[]): string {
  return lines
    .map((line) => line.trimEnd())
    .join("\n")
    .replaceAll(/\n{3,}/gu, "\n\n")
    .trim();
}

function fingerprintNormativeText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function fail(spec: string, lineNumber: number, message: string): never {
  throw new Error(`${message} (${spec}/${SPEC_FILE_NAME}:${lineNumber})`);
}

function markdownHeading(line: string): { level: number; text: string } | null {
  let level = 0;
  while (line[level] === "#") level += 1;
  if (level === 0 || level > MAX_HEADING_LEVEL || line[level] !== " ")
    return null;
  return { level, text: line.slice(level + 1).trim() };
}

function directive(
  text: string,
): { kind: typeof REQUIREMENT | typeof SCENARIO; title: string } | null {
  const colon = text.indexOf(":");
  if (colon === -1) return null;
  const kind = text.slice(0, colon).trim();
  if (kind !== REQUIREMENT && kind !== SCENARIO) return null;
  return { kind, title: text.slice(colon + 1).trim() };
}

interface PendingScenario {
  readonly title: string;
  readonly lineNumber: number;
  readonly lines: string[];
}

interface ParserState {
  requirementTitle?: string;
  requirementLines: string[];
  collectsRequirementProse: boolean;
  pending: PendingScenario | null;
  openingFence: FenceDelimiter | null;
}

function completeScenario(
  spec: string,
  requirement: string,
  requirementLines: readonly string[],
  pending: PendingScenario,
  titles: Set<string>,
): OpenSpecScenario {
  if (titles.has(pending.title)) {
    fail(
      spec,
      pending.lineNumber,
      `duplicate scenario identity: requirement "${requirement}" scenario "${pending.title}"`,
    );
  }
  titles.add(pending.title);
  const outcomes = extractOutcomes(spec, requirement, pending);
  const normativeText = normalizeNormativeBlock([
    `### Requirement: ${requirement}`,
    "",
    ...requirementLines,
    "",
    `#### Scenario: ${pending.title}`,
    "",
    ...pending.lines,
  ]);
  return {
    spec,
    requirement,
    scenario: pending.title,
    normativeText,
    fingerprint: fingerprintNormativeText(normativeText),
    outcomes,
  };
}

function closePendingScenario(
  spec: string,
  state: ParserState,
  scenarios: OpenSpecScenario[],
  titlesByRequirement: Map<string, Set<string>>,
): void {
  if (state.pending === null || state.requirementTitle === undefined) return;
  const titles = titlesByRequirement.get(state.requirementTitle) ?? new Set();
  titlesByRequirement.set(state.requirementTitle, titles);
  scenarios.push(
    completeScenario(
      spec,
      state.requirementTitle,
      state.requirementLines,
      state.pending,
      titles,
    ),
  );
  state.pending = null;
}

function appendProse(state: ParserState, line: string): void {
  if (state.pending !== null) state.pending.lines.push(line);
  else if (state.collectsRequirementProse) state.requirementLines.push(line);
}

function applyDirective(
  spec: string,
  lineNumber: number,
  rendered: string,
  parsed: NonNullable<ReturnType<typeof directive>>,
  state: ParserState,
  scenarios: OpenSpecScenario[],
  titlesByRequirement: Map<string, Set<string>>,
): void {
  const expectedLevel =
    parsed.kind === REQUIREMENT
      ? REQUIREMENT_HEADING_LEVEL
      : SCENARIO_HEADING_LEVEL;
  const level = markdownHeading(rendered)?.level;
  if (level !== expectedLevel) {
    fail(
      spec,
      lineNumber,
      `malformed heading: "${rendered}" must be "### Requirement:" or "#### Scenario:"`,
    );
  }
  closePendingScenario(spec, state, scenarios, titlesByRequirement);
  if (parsed.kind === REQUIREMENT) {
    state.requirementTitle = parsed.title;
    state.requirementLines = [];
    state.collectsRequirementProse = true;
    return;
  }
  if (state.requirementTitle === undefined) {
    fail(
      spec,
      lineNumber,
      `orphan scenario: "${rendered}" appears before any "### Requirement:"`,
    );
  }
  state.collectsRequirementProse = false;
  state.pending = { title: parsed.title, lineNumber, lines: [] };
}

function parseCapabilitySpec(
  spec: string,
  content: string,
): OpenSpecScenario[] {
  const scenarios: OpenSpecScenario[] = [];
  const scenarioTitlesByRequirement = new Map<string, Set<string>>();
  const lines = content
    .replaceAll("\r\n", "\n")
    .replace("\uFEFF", "")
    .split("\n");
  const state: ParserState = {
    requirementLines: [],
    collectsRequirementProse: false,
    pending: null,
    openingFence: null,
  };

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const fence = consumeFenceLine(state.openingFence, line);
    state.openingFence = fence.opening;
    const heading = fence.fenced ? null : markdownHeading(line);
    if (heading === null) {
      appendProse(state, line);
      continue;
    }

    const parsedDirective = directive(heading.text);
    if (parsedDirective === null) {
      // Any other heading ends the current prose block without ending the
      // requirement the following scenarios still belong to.
      closePendingScenario(spec, state, scenarios, scenarioTitlesByRequirement);
      state.collectsRequirementProse = false;
      continue;
    }
    applyDirective(
      spec,
      lineNumber,
      line.trim(),
      parsedDirective,
      state,
      scenarios,
      scenarioTitlesByRequirement,
    );
  }
  closePendingScenario(spec, state, scenarios, scenarioTitlesByRequirement);

  return scenarios;
}

async function capabilitySpecFiles(
  specsRoot: string,
): Promise<{ spec: string; path: string }[]> {
  const entries = await readdir(specsRoot, { withFileTypes: true });
  const capabilities = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const files: { spec: string; path: string }[] = [];
  for (const spec of capabilities) {
    const directory = join(specsRoot, spec);
    const contents = await readdir(directory, { withFileTypes: true });
    const isSpecFile = contents.some(
      (entry) => entry.isFile() && entry.name === SPEC_FILE_NAME,
    );
    if (isSpecFile) files.push({ spec, path: join(directory, SPEC_FILE_NAME) });
  }
  return files;
}

export async function inventoryOpenSpecScenarios(
  specsRoot: string,
): Promise<OpenSpecScenario[]> {
  const files = await capabilitySpecFiles(specsRoot);
  const scenarios: OpenSpecScenario[] = [];
  for (const { spec, path } of files) {
    const content = await readFile(path, "utf8");
    scenarios.push(...parseCapabilitySpec(spec, content));
  }
  return scenarios;
}

export function summarizeOpenSpecInventory(
  scenarios: readonly OpenSpecScenario[],
): OpenSpecInventorySummary {
  const requirementsBySpec = new Map<string, Set<string>>();
  for (const { spec, requirement } of scenarios) {
    const requirements = requirementsBySpec.get(spec);
    if (requirements === undefined) {
      requirementsBySpec.set(spec, new Set([requirement]));
      continue;
    }
    requirements.add(requirement);
  }
  return {
    specs: requirementsBySpec.size,
    requirements: [...requirementsBySpec.values()].reduce(
      (total, requirements) => total + requirements.size,
      0,
    ),
    scenarios: scenarios.length,
    outcomes: scenarios.reduce(
      (total, scenario) => total + scenario.outcomes.length,
      0,
    ),
  };
}
