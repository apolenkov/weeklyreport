"use client";

const STAGE_SPLIT_RE = /[,;]+/;

export function splitStageNames(
  stageName: string | null | undefined,
): string[] {
  if (!stageName || stageName.trim() === "" || stageName.trim() === "—") {
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of stageName.split(STAGE_SPLIT_RE)) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function joinStageNames(stages: readonly string[]): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of stages) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out.length > 0 ? out.join(", ") : null;
}

export function stageNameMatches(
  stageName: string | null | undefined,
  stage: string,
): boolean {
  const tags = splitStageNames(stageName);
  return tags.length === 0 || tags.includes(stage);
}
