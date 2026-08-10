import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

import { REPO_ROOT, resolveRepoPath } from "../../shared/repo-root.ts";
import {
  findApiTestBoundaryViolations,
  formatApiTestBoundaryViolation,
} from "./api-test-boundary.ts";
import {
  type DensityBaseline,
  parseDensityBaseline,
  validateBaselineRoots,
} from "./baseline-schema.ts";
import { OWNERSHIP_CATALOGUE } from "./catalogue.ts";
import {
  type OwnershipCatalogue,
  parseOwnershipCatalogue,
} from "./catalogue-schema.ts";
import { ownershipPasses, validateOwnership } from "./catalogue-validator.ts";
import {
  densityPasses,
  directFileCounts,
  validateDensity,
} from "./density-ratchet.ts";
import {
  pathDigest,
  sourceIdentityOf,
  sourceIdentityViolations,
} from "./source-identity.ts";
import {
  findWebFeatureBoundaryViolations,
  formatWebFeatureBoundaryViolation,
} from "./web-feature-boundary.ts";

const BASELINE_PATH = resolveRepoPath(
  "scripts/gates/directory-architecture/directory-architecture-baseline.json",
);

const splitGitPaths = (output: string): readonly string[] =>
  output.split("\0").filter((file) => file.length > 0);

const deletedTrackedPaths = (): readonly string[] =>
  splitGitPaths(
    execFileSync("/usr/bin/git", ["ls-files", "--deleted", "-z"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }),
  );

const inventoryFiles = (
  deletedPaths = deletedTrackedPaths(),
): readonly string[] => {
  if (deletedPaths.length > 0)
    throw new Error(
      `Deleted tracked worktree paths: ${deletedPaths.join(", ")}`,
    );
  return splitGitPaths(
    execFileSync(
      "/usr/bin/git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
      },
    ),
  );
};

const trackedFiles = (): readonly string[] => inventoryFiles();

const currentSourceIdentity = (
  files: readonly string[],
): DensityBaseline["sourceIdentity"] =>
  Object.fromEntries(
    OWNERSHIP_CATALOGUE.roots.map((root) => {
      const rootPath = root.prefix.replace(/\/$/, "");
      const gitTree = execFileSync(
        "/usr/bin/git",
        ["rev-parse", `HEAD:${rootPath}`],
        { cwd: REPO_ROOT, encoding: "utf8" },
      ).trim();
      return [
        rootPath,
        sourceIdentityOf(
          files.filter((file) => file.startsWith(root.prefix)),
          gitTree,
        ),
      ];
    }),
  );

const readBaseline = (): DensityBaseline =>
  parseDensityBaseline(
    JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as unknown,
  );

const catalogueFixture = (
  roots: readonly Record<string, unknown>[],
  rules: readonly Record<string, unknown>[],
): OwnershipCatalogue =>
  parseOwnershipCatalogue({ version: 1, threshold: 30, roots, rules });

const scriptRoot = (id = "scripts"): Record<string, unknown> => ({
  id,
  prefix: "scripts/",
  allowedTargetPrefixes: ["scripts/"],
});

const scriptRule = (
  id: string,
  pattern: string,
  target = "scripts/gates/$1",
): Record<string, unknown> => ({
  id,
  scope: "scripts",
  pattern,
  concern: "fixture",
  role: "implementation",
  target,
});

const densityCatalogue = (): OwnershipCatalogue =>
  catalogueFixture(
    [scriptRoot()],
    [scriptRule("all-scripts", "^scripts/(.+)$")],
  );

const densityFiles = (count: number): readonly string[] =>
  Array.from(
    { length: count },
    (_, index) => `scripts/fixture-${String(index + 1)}.ts`,
  );

const densityBaseline = (
  files: readonly string[],
  boundedFlatExceptions: readonly Record<string, unknown>[] = [],
): DensityBaseline =>
  parseDensityBaseline({
    version: 1,
    threshold: 30,
    sourceIdentity: { scripts: sourceIdentityOf(files, "fixture-tree") },
    directCounts: Object.fromEntries(
      Object.entries(directFileCounts(files)).filter(
        ([, directFiles]) => directFiles > 30,
      ),
    ),
    boundedFlatExceptions,
  });

