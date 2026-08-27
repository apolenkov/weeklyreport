import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MOBILE_WIDTH = 375;
const SETTINGS_WIDE_WIDTH = 768;
const PRIMARY_COMPACT_BOUNDARY_WIDTH = 1023;
const PRIMARY_WIDE_WIDTH = 1024;
const DESKTOP_WIDTH = 1280;
const MAX_GIT_BUFFER_BYTES = 33_554_432;

const ADMIN_RESPONSIVE_WIDTHS = [
  MOBILE_WIDTH,
  SETTINGS_WIDE_WIDTH,
  PRIMARY_COMPACT_BOUNDARY_WIDTH,
  PRIMARY_WIDE_WIDTH,
  DESKTOP_WIDTH,
] as const;
export const MAX_DISPLAY_COUNT = 142;

type AdminResponsiveWidth = (typeof ADMIN_RESPONSIVE_WIDTHS)[number];
type ResponsivePresentation = "compact" | "wide";

export interface AdminResponsiveCase {
  readonly width: AdminResponsiveWidth;
  readonly primary: ResponsivePresentation;
  readonly settings: ResponsivePresentation;
  readonly statusVariant: "maximum-display";
}

export interface ResponsiveSourceBinding {
  readonly baseSha: string;
  readonly baseTree: string;
  readonly trackedDiffDigest: string;
  readonly untrackedContentsDigest: string;
  readonly statusDigest: string;
  readonly materialSources: readonly {
    readonly path: string;
    readonly digest: string;
  }[];
}

const MATERIAL_SOURCE_PATHS = [
  "apps/web/src/app/(app)/admin/page.tsx",
  "apps/web/src/features/admin/model/admin-tab-dependencies.ts",
  "apps/web/src/features/admin/ui/admin-tabs-mobile-select.tsx",
  "apps/web/src/features/admin/ui/settings-tab.tsx",
  "apps/web/src/shared/ui/tabs/tab-count-pill.tsx",
  "e2e/integration/admin-responsive-navigation-harness.ts",
  "e2e/integration/admin-responsive-navigation.integration.spec.ts",
  "openspec/changes/repair-admin-responsive-navigation/specs/admin-settings-ui/spec.md",
] as const;

const digest = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

const runGit = async (repoRoot: string, args: readonly string[]) => {
  const { stdout } = await execFileAsync("git", [...args], {
    cwd: repoRoot,
    maxBuffer: MAX_GIT_BUFFER_BYTES,
  });
  return stdout;
};

async function untrackedContentsDigest(repoRoot: string): Promise<string> {
  const output = await runGit(repoRoot, [
    "ls-files",
    "--others",
    "--exclude-standard",
  ]);
  const paths = output
    .split("\n")
    .filter((entry) => entry.length > 0)
    .toSorted((left, right) => left.localeCompare(right));
  const entries = await Promise.all(
    paths.map(async (relativePath) => ({
      path: relativePath,
      digest: digest(await readFile(path.join(repoRoot, relativePath))),
    })),
  );
  return digest(JSON.stringify(entries));
}

export const ADMIN_RESPONSIVE_CASES: readonly AdminResponsiveCase[] =
  ADMIN_RESPONSIVE_WIDTHS.map((width) => ({
    width,
    primary: width < PRIMARY_WIDE_WIDTH ? "compact" : "wide",
    settings: width < SETTINGS_WIDE_WIDTH ? "compact" : "wide",
    statusVariant: "maximum-display",
  }));

export async function readResponsiveSourceBinding(
  repoRoot: string,
): Promise<ResponsiveSourceBinding> {
  const [baseSha, baseTree, trackedDiff, status, untrackedDigest] =
    await Promise.all([
      runGit(repoRoot, ["rev-parse", "--verify", "HEAD"]),
      runGit(repoRoot, ["rev-parse", "--verify", "HEAD^{tree}"]),
      runGit(repoRoot, ["diff", "HEAD", "--binary"]),
      runGit(repoRoot, ["status", "--porcelain=v1", "--untracked-files=all"]),
      untrackedContentsDigest(repoRoot),
    ]);
  const materialSources = await Promise.all(
    MATERIAL_SOURCE_PATHS.map(async (relativePath) => ({
      path: relativePath,
      digest: digest(await readFile(path.join(repoRoot, relativePath))),
    })),
  );
  return {
    baseSha: baseSha.trim(),
    baseTree: baseTree.trim(),
    trackedDiffDigest: digest(trackedDiff),
    untrackedContentsDigest: untrackedDigest,
    statusDigest: digest(status),
    materialSources,
  };
}
