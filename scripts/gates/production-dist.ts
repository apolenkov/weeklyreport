import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  checksApiRuntime,
  hasBareInternalPackageImport,
  isProductionDistMode,
} from "./production-dist-policy.js";

const repoRoot = resolve(import.meta.dirname, "../..");
const requestedMode = process.argv[2] ?? "--all";
if (!isProductionDistMode(requestedMode)) {
  console.error(
    `Unsupported production dist mode: ${requestedMode}. Expected --all, --api, or --shared.`,
  );
  process.exit(2);
}
const mode = requestedMode;
const roots =
  mode === "--api"
    ? [resolve(repoRoot, "apps/api/dist")]
    : mode === "--shared"
      ? [resolve(repoRoot, "packages/shared/dist")]
      : [
          resolve(repoRoot, "apps/api/dist"),
          resolve(repoRoot, "packages/shared/dist"),
        ];
const apiSharedEmitRoot = resolve(
  repoRoot,
  "apps/api/dist/packages/shared/src",
);
const apiPersistenceEmitRoot = resolve(
  repoRoot,
  "apps/api/dist/packages/report-persistence/src",
);
const requiredEntrypoints = [
  ...(checksApiRuntime(mode)
    ? [
        resolve(repoRoot, "apps/api/dist/apps/api/src/main.js"),
        join(apiSharedEmitRoot, "index.js"),
        join(apiPersistenceEmitRoot, "index.js"),
      ]
    : []),
  ...(mode !== "--api"
    ? [resolve(repoRoot, "packages/shared/dist/index.js")]
    : []),
];
const missingEntrypoints = requiredEntrypoints.filter(
  (path) => !existsSync(path) || !statSync(path).isFile(),
);
if (missingEntrypoints.length > 0) {
  console.error(
    `Missing production entrypoints:\n${missingEntrypoints.map((path) => relative(repoRoot, path)).join("\n")}`,
  );
  process.exit(1);
}
const forbiddenNameParts = [
  ".test.js",
  ".spec.js",
  ".integration.test.js",
  ".fixture.js",
  ".fixtures.js",
];
const forbiddenDirectoryParts = ["/__tests__/", "/test-utils/", "/test-seams/"];
const isForbidden = (path: string): boolean => {
  const normalized = relative(repoRoot, path);
  return (
    forbiddenNameParts.some((part) => normalized.endsWith(part)) ||
    forbiddenDirectoryParts.some((part) => normalized.includes(part)) ||
    (normalized.endsWith(".js") &&
      /(?:^|\/)[^/]*(?:stub|harness)[^/]*$/.test(normalized))
  );
};

const files = (root: string): string[] => {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
};
const apiRuntimeFiles = !checksApiRuntime(mode)
  ? []
  : [
      ...files(resolve(repoRoot, "apps/api/dist/apps/api/src")),
      ...files(apiSharedEmitRoot),
      ...files(apiPersistenceEmitRoot),
    ];
if (
  apiRuntimeFiles.some((path) => {
    if (!path.endsWith(".js")) return false;
    const source = readFileSync(path, "utf8");
    return hasBareInternalPackageImport(source);
  })
) {
  console.error("API runtime dist contains a bare internal package import.");
  process.exit(1);
}

const violations = roots.flatMap((root) =>
  files(root)
    .filter(isForbidden)
    .map((path) => relative(repoRoot, path)),
);
if (violations.length > 0) {
  console.error(
    `Production dist contains test-only files:\n${violations.join("\n")}`,
  );
  process.exit(1);
}
for (const root of roots) {
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.error(`Missing production dist: ${relative(repoRoot, root)}`);
    process.exit(1);
  }
}
const apiPackagesRoot = resolve(repoRoot, "apps/api/dist/packages");
if (checksApiRuntime(mode)) {
  const allowedRoots = [apiSharedEmitRoot, apiPersistenceEmitRoot];
  const unexpected = files(apiPackagesRoot).filter(
    (path) => !allowedRoots.some((root) => path.startsWith(`${root}/`)),
  );
  if (unexpected.length > 0 || allowedRoots.some((root) => !existsSync(root))) {
    console.error(
      `API dist contains unexpected package output: ${unexpected.map((path) => relative(repoRoot, path)).join(", ")}`,
    );
    process.exit(1);
  }
}
console.log("Production dist gate passed.");