const virtualApiTestSource = (
  entries: readonly (readonly [string, string])[],
) => {
  const sources = new Map(entries);
  return (file: string): string => sources.get(file) ?? "";
};

const virtualWebSource = virtualApiTestSource;

void test("the checked catalogue gives every tracked in-scope file one owner", () => {
  const validation = validateOwnership(trackedFiles(), OWNERSHIP_CATALOGUE);
  assert.equal(ownershipPasses(validation), true);
  assert.deepEqual(validation.errors, []);
  assert.equal(
    new Set(validation.matches.map((match) => match.file)).size,
    validation.matches.length,
  );
});

void test("inventory rejects deleted tracked worktree paths", () => {
  assert.throws(
    () => inventoryFiles(["scripts/deleted-from-worktree.ts"]),
    /Deleted tracked worktree paths: scripts\/deleted-from-worktree\.ts/,
  );
});

void test("shared repo-root implementation and test have distinct catalogue roles", () => {
  const sharedCatalogue = parseOwnershipCatalogue({
    version: OWNERSHIP_CATALOGUE.version,
    threshold: OWNERSHIP_CATALOGUE.threshold,
    roots: OWNERSHIP_CATALOGUE.roots.filter((root) => root.id === "scripts"),
    rules: OWNERSHIP_CATALOGUE.rules.filter((rule) =>
      ["scripts-shared-implementation", "scripts-shared-tests"].includes(
        rule.id,
      ),
    ),
  });
  const validation = validateOwnership(
    ["scripts/shared/repo-root.ts", "scripts/shared/repo-root.test.ts"],
    sharedCatalogue,
  );
  assert.deepEqual(validation.errors, []);
  assert.deepEqual(
    validation.matches
      .map(({ file, role }) => ({ file, role }))
      .toSorted((left, right) => left.file.localeCompare(right.file)),
    [
      { file: "scripts/shared/repo-root.test.ts", role: "test" },
      { file: "scripts/shared/repo-root.ts", role: "implementation" },
    ],
  );
});

void test("the stored baseline has one identity for every catalogue root", () => {
  const baseline = readBaseline();
  const files = trackedFiles();
  assert.deepEqual(
    validateBaselineRoots(baseline, OWNERSHIP_CATALOGUE.roots),
    [],
  );
  const density = validateDensity(
    files,
    OWNERSHIP_CATALOGUE,
    baseline,
    currentSourceIdentity(files),
  );
  assert.deepEqual(density.errors, []);
});

void test("catalogue schema rejects unsafe or ambiguous rules", () => {
  assert.doesNotThrow(() =>
    catalogueFixture(
      [
        {
          ...scriptRoot(),
          allowedTargetPrefixes: ["scripts/gates/"],
          allowedTargets: ["scripts/lint-gate.ts"],
        },
      ],
      [
        scriptRule(
          "exact-root-entrypoint",
          String.raw`^scripts/lint-gate\.ts$`,
          "scripts/lint-gate.ts",
        ),
      ],
    ),
  );
  assert.throws(
    () =>
      catalogueFixture(
        [scriptRoot()],
        [
          scriptRule("same", "^scripts/a.ts$"),
          scriptRule("same", "^scripts/b.ts$"),
        ],
      ),
    /Duplicate ownership rules: same/,
  );
  assert.throws(
    () =>
      catalogueFixture(
        [scriptRoot()],
        [scriptRule("unanchored", "scripts/a.ts")],
      ),
    /must be anchored/,
  );
  assert.throws(
    () =>
      catalogueFixture(
        [scriptRoot()],
        [{ ...scriptRule("bad-role", "^scripts/a.ts$"), role: "unknown" }],
      ),
    /invalid role/,
  );
  assert.throws(
    () =>
      catalogueFixture(
        [scriptRoot()],
        [
          scriptRule(
            "absolute-target",
            "^scripts/a.ts$",
            ["/", "outside/$1"].join(""),
          ),
        ],
      ),
    /must be repository-relative/,
  );
  assert.throws(
    () =>
      catalogueFixture(
        [scriptRoot()],
        [scriptRule("parent-target", "^scripts/a.ts$", "scripts/../$1")],
      ),
    /must not contain '..' path segments/,
  );
  assert.throws(
    () =>
      catalogueFixture(
        [scriptRoot()],
        [scriptRule("outside-target", "^scripts/a.ts$", "e2e/$1")],
      ),
    /outside allowed target homes/,
  );
  assert.throws(
    () =>
      catalogueFixture(
        [{ id: "scripts", prefix: "scripts/" }],
        [scriptRule("missing-target-homes", "^scripts/a.ts$")],
      ),
    /allowedTargetPrefixes/,
  );
});

