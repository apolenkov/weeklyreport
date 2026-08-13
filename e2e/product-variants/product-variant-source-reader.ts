import { execFile } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";

import {
  CURRENT_CATALOG_ROLES,
  CURRENT_PRODUCT_VARIANT_SOURCE_PATHS,
  pageFiles,
  pageRouteFor,
  parseCatalogSnapshot,
  type ProductVariantCatalog,
  type ProductVariantDeclaredControlFamily,
  type ProductVariantRoute,
  type ProductVariantSource,
  ProductVariantSourceError,
  type ProductVariantSourceFile,
  readSourceFile,
  repoRelative,
  requireSha,
  revealActionFor,
  revealKinds,
  sourceArray,
  sourceTuple,
} from "./product-variant-source.ts";

const execFileAsync = promisify(execFile);

type SourceTextFile = Awaited<ReturnType<typeof readSourceFile>>;
type PageEntry = Readonly<{ route: string; file: SourceTextFile }>;

const gitValue = async (
  repoRoot: string,
  args: readonly string[],
): Promise<string> => {
  try {
    const result = await execFileAsync("git", [...args], { cwd: repoRoot });
    return result.stdout.trim();
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "git failed";
    throw new ProductVariantSourceError(
      `Cannot read source identity: ${reason}`,
    );
  }
};

const routeMapFor = (
  catalogs: readonly ProductVariantCatalog[],
  pageByRoute: ReadonlyMap<string, ProductVariantSourceFile>,
): readonly ProductVariantRoute[] => {
  const routes = catalogs.flatMap((catalog) =>
    catalog.routes.map((route) => {
      const page = pageByRoute.get(route.route);
      if (page === undefined)
        throw new ProductVariantSourceError(
          `Catalog route has no current App Router page: ${route.route}`,
        );
      return {
        role: catalog.role,
        route: route.route,
        sourcePath: page.path,
        sourceDigest: page.digest,
        catalogPath: catalog.path,
        catalogDigest: catalog.digest,
        catalogRouteDigest: route.digest,
        intentIds: route.intentIds,
      };
    }),
  );
  const identities = routes.map(({ role, route }) => `${role}:${route}`);
  if (new Set(identities).size !== identities.length)
    throw new ProductVariantSourceError(
      "Current catalogs contain duplicate role-route identities",
    );
  return routes;
};

const pageEntriesFor = async (
  root: string,
  pages: readonly string[],
): Promise<readonly PageEntry[]> =>
  Promise.all(
    pages.map(async (absolutePath) => {
      const file = await readSourceFile(root, repoRelative(root, absolutePath));
      return {
        route: pageRouteFor(path.join(root, "apps/web/src/app"), absolutePath),
        file,
      };
    }),
  );

const pageMapFor = (
  pageEntries: readonly PageEntry[],
): ReadonlyMap<string, ProductVariantSourceFile> => {
  const pageByRoute = new Map<string, ProductVariantSourceFile>();
  for (const { route, file } of pageEntries) {
    if (pageByRoute.has(route))
      throw new ProductVariantSourceError(
        `Duplicate App Router route: ${route}`,
      );
    pageByRoute.set(route, file);
  }
  return pageByRoute;
};

const contractFilesFor = (
  contractFiles: readonly SourceTextFile[],
): Readonly<{
  readonly roles: SourceTextFile;
  readonly policy: SourceTextFile;
  readonly planning: SourceTextFile;
  readonly reveal: SourceTextFile;
  readonly contracts: SourceTextFile;
}> => {
  const [roles, policy, planning, reveal, contracts] = contractFiles;
  if (!roles || !policy || !planning || !reveal || !contracts)
    throw new ProductVariantSourceError(
      "Runtime product-variant source files are incomplete",
    );
  if (
    !policy.text.includes("STATEFUL_CONTROL_OPERATIONS") ||
    !planning.text.includes("planLiveControlActions")
  )
    throw new ProductVariantSourceError(
      "Current control policy/planning source is missing its declared contract",
    );
  return { roles, policy, planning, reveal, contracts };
};

