export type ExemplaryFileKind = "product" | "test" | "tooling" | "config";

export type ExemplaryFileRoleId =
  | "maintained-product"
  | "externally-constrained-adapter"
  | "test"
  | "fixture"
  | "generated"
  | "seed"
  | "config"
  | "tooling";

export interface ExemplaryFileRole {
  readonly id: ExemplaryFileRoleId;
  readonly kind: ExemplaryFileKind;
  readonly owner: string;
  readonly rationale: string;
  readonly structuralScope: "maintained-product" | "separately-measured";
}

const TEST_INFRA =
  /(?:(?:^|\/)(?:test-utils|__tests__|__fixtures__)\/)|(?:(?:-harness|\.fixture|\.fixtures|\.setup|-stubs?)\.tsx?$)/;
const TEST_SUFFIXES = [
  ".test.ts",
  ".test.tsx",
  ".spec.ts",
  ".spec.tsx",
] as const;
const TOOLING_PREFIXES = ["scripts/", "tools/", "prisma/", "e2e/"] as const;
const CONFIG_PREFIXES = ["eslint-config/"] as const;
const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
] as const;
const FIXTURE_STEMS = [
  ".fixture",
  ".fixtures",
  "-fixture",
  "-fixtures",
  "-test-fixture",
  "-test-fixtures",
] as const;
const EXTERNALLY_CONSTRAINED_ADAPTER = new RegExp(
  [
    String.raw`^apps/api/src/main\.ts$`,
    String.raw`^apps/(?:api|web)/src/.+\.adapter\.tsx?$`,
    String.raw`^apps/web/src/app/(?:.*/)?(?:page|layout|route|template|default|loading|error|global-error|not-found)\.tsx?$`,
    String.raw`^apps/web/src/proxy\.ts$`,
  ].join("|"),
);

interface RoleMetadata {
  readonly owner: string;
  readonly rationale: string;
}

const pathSegments = (file: string): readonly string[] => file.split("/");

const sourceStem = (file: string): string => {
  const extension = SOURCE_EXTENSIONS.find((suffix) => file.endsWith(suffix));
  return extension === undefined ? file : file.slice(0, -extension.length);
};

const isGeneratedSource = (file: string): boolean =>
  pathSegments(file).includes("generated") ||
  sourceStem(file).endsWith(".generated");

const isFixtureSource = (file: string): boolean =>
  pathSegments(file).some(
    (segment) =>
      segment === "__fixtures__" ||
      segment === "fixture" ||
      segment === "fixtures",
  ) || FIXTURE_STEMS.some((suffix) => sourceStem(file).endsWith(suffix));

const isSeedSource = (file: string): boolean =>
  file === "prisma/seed.ts" ||
  file.startsWith("prisma/seeds/") ||
  (file.startsWith("prisma/operations/") &&
    sourceStem(file).includes(".seed")) ||
  file.startsWith("e2e/seed-profiles/");

export const exemplaryFileRoleMetadata: Readonly<
  Record<ExemplaryFileRoleId, RoleMetadata>
> = {
  "maintained-product": {
    owner: "CustomReport product maintainers",
    rationale: "Hand-written product behavior is governed by the strict floor.",
  },
  "externally-constrained-adapter": {
    owner: "CustomReport integration maintainers",
    rationale:
      "Framework entrypoints and named adapters preserve external contracts but remain maintained product code.",
  },
  test: {
    owner: "CustomReport test maintainers",
    rationale:
      "Executable verification has test-specific readability and literal-data constraints.",
  },
  fixture: {
    owner: "CustomReport test-data maintainers",
    rationale:
      "Fixture modules model test data; existing product classification is preserved unless a measured scope proves separation.",
  },
  generated: {
    owner: "CustomReport generator maintainers",
    rationale:
      "Generated output is governed by its generator and reproducibility checks.",
  },
  seed: {
    owner: "CustomReport seed maintainers",
    rationale:
      "Seed programs are operational data builders with separately measured constraints.",
  },
  config: {
    owner: "CustomReport toolchain maintainers",
    rationale:
      "Configuration modules implement tool contracts rather than product behavior.",
  },
  tooling: {
    owner: "CustomReport developer-experience maintainers",
    rationale:
      "Repository tooling is measured independently from maintained product code.",
  },
};

export function classifyExemplaryFile(file: string): ExemplaryFileKind {
  if (
    TEST_SUFFIXES.some((suffix) => file.endsWith(suffix)) ||
    TEST_INFRA.test(file)
  ) {
    return "test";
  }
  if (TOOLING_PREFIXES.some((prefix) => file.startsWith(prefix))) {
    return "tooling";
  }
  return file.endsWith(".config.ts") ||
    CONFIG_PREFIXES.some((prefix) => file.startsWith(prefix))
    ? "config"
    : "product";
}

const roleId = (file: string, kind: ExemplaryFileKind): ExemplaryFileRoleId => {
  if (isGeneratedSource(file)) return "generated";
  if (isFixtureSource(file)) return "fixture";
  if (isSeedSource(file)) return "seed";
  if (kind === "test") return "test";
  if (kind === "config") return "config";
  if (kind === "tooling") return "tooling";
  return EXTERNALLY_CONSTRAINED_ADAPTER.test(file)
    ? "externally-constrained-adapter"
    : "maintained-product";
};

export function classifyExemplaryFileRole(file: string): ExemplaryFileRole {
  const kind = classifyExemplaryFile(file);
  const id = roleId(file, kind);
  return {
    id,
    kind,
    ...exemplaryFileRoleMetadata[id],
    structuralScope:
      kind === "product" ? "maintained-product" : "separately-measured",
  };
}