void test("ownership validator catches missing, duplicate, and stale ownership", () => {
  const missing = validateOwnership(
    ["scripts/orphan.test.ts"],
    catalogueFixture([scriptRoot()], []),
  );
  assert.deepEqual(missing.missingOwners, ["scripts/orphan.test.ts"]);

  const duplicate = validateOwnership(
    ["scripts/a.ts"],
    catalogueFixture(
      [scriptRoot()],
      [
        scriptRule("first", "^scripts/a.ts$"),
        scriptRule("second", "^scripts/a.ts$"),
      ],
    ),
  );
  assert.deepEqual(duplicate.duplicateOwners, ["scripts/a.ts"]);

  const duplicateTarget = validateOwnership(
    ["scripts/a.ts", "scripts/b.ts"],
    catalogueFixture(
      [scriptRoot()],
      [
        scriptRule("a", "^scripts/a.ts$", "scripts/gates/shared.ts"),
        scriptRule("b", "^scripts/b.ts$", "scripts/gates/shared.ts"),
      ],
    ),
  );
  assert.deepEqual(duplicateTarget.duplicateTargets, [
    "scripts/gates/shared.ts",
  ]);

  const stale = validateOwnership(
    ["scripts/a.ts"],
    catalogueFixture(
      [
        scriptRoot(),
        {
          id: "empty",
          prefix: "e2e/empty/",
          allowedTargetPrefixes: ["e2e/empty/"],
        },
      ],
      [
        scriptRule("present", "^scripts/a.ts$"),
        scriptRule("stale", "^scripts/b.ts$"),
      ],
    ),
  );
  assert.deepEqual(stale.staleRules, ["stale"]);
  assert.deepEqual(stale.staleRoots, ["empty"]);

  const invalidPath = validateOwnership(
    ["scripts/../outside.ts"],
    catalogueFixture([scriptRoot()], [scriptRule("all", "^scripts/(.+)$")]),
  );
  assert.deepEqual(invalidPath.invalidPaths, [
    "invalid catalogue path: scripts/../outside.ts must not contain '..' path segments",
  ]);

  const invalidTarget = validateOwnership(["scripts/a.ts"], {
    version: 1,
    threshold: 30,
    roots: [scriptRoot()],
    rules: [
      scriptRule(
        "unsafe-target",
        "^scripts/(.+)$",
        ["/", "outside/$1"].join(""),
      ),
    ],
  } as unknown as OwnershipCatalogue);
  assert.deepEqual(invalidTarget.invalidTargets, [
    "invalid target path: unsafe-target -> /outside/a.ts must be repository-relative",
  ]);
});

void test("density ratchet accepts a bounded flat exception at its baseline", () => {
  const files = densityFiles(31);
  const baseline = densityBaseline(files, [
    {
      directory: "scripts",
      baseline: 31,
      reason: "fixture exception",
    },
  ]);
  const validation = validateDensity(files, densityCatalogue(), baseline);
  assert.deepEqual(validation.unexplained, []);
  assert.deepEqual(validation.regressedExceptions, []);
  assert.equal(densityPasses(validation), true);
});

void test("density ratchet catches unexplained and regressed directories", () => {
  const files = densityFiles(31);
  const noException = validateDensity(
    files,
    densityCatalogue(),
    densityBaseline(files),
  );
  assert.deepEqual(
    noException.unexplained.map(({ directory }) => directory),
    ["scripts"],
  );
  assert.equal(densityPasses(noException), false);

  const regressed = validateDensity(
    densityFiles(32),
    densityCatalogue(),
    densityBaseline(files, [
      {
        directory: "scripts",
        baseline: 31,
        reason: "fixture exception",
      },
    ]),
  );
  assert.deepEqual(
    regressed.regressedExceptions.map(({ directory }) => directory),
    ["scripts"],
  );
  assert.equal(densityPasses(regressed), false);
});

