import { createHash } from "node:crypto";

export interface OpenSpecOutcome {
  readonly ordinal: number;
  readonly keyword: "THEN" | "AND";
  readonly text: string;
  readonly fingerprint: string;
}

interface ScenarioBlock {
  readonly title: string;
  readonly lineNumber: number;
  readonly lines: readonly string[];
}

export interface FenceDelimiter {
  readonly character: "`" | "~";
  readonly length: number;
  readonly closes: boolean;
}

const MIN_FENCE_LENGTH = 3;

export function fenceDelimiter(line: string): FenceDelimiter | null {
  const trimmed = line.trimStart();
  const character = trimmed[0];
  if (character !== "`" && character !== "~") return null;
  let length = 0;
  while (trimmed[length] === character) length += 1;
  return length >= MIN_FENCE_LENGTH
    ? { character, length, closes: /^[ \t]*$/u.test(trimmed.slice(length)) }
    : null;
}

export interface FenceLine {
  readonly opening: FenceDelimiter | null;
  readonly fenced: boolean;
}

export function consumeFenceLine(
  opening: FenceDelimiter | null,
  line: string,
): FenceLine {
  const delimiter = fenceDelimiter(line);
  if (opening === null) {
    return delimiter === null
      ? { opening: null, fenced: false }
      : { opening: delimiter, fenced: true };
  }
  const closes =
    delimiter !== null &&
    delimiter.closes &&
    delimiter.character === opening.character &&
    delimiter.length >= opening.length;
  return { opening: closes ? null : opening, fenced: true };
}

type ClauseKeyword = "GIVEN" | "WHEN" | "THEN" | "AND";
interface CurrentOutcome {
  keyword: OpenSpecOutcome["keyword"];
  lines: string[];
}

function parseKeyword(
  candidate: string,
  keyword: ClauseKeyword,
): { keyword: ClauseKeyword; text: string } | null {
  const plain = keyword;
  const bold = `**${keyword}**`;
  if (candidate === plain || candidate === bold) return { keyword, text: "" };
  const marker = candidate.startsWith(`${plain} `) ? plain : bold;
  return candidate.startsWith(`${marker} `)
    ? { keyword, text: candidate.slice(marker.length + 1).trim() }
    : null;
}

function clauseMarker(
  line: string,
): { keyword: ClauseKeyword; text: string } | null {
  let candidate = line.trim();
  if ("-*+".includes(candidate[0] ?? "") && candidate[1] === " ") {
    candidate = candidate.slice(2).trimStart();
  }
  for (const keyword of ["GIVEN", "WHEN", "THEN", "AND"] as const) {
    const parsed = parseKeyword(candidate, keyword);
    if (parsed !== null) return parsed;
  }
  return null;
}

function advancesOutcome(
  keyword: ClauseKeyword,
  afterThen: boolean,
): { afterThen: boolean; include: boolean } {
  if (keyword === "THEN") return { afterThen: true, include: true };
  if (keyword === "AND") return { afterThen, include: afterThen };
  return { afterThen: false, include: false };
}

function fail(spec: string, scenario: ScenarioBlock, message: string): never {
  throw new Error(`${message} (${spec}/spec.md:${scenario.lineNumber})`);
}

function finishOutcome(
  spec: string,
  requirement: string,
  scenario: ScenarioBlock,
  current: CurrentOutcome | null,
  outcomes: OpenSpecOutcome[],
): void {
  if (current === null) return;
  const text = current.lines.join(" ").replaceAll(/\s+/gu, " ").trim();
  if (text === "") {
    fail(
      spec,
      scenario,
      `malformed outcome in requirement "${requirement}" scenario "${scenario.title}"`,
    );
  }
  const ordinal = outcomes.length + 1;
  outcomes.push({
    ordinal,
    keyword: current.keyword,
    text,
    fingerprint: createHash("sha256")
      .update(`${ordinal}. ${current.keyword} ${text}`, "utf8")
      .digest("hex"),
  });
}

function appendOutcomeText(
  current: CurrentOutcome | null,
  line: string,
): CurrentOutcome | null {
  if (current !== null) current.lines.push(line.trim());
  return current;
}

function startOutcome(
  spec: string,
  scenario: ScenarioBlock,
  marker: { keyword: ClauseKeyword; text: string },
  include: boolean,
): CurrentOutcome | null {
  if (!include) return null;
  if (marker.text === "") {
    fail(
      spec,
      scenario,
      `malformed outcome: ${marker.keyword} has no text in scenario "${scenario.title}"`,
    );
  }
  return {
    keyword: marker.keyword as OpenSpecOutcome["keyword"],
    lines: [marker.text],
  };
}

export function extractOutcomes(
  spec: string,
  requirement: string,
  scenario: ScenarioBlock,
): OpenSpecOutcome[] {
  const outcomes: OpenSpecOutcome[] = [];
  let afterThen = false;
  let openingFence: FenceDelimiter | null = null;
  let current: CurrentOutcome | null = null;

  for (const line of scenario.lines) {
    const fence = consumeFenceLine(openingFence, line);
    openingFence = fence.opening;
    if (fence.fenced) continue;
    const marker = clauseMarker(line);
    if (marker === null) {
      current = appendOutcomeText(current, line);
      continue;
    }
    finishOutcome(spec, requirement, scenario, current, outcomes);
    const next = advancesOutcome(marker.keyword, afterThen);
    afterThen = next.afterThen;
    current = startOutcome(spec, scenario, marker, next.include);
  }
  if (openingFence !== null) {
    fail(
      spec,
      scenario,
      `unterminated fenced snippet in scenario "${scenario.title}"`,
    );
  }
  finishOutcome(spec, requirement, scenario, current, outcomes);
  if (outcomes.length === 0) {
    fail(
      spec,
      scenario,
      `scenario "${scenario.title}" has no normative THEN outcome`,
    );
  }
  return outcomes;
}
