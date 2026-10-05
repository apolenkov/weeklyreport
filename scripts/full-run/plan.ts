import { SIGNATURE_HEAD, SIGNATURE_TAIL } from "./constants.ts";

export interface PlanNode {
  "Node Type": string;
  "Relation Name"?: string;
  Filter?: string;
  "Total Cost": number;
  Plans?: PlanNode[];
}

export interface Logged {
  sql: string;
  params: string[];
}

export const collapse = (s: string): string => s.replaceAll(/\s+/g, " ").trim();

export const nodes = (n: PlanNode): PlanNode[] => [
  n,
  ...(n.Plans ?? []).flatMap(nodes),
];

export const describe = (all: readonly PlanNode[]): string =>
  all
    .map((n) => {
      const relation = n["Relation Name"];
      return relation ? `${n["Node Type"]} on ${relation}` : n["Node Type"];
    })
    .join(" > ");

/** pg_stat_statements replaces literals with extra $n, the log keeps them: compare with literals masked. */
export function signature(sql: string): string {
  const flat = collapse(sql)
    .replaceAll(/'(?:[^']|'')*'/g, "?")
    .replaceAll(/\$\d+/g, "?")
    .replaceAll(/\b\d+\b/g, "?")
    .replaceAll(/\b(true|false|null)\b/gi, "?");
  return `${flat.slice(0, SIGNATURE_HEAD)}:${flat.slice(-SIGNATURE_TAIL)}`;
}

const PARAM = /\$(\d+) = ('(?:[^']|'')*'|NULL)/g;

/** The log is one entry per message (long statements continue on tab-indented lines); DETAIL follows its statement. */
export function indexLog(log: string): Map<string, Logged> {
  const entries = log.split(/\n(?=\d{4}-\d\d-\d\d )/);
  const index = new Map<string, Logged>();
  entries.forEach((entry, i) => {
    const m = /LOG:\s+execute [^:]*: ([\s\S]*)$/.exec(entry);
    if (!m) return;
    const detail = /DETAIL:\s+parameters: ([\s\S]*)$/.exec(
      entries[i + 1] ?? "",
    );
    const params: string[] = [];
    for (const [, n, v] of (detail?.[1] ?? "").matchAll(PARAM))
      params[Number(n)] = v ?? "NULL";
    index.set(signature(m[1] ?? ""), { sql: m[1] ?? "", params });
  });
  return index;
}

/** The logged statement with its bind parameters written in. */
export function withParameters(logged: Logged): string {
  return logged.sql.replaceAll(
    /\$(\d+)/g,
    (_, n: string) => logged.params[Number(n)] ?? "NULL",
  );
}

const OPERATORS = new Set(["=", ">=", "<=", "<", ">", "IS"]);

/** Columns a sequential scan filters on, in order of appearance. */
export function filterColumns(filter: string): string[] {
  const tokens = filter.split(" ");
  const columns: string[] = [];
  tokens.forEach((token, i) => {
    if (!OPERATORS.has(token)) return;
    const name =
      (tokens[i - 1] ?? "").replaceAll(/[()"]/g, "").split("::")[0] ?? "";
    if (/^[A-Za-z_]\w*$/.test(name) && !columns.includes(name))
      columns.push(name);
  });
  return columns;
}