void test("density ratchet requires the exact current over-threshold directCounts map", () => {
  const files = densityFiles(31);
  const baseline = densityBaseline(files, [
    {
      directory: "scripts",
      baseline: 31,
      reason: "fixture exception",
    },
  ]);

  const stale = validateDensity(
    files,
    densityCatalogue(),
    parseDensityBaseline({
      ...baseline,
      directCounts: { scripts: 31, "scripts/stale": 31 },
    }),
  );
  assert.deepEqual(stale.directCountViolations, [
    "baseline directCounts has stale directory: scripts/stale",
  ]);

  const missing = validateDensity(
    files,
    densityCatalogue(),
    parseDensityBaseline({ ...baseline, directCounts: {} }),
  );
  assert.deepEqual(missing.directCountViolations, [
    "baseline directCounts is missing directory: scripts",
  ]);

  const drifted = validateDensity(
    files,
    densityCatalogue(),
    parseDensityBaseline({
      ...baseline,
      directCounts: { scripts: 32 },
    }),
  );
  assert.deepEqual(drifted.directCountViolations, [
    "baseline directCounts count drift: scripts=32 != 31",
  ]);
  assert.equal(densityPasses(stale), false);
  assert.equal(densityPasses(missing), false);
  assert.equal(densityPasses(drifted), false);
});

void test("density ratchet rejects stale extra baseline roots", () => {
  const files = densityFiles(31);
  const baseline = densityBaseline(files, [
    {
      directory: "scripts",
      baseline: 31,
      reason: "fixture exception",
    },
  ]);
  const validation = validateDensity(
    files,
    densityCatalogue(),
    parseDensityBaseline({
      ...baseline,
      sourceIdentity: {
        ...baseline.sourceIdentity,
        stale: sourceIdentityOf([], "stale-tree"),
      },
    }),
  );
  assert.deepEqual(validation.baselineViolations, [
    "baseline has stale source root: stale",
  ]);
  assert.equal(densityPasses(validation), false);
});

void test("source identity rejects a moved or newly tracked path", () => {
  const files = densityFiles(31);
  const baseline = sourceIdentityOf(files, "fixture-tree");
  const changed = sourceIdentityOf(
    [...files, "scripts/new.ts"],
    "fixture-tree",
  );
  assert.notEqual(pathDigest(files), pathDigest([...files, "scripts/new.ts"]));
  assert.match(
    sourceIdentityViolations({ scripts: baseline }, { scripts: changed })[0] ??
      "",
    /stale structural baseline for scripts/,
  );
  assert.match(
    validateDensity(
      files,
      densityCatalogue(),
      densityBaseline(files, [
        {
          directory: "scripts",
          baseline: 31,
          reason: "fixture exception",
        },
      ]),
      { scripts: changed },
    ).errors[0] ?? "",
    /stale structural baseline for scripts/,
  );
});

void test("source identity is structural and ignores content-only tree changes", () => {
  const files = densityFiles(31);
  assert.deepEqual(
    sourceIdentityViolations(
      { scripts: sourceIdentityOf(files, "before-content-change") },
      { scripts: sourceIdentityOf(files, "after-content-change") },
    ),
    [],
  );
});

void test("baseline parser fails closed on malformed data", () => {
  assert.throws(
    () => parseDensityBaseline({ ...readBaseline(), version: 2 }),
    /Unsupported density baseline version/,
  );
  assert.throws(
    () => parseDensityBaseline({ ...readBaseline(), threshold: 31 }),
    /threshold must be exactly 30/,
  );
});