const declaredFamiliesFor = (
  rolesSource: SourceTextFile,
): Readonly<{
  readonly families: readonly ProductVariantDeclaredControlFamily[];
  readonly fillRoles: readonly string[];
  readonly selectRoles: readonly string[];
}> => {
  const supportedRoles = sourceArray(
    rolesSource.text,
    "SUPPORTED_CONTROL_ROLES",
  );
  const fillRoles = sourceArray(rolesSource.text, "FORM_FILL_ROLES");
  const selectRoles = sourceArray(rolesSource.text, "FORM_SELECT_ROLES");
  const supportedRoleSet = new Set(supportedRoles);
  if (
    fillRoles.some((role) => !supportedRoleSet.has(role)) ||
    selectRoles.some((role) => !supportedRoleSet.has(role))
  )
    throw new ProductVariantSourceError(
      "Form control roles must be supported control roles",
    );
  const fillSet = new Set(fillRoles);
  const selectSet = new Set(selectRoles);
  const families = supportedRoles.map((controlRole) => ({
    controlRole,
    formKind: fillSet.has(controlRole)
      ? "fill"
      : selectSet.has(controlRole)
        ? "select"
        : "none",
    action: fillSet.has(controlRole)
      ? "fill"
      : selectSet.has(controlRole)
        ? "select"
        : "click",
  })) as readonly ProductVariantDeclaredControlFamily[];
  return { families, fillRoles, selectRoles };
};

const revealFamiliesFor = (
  revealSource: SourceTextFile,
  declared: Readonly<{
    readonly families: readonly ProductVariantDeclaredControlFamily[];
    readonly fillRoles: readonly string[];
    readonly selectRoles: readonly string[];
  }>,
) => {
  const supportedRoles = declared.families.map(
    ({ controlRole }) => controlRole,
  );
  const fillSet = new Set(declared.fillRoles);
  const selectSet = new Set(declared.selectRoles);
  return revealKinds(revealSource.text).map((revealKind) => ({
    revealKind,
    memberControlRoles:
      revealKind === "client-form"
        ? [
            ...new Set([...declared.fillRoles, ...declared.selectRoles]),
          ].toSorted((left, right) => left.localeCompare(right))
        : revealKind === "read-only-click" || revealKind === "ordinary-control"
          ? supportedRoles.filter(
              (role) => !fillSet.has(role) && !selectSet.has(role),
            )
          : [],
    action: revealActionFor(revealKind),
  }));
};

const sourceFilesFor = (
  contractFiles: readonly SourceTextFile[],
  pageEntries: readonly PageEntry[],
): readonly ProductVariantSourceFile[] =>
  [
    ...contractFiles.map(({ path: sourcePath, digest }) => ({
      path: sourcePath,
      digest,
    })),
    ...pageEntries.map(({ file }) => file),
  ].toSorted((left, right) => left.path.localeCompare(right.path));

export async function readProductVariantSource(
  repoRoot: string,
): Promise<ProductVariantSource> {
  const root = path.resolve(repoRoot);
  const [sourceShaRaw, sourceTreeRaw, pages, ...contractFiles] =
    await Promise.all([
      gitValue(root, ["rev-parse", "--verify", "HEAD"]),
      gitValue(root, ["rev-parse", "--verify", "HEAD^{tree}"]),
      pageFiles(path.join(root, "apps/web/src/app")),
      ...CURRENT_PRODUCT_VARIANT_SOURCE_PATHS.map((sourcePath) =>
        readSourceFile(root, sourcePath),
      ),
    ]);
  const sourceSha = requireSha(sourceShaRaw, "HEAD");
  const sourceTree = requireSha(sourceTreeRaw, "HEAD tree");
  const catalogs = await Promise.all(
    CURRENT_CATALOG_ROLES.map((role) => parseCatalogSnapshot(root, role)),
  );
  const pageEntries = await pageEntriesFor(root, pages);
  const pageByRoute = pageMapFor(pageEntries);
  const contracts = contractFilesFor(contractFiles);
  const declared = declaredFamiliesFor(contracts.roles);
  return {
    sourceSha,
    sourceTree,
    sourceFiles: sourceFilesFor(contractFiles, pageEntries),
    catalogs,
    routes: routeMapFor(catalogs, pageByRoute),
    profiles: sourceTuple(contracts.contracts.text, "SEED_PROFILES"),
    declaredControlFamilies: declared.families,
    revealFamilies: revealFamiliesFor(contracts.reveal, declared),
  };
}
