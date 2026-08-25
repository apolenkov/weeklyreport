import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { withoutLocalGitEnvironment } from "../../shared/git-environment.ts";
import { parseComments } from "../shared/eslint-parser-comments.ts";

type SuppressionScope = "file" | "next-line" | "line";

export interface SuppressionDirective {
  readonly path: string;
  readonly line: number;
  readonly scope: SuppressionScope;
  readonly rule: string;
  readonly reason: string;
  readonly target: string;
  readonly fingerprint: string;
}

interface SuppressionNoise {
  readonly path: string;
  readonly line: number;
  readonly excerpt: string;
  readonly fingerprint: string;
}

export interface SuppressionInventory {
  readonly rawMatches: number;
  readonly directives: readonly SuppressionDirective[];
  readonly noise: readonly SuppressionNoise[];
}

interface ParsedDirectiveComment {
  readonly scope: SuppressionScope;
  readonly rules: readonly string[];
  readonly reason: string;
}

const DIRECTIVE_PREFIX = "eslint-disable";
const REASON_SEPARATOR = " -- ";
const FINGERPRINT_LENGTH = 16;
const GIT = "/usr/bin/git";

const scopedRemainder = (
  remainder: string,
):
  | (Pick<ParsedDirectiveComment, "scope"> & { readonly text: string })
  | undefined => {
  if (remainder.startsWith("-next-line "))
    return { scope: "next-line", text: remainder.slice("-next-line ".length) };
  if (remainder.startsWith("-line "))
    return { scope: "line", text: remainder.slice("-line ".length) };
  if (remainder.startsWith(" "))
    return { scope: "file", text: remainder.trimStart() };
  return undefined;
};

const parseDirectiveComment = (
  comment: string,
): ParsedDirectiveComment | undefined => {
  const value = comment.trim();
  if (!value.startsWith(DIRECTIVE_PREFIX)) return undefined;
  const scoped = scopedRemainder(value.slice(DIRECTIVE_PREFIX.length));
  if (scoped === undefined) return undefined;
  const rulesAndReason = scoped.text;
  const separator = rulesAndReason.indexOf(REASON_SEPARATOR);
  const ruleSource =
    separator === -1 ? rulesAndReason : rulesAndReason.slice(0, separator);
  const reason =
    separator === -1
      ? ""
      : normalized(rulesAndReason.slice(separator + REASON_SEPARATOR.length));
  const rules = ruleSource
    .split(",")
    .map((rule) => rule.trim())
    .filter((rule) => rule !== "");
  return rules.length === 0
    ? undefined
    : { scope: scoped.scope, rules, reason };
};

const lineAt = (source: string, offset: number): number =>
  source.slice(0, offset).split("\n").length;

const normalized = (value: string): string =>
  value.trim().replaceAll(/\s+/g, " ");

const digest = (...parts: readonly string[]): string =>
  createHash("sha256")
    .update(parts.join("\0"))
    .digest("hex")
    .slice(0, FINGERPRINT_LENGTH);

const targetLine = (
  sourceLines: readonly string[],
  directiveLine: number,
  scope: SuppressionScope,
): string => {
  const index = scope === "next-line" ? directiveLine : directiveLine - 1;
  return normalized(sourceLines[index] ?? "");
};

const parseSource = (path: string, source: string): SuppressionInventory => {
  const sourceLines = source.split("\n");
  const comments = parseComments(source, path);
  const directives = comments.flatMap((comment) => {
    const directive = parseDirectiveComment(comment.value);
    if (directive === undefined) return [];
    const target = targetLine(
      sourceLines,
      comment.loc.start.line,
      directive.scope,
    );
    return directive.rules.map((rule) => ({
      path,
      line: comment.loc.start.line,
      scope: directive.scope,
      rule,
      reason: directive.reason,
      target,
      fingerprint: digest(rule, normalized(comment.value), target),
    }));
  });
  const directiveRanges = comments
    .filter((comment) => parseDirectiveComment(comment.value) !== undefined)
    .map((comment) => comment.range);
  const rawOffsets = [...source.matchAll(/eslint-disable/g)].map(
    (match) => match.index,
  );
  const noise = rawOffsets
    .filter(
      (offset) =>
        !directiveRanges.some(
          ([start, end]) => offset >= start && offset < end,
        ),
    )
    .map((offset) => {
      const line = lineAt(source, offset);
      const excerpt = normalized(sourceLines[line - 1] ?? "");
      return {
        path,
        line,
        excerpt,
        fingerprint: digest(path, excerpt, String(offset)),
      };
    });
  return { rawMatches: rawOffsets.length, directives, noise };
};

const parseFile = (path: string): SuppressionInventory =>
  parseSource(path, readFileSync(path, "utf8"));

const suppressionSourceFiles = (): readonly string[] =>
  execFileSync(
    GIT,
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "*.ts",
      "*.tsx",
    ],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter((path) => path !== "" && existsSync(path));

export const readSuppressionInventory = (
  files: readonly string[] = suppressionSourceFiles(),
): SuppressionInventory =>
  files.map(parseFile).reduce<SuppressionInventory>(
    (all, current) => ({
      rawMatches: all.rawMatches + current.rawMatches,
      directives: [...all.directives, ...current.directives],
      noise: [...all.noise, ...current.noise],
    }),
    { rawMatches: 0, directives: [], noise: [] },
  );

export const countSuppressionDirectivesByPath = (
  files: readonly string[],
): ReadonlyMap<string, number> =>
  readSuppressionInventory(files).directives.reduce<Map<string, number>>(
    (counts, directive) =>
      counts.set(directive.path, (counts.get(directive.path) ?? 0) + 1),
    new Map(),
  );

export const readSuppressionInventoryAtCommit = (
  commit: string,
  cwd = process.cwd(),
): SuppressionInventory => {
  const prefix = `${commit}:`;
  const matches = (() => {
    try {
      return execFileSync(
        GIT,
        ["grep", "-l", "eslint-disable", commit, "--", "*.ts", "*.tsx"],
        {
          cwd,
          encoding: "utf8",
          env: withoutLocalGitEnvironment(process.env),
        },
      );
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 1)
        return "";
      throw error;
    }
  })();
  const paths = matches
    .trim()
    .split("\n")
    .map((entry) => entry.slice(prefix.length))
    .filter((path) => path !== "");
  return paths
    .map((path) =>
      parseSource(
        path,
        execFileSync(GIT, ["show", `${commit}:${path}`], {
          cwd,
          encoding: "utf8",
          env: withoutLocalGitEnvironment(process.env),
        }),
      ),
    )
    .reduce<SuppressionInventory>(
      (all, current) => ({
        rawMatches: all.rawMatches + current.rawMatches,
        directives: [...all.directives, ...current.directives],
        noise: [...all.noise, ...current.noise],
      }),
      { rawMatches: 0, directives: [], noise: [] },
    );
};