void test("API test boundary rejects deep import, export, and dynamic-import edges", () => {
  const file = "apps/api/src/modules/period/api-boundary.test.ts";
  const violations = findApiTestBoundaryViolations(
    [file],
    virtualApiTestSource([
      [
        file,
        [
          'import { WeeklyReportPrismaRepository } from "../weekly-report/weekly-report.prisma-repository.js";',
          'export { PeriodAdminService } from "../admin/period-admin.service.js";',
          'void import("../weekly-report/weekly-report.service.js");',
        ].join("\n"),
      ],
    ]),
  );

  assert.deepEqual(violations.map(formatApiTestBoundaryViolation), [
    `${file}: API test boundary violation: import "../admin/period-admin.service.js" resolves to apps/api/src/modules/admin/period-admin.service; use the sibling index.ts facade or test-seams/index.ts seam.`,
    `${file}: API test boundary violation: import "../weekly-report/weekly-report.prisma-repository.js" resolves to apps/api/src/modules/weekly-report/weekly-report.prisma-repository; use the sibling index.ts facade or test-seams/index.ts seam.`,
    `${file}: API test boundary violation: import "../weekly-report/weekly-report.service.js" resolves to apps/api/src/modules/weekly-report/weekly-report.service; use the sibling index.ts facade or test-seams/index.ts seam.`,
  ]);
});

void test("API test boundary allows same-module imports, sibling facades, and test seams", () => {
  const file = "apps/api/src/modules/period/api-boundary.test.ts";
  assert.deepEqual(
    findApiTestBoundaryViolations(
      [file],
      virtualApiTestSource([
        [
          file,
          [
            'import { PeriodService } from "./application/period.service.js";',
            'export { WeeklyReportService } from "../weekly-report/index.js";',
            'void import("../admin/test-seams/index.js");',
          ].join("\n"),
        ],
      ]),
    ),
    [],
  );
});

void test("current API test tree has no deep cross-module import edges", () => {
  assert.deepEqual(
    findApiTestBoundaryViolations(trackedFiles()).map(
      formatApiTestBoundaryViolation,
    ),
    [],
  );
});

void test("web feature boundary rejects deep import, export, and dynamic-import edges", () => {
  const file = "apps/web/src/features/viewer/ui/viewer-boundary.test.tsx";
  const violations = findWebFeatureBoundaryViolations(
    [file],
    virtualWebSource([
      [
        file,
        [
          'import { LeadForm } from "../../report-pages/ui/lead-form";',
          'export { StageChip } from "../../report-sections/ui/stage-chip";',
          'void import("../../period/model/use-report-history-data");',
          'vi.mock("../../review/ui/section-verdict-control", () => ({}));',
        ].join("\n"),
      ],
    ]),
  );

  assert.deepEqual(violations.map(formatWebFeatureBoundaryViolation), [
    `${file}: web feature boundary violation: import "../../period/model/use-report-history-data" resolves to apps/web/src/features/period/model/use-report-history-data; use the sibling feature facade.`,
    `${file}: web feature boundary violation: import "../../report-pages/ui/lead-form" resolves to apps/web/src/features/report-pages/ui/lead-form; use the sibling feature facade.`,
    `${file}: web feature boundary violation: import "../../report-sections/ui/stage-chip" resolves to apps/web/src/features/report-sections/ui/stage-chip; use the sibling feature facade.`,
    `${file}: web feature boundary violation: import "../../review/ui/section-verdict-control" resolves to apps/web/src/features/review/ui/section-verdict-control; use the sibling feature facade.`,
  ]);
});

void test("web feature boundary allows same-feature paths and sibling facades", () => {
  const file = "apps/web/src/features/viewer/ui/viewer-boundary.test.tsx";
  assert.deepEqual(
    findWebFeatureBoundaryViolations(
      [file],
      virtualWebSource([
        [
          file,
          [
            'import { ViewerShell } from "./viewer-shell";',
            'export { WeeklyReportPage } from "../../report-pages";',
            'void import("../../period/index");',
            'export { useLeadFormAutosave } from "../../report-sections/client";',
          ].join("\n"),
        ],
      ]),
    ),
    [],
  );
});

void test("current web feature tree has no deep cross-slice imports", () => {
  assert.deepEqual(
    findWebFeatureBoundaryViolations(trackedFiles()).map(
      formatWebFeatureBoundaryViolation,
    ),
    [],
  );
});
