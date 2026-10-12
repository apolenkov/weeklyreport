import assert from "node:assert/strict";

export interface BrowserSnapshot {
  readonly snapshot: string;
  readonly refs: Record<string, { role: string; name?: string }>;
}

interface SnapshotLine {
  readonly index: number;
  readonly indent: number;
}

const SNAPSHOT_LINE =
  /^(\s*)- ([a-zA-Z][a-zA-Z\d-]*)(?: ("(?:\\.|[^"\\])*"))?/u;

function matchingSnapshotLines(
  data: BrowserSnapshot,
  role: string,
  name?: string | RegExp,
): SnapshotLine[] {
  const matcher =
    name instanceof RegExp ? new RegExp(name.source, name.flags) : null;
  return data.snapshot.split("\n").flatMap((line, index) => {
    const parsed = SNAPSHOT_LINE.exec(line);
    if (parsed?.[2] !== role) return [];
    const accessibleName: unknown =
      parsed[3] === undefined ? "" : JSON.parse(parsed[3]);
    assert(
      typeof accessibleName === "string",
      "Invalid snapshot accessible name",
    );
    if (typeof name === "string" && accessibleName !== name) return [];
    if (matcher) {
      matcher.lastIndex = 0;
      if (!matcher.test(accessibleName)) return [];
    }
    return [{ index, indent: parsed[1]?.length ?? 0 }];
  });
}

export function scopeCount(
  data: BrowserSnapshot,
  role: string,
  name?: string | RegExp,
): number {
  return matchingSnapshotLines(data, role, name).length;
}

function snapshotRefIds(lines: readonly string[]): Set<string> {
  return new Set(
    lines.flatMap((line) => {
      const prefix = SNAPSHOT_LINE.exec(line)?.[0] ?? line;
      return line
        .slice(prefix.length)
        .split("[")
        .slice(1)
        .flatMap((attributes) => {
          const close = attributes.indexOf("]");
          const ref =
            close === -1
              ? undefined
              : /\bref=(e\d+)\b/u.exec(attributes.slice(0, close))?.[1];
          return ref === undefined ? [] : [ref];
        });
    }),
  );
}

export function scopeSnapshot(
  data: BrowserSnapshot,
  role: string,
  name?: string | RegExp,
): BrowserSnapshot {
  const scopes = scopeSnapshots(data, role, name);
  assert(
    scopes.length === 1,
    `Expected one ${role} snapshot scope, got ${scopes.length}`,
  );
  const scope = scopes.at(0);
  assert(scope, "Missing snapshot scope");
  return scope;
}

export function scopeSnapshots(
  data: BrowserSnapshot,
  role: string,
  name?: string | RegExp,
): BrowserSnapshot[] {
  const matches = matchingSnapshotLines(data, role, name);
  const lines = data.snapshot.split("\n");
  return matches.map((match) => snapshotSubtree(data, lines, match));
}

function snapshotSubtree(
  data: BrowserSnapshot,
  lines: readonly string[],
  match: SnapshotLine,
): BrowserSnapshot {
  const start = match.index;
  let end = start + 1;
  while (end < lines.length) {
    const line = lines.at(end);
    assert(line !== undefined, "Missing snapshot line");
    if (line.trim() && (/^\s*/u.exec(line)?.[0].length ?? 0) <= match.indent)
      break;
    end += 1;
  }
  const subtree = lines.slice(start, end).join("\n");
  const refs = snapshotRefIds(lines.slice(start, end));
  return {
    snapshot: subtree,
    refs: Object.fromEntries(
      Object.entries(data.refs).filter(([ref]) => refs.has(ref)),
    ),
  };
}
