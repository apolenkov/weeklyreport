import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface RouterCoverage {
  file: string;
  run: number;
  total: number;
}

interface V8Script {
  url: string;
  functions: { ranges: { count: number }[] }[];
}

function readScripts(path: string): V8Script[] {
  try {
    const doc = JSON.parse(readFileSync(path, "utf8")) as {
      result?: V8Script[];
    };
    return doc.result ?? [];
  } catch {
    return [];
  }
}

function mark(perFile: Map<string, boolean[]>, script: V8Script): void {
  if (!/\/trpc\/routers\/.*\.js$/.test(script.url)) return;
  const file = script.url.replace(/^.*\/trpc\/routers\//, "");
  const flags = perFile.get(file) ?? script.functions.map(() => false);
  script.functions.forEach((fn, i) => {
    if ((fn.ranges[0]?.count ?? 0) > 0) flags[i] = true;
  });
  perFile.set(file, flags);
}

/** Per router file: functions that ran at least once (any collected process) against all functions. */
export function coverageByRouter(dirs: readonly string[]): RouterCoverage[] {
  const perFile = new Map<string, boolean[]>();
  for (const dir of dirs.filter((d) => existsSync(d))) {
    for (const name of readdirSync(dir).filter((f) => f.endsWith(".json")))
      for (const script of readScripts(join(dir, name))) mark(perFile, script);
  }
  return [...perFile]
    .map(([file, flags]) => ({
      file,
      run: flags.filter(Boolean).length,
      total: flags.length,
    }))
    .toSorted((a, b) => a.file.localeCompare(b.file));
}
