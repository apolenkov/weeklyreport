import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveRepoPath } from "../../shared/repo-root.ts";
import {
  type MarkdownSource,
  parseReferenceLedger,
  type ReferenceLedger,
  validateRepositoryPathReferences,
} from "./repository-path-references.ts";
import {
  existingRepositoryInventory,
  isScannedMarkdown,
  readTrackedMarkdownSources,
  repositoryPathExists,
  repositoryPathExistsInInventory,
} from "./repository-path-references-live.ts";

const MISSING_PATH = "apps/api/src/missing.ts";
const OWNER = "docs/example.md";
const sources = (owner = OWNER): readonly MarkdownSource[] => [
  { path: owner, content: `Current source: \`${MISSING_PATH}\`.` },
];
const ledger = (owners: readonly string[] = [OWNER]): ReferenceLedger => ({
  version: 1,
  entries: [
    {
      path: MISSING_PATH,
      owners,
      reason: "removed-path-example",
      rationale: "A planted missing path proves the validator fails closed.",
    },
  ],
});

void test("rejects an unlisted missing repository path", () => {
  assert.throws(
    () =>
      validateRepositoryPathReferences(
        sources(),
        { version: 1, entries: [] },
        () => false,
      ),
    /unclassified missing path/,
  );
});

void test("rejects a missing path under a maintained tooling root", () => {
  assert.throws(
    () =>
      validateRepositoryPathReferences(
        [{ path: OWNER, content: "Current source: `deploy/missing.yml`." }],
        { version: 1, entries: [] },
        () => false,
      ),
    /unclassified missing path: deploy\/missing\.yml/,
  );
});

void test("ignores repository paths inside fenced examples", () => {
  assert.deepEqual(
    validateRepositoryPathReferences(
      [
        {
          path: OWNER,
          content: "```md\nExample: `apps/api/src/missing.ts`\n```",
        },
      ],
      { version: 1, entries: [] },
      () => false,
    ),
    {
      sourceCount: 1,
      referenceCount: 0,
      missingCount: 0,
      exceptionCount: 0,
    },
  );
});

void test("a shorter marker does not close a longer fence", () => {
  assert.deepEqual(
    validateRepositoryPathReferences(
      [
        {
          path: OWNER,
          content:
            "````md\n```\n`apps/api/src/missing.ts`\n```\n````\n`apps/api/src/current.ts`",
        },
      ],
      { version: 1, entries: [] },
      (path) => path === "apps/api/src/current.ts",
    ),
    {
      sourceCount: 1,
      referenceCount: 1,
      missingCount: 0,
      exceptionCount: 0,
    },
  );
});

void test("empty and punctuation-only inline spans terminate without references", () => {
  assert.deepEqual(
    validateRepositoryPathReferences(
      [
        {
          path: OWNER,
          content: "Empty: ``. Punctuation: `);`. Nested: `` `value` ``.",
        },
      ],
      { version: 1, entries: [] },
      () => false,
    ),
    {
      sourceCount: 1,
      referenceCount: 0,
      missingCount: 0,
      exceptionCount: 0,
    },
  );
});

void test("scans only Markdown files under docs", () => {
  assert.equal(isScannedMarkdown("docs/current.md"), true);
  assert.equal(isScannedMarkdown("docs/example.html"), false);
});

void test("rejects an exception whose owner set drifted", () => {
  assert.throws(
    () =>
      validateRepositoryPathReferences(
        sources(),
        ledger(["docs/other.md"]),
        () => false,
      ),
    /ledger owner mismatch/,
  );
});

void test("rejects a stale exception after its path appears", () => {
  assert.throws(
    () => validateRepositoryPathReferences(sources(), ledger(), () => true),
    /stale ledger path now exists/,
  );
});

void test("accepts one exact classified exception", () => {
  assert.deepEqual(
    validateRepositoryPathReferences(sources(), ledger(), () => false),
    {
      sourceCount: 1,
      referenceCount: 1,
      missingCount: 1,
      exceptionCount: 1,
    },
  );
});

void test("ignored local files do not become tracked source paths", () => {
  const inventory = ["apps/web/src/app.ts", "docs/onboarding.md"];
  assert.equal(
    repositoryPathExistsInInventory("apps/web/.env.local", inventory),
    false,
  );
  assert.equal(
    repositoryPathExistsInInventory("apps/web/src/app.ts", inventory),
    true,
  );
  assert.equal(
    repositoryPathExistsInInventory("apps/web/src/", inventory),
    true,
  );
});

void test("worktree deletions leave the repository inventory", () => {
  assert.deepEqual(
    existingRepositoryInventory(
      ["docs/current.md", "docs/deleted.md"],
      (path) => path === "docs/current.md",
    ),
    ["docs/current.md"],
  );
});

void test("tracked durable Markdown has no unclassified path references", () => {
  const ledger = parseReferenceLedger(
    readFileSync(
      resolveRepoPath(
        "scripts/gates/documentation/repository-path-reference-ledger.json",
      ),
      "utf8",
    ),
  );
  const report = validateRepositoryPathReferences(
    readTrackedMarkdownSources(),
    ledger,
    repositoryPathExists,
  );
  assert.equal(report.missingCount, report.exceptionCount);
  process.stdout.write(
    `repository-path-reference PASS sources=${String(report.sourceCount)} ` +
      `references=${String(report.referenceCount)} ` +
      `exceptions=${String(report.exceptionCount)}\n`,
  );
});
