export type ExemplaryFileKind = "product" | "test" | "tooling" | "config";

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
