import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseSeedProfile } from "../../prisma/seed-profile-contract.js";
import { setupE2eDatabase } from "../helpers/e2e-database-setup.js";
import {
  CANONICAL_ROLES,
  type CoverageCell,
  coverageCellSchema,
  type Role,
  SEED_PROFILES,
} from "./contracts.js";
import {
  type DriverValidationInput,
  mergeDriverReport,
  renderDriverAssignment,
  writeMergedDriverCells,
} from "./driver-results.js";
import {
  assertPlaywrightMcpConnected,
  parseOpenCodeDriverReport,
  runOpenCodeDrive,
} from "./opencode-runner.js";

interface DriverIdentity {
  readonly catalog: string;
  readonly email: string;
  readonly landing: string;
}

interface DriveEnvironment {
  readonly archive: string;
  readonly databaseUrl: string;
  readonly repoRoot: string;
  readonly sourceSha: string;
}

const MAX_SESSION_TURNS = 4;
const DRIVER_IDENTITIES: Readonly<Record<Role, DriverIdentity>> = {
  lead: {
    catalog: "e2e/catalog/lead.yaml",
    email: "lead1@customreport.local",
    landing: "%2Flead%2Freport",
  },
  head: {
    catalog: "e2e/catalog/head.yaml",
    email: "head@customreport.local",
    landing: "%2Fhead%2Fdashboard",
  },
  admin: {
    catalog: "e2e/catalog/admin.yaml",
    email: "admin@customreport.local",
    landing: "%2Fadmin",
  },
  viewer: {
    catalog: "e2e/catalog/viewer.yaml",
    email: "viewer@customreport.local",
    landing: "%2Freports%3Ftab%3Dpublished",
  },
};

function requireEnvironment(repoRoot: string): DriveEnvironment {
  const archive = process.env.RUNTIME_SWEEP_ARCHIVE;
  const databaseUrl = process.env.E2E_DATABASE_URL;
  const sourceSha = process.env.RUNTIME_SWEEP_SOURCE_SHA;
  if (!archive || !databaseUrl || !sourceSha) {
    throw new Error(
      "RUNTIME_SWEEP_ARCHIVE, RUNTIME_SWEEP_SOURCE_SHA, and E2E_DATABASE_URL are required",
    );
  }
  const head = execFileSync("/usr/bin/git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  const status = execFileSync("/usr/bin/git", ["status", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  if (head !== sourceSha || status !== "") {
    throw new Error("Runtime sweep requires the declared clean source SHA");
  }
  return { archive: path.resolve(archive), databaseUrl, repoRoot, sourceSha };
}

async function readAssignedCells(
  environment: DriveEnvironment,
  profile: (typeof SEED_PROFILES)[number],
  role: Role,
): Promise<readonly CoverageCell[]> {
  const directory = path.join(environment.archive, "cells", profile, role);
  const entries = await readdir(directory);
  const files = entries
    .filter((entry) => entry.endsWith(".json"))
    .toSorted((left, right) => left.localeCompare(right));
  if (files.length === 0)
    throw new Error(`No runtime cells assigned to ${profile}/${role}`);
  return Promise.all(
    files.map(async (file) =>
      coverageCellSchema.parse(
        JSON.parse(await readFile(path.join(directory, file), "utf8")),
      ),
    ),
  );
}

function renderPrompt(
  template: string,
  role: Role,
  profile: (typeof SEED_PROFILES)[number],
  sourceSha: string,
  assignment: DriverValidationInput,
): string {
  const identity = DRIVER_IDENTITIES[role];
  return template
    .replaceAll("<ROLE>", role)
    .replaceAll("<EMAIL>", identity.email)
    .replaceAll("<LANDING>", identity.landing)
    .replaceAll("<CATALOG>", identity.catalog)
    .replaceAll("<SOURCE_SHA>", sourceSha)
    .replaceAll("<PROFILE>", profile)
    .replaceAll("<ASSIGNED_CELLS>", renderDriverAssignment(assignment));
}

async function driveRole(
  environment: DriveEnvironment,
  template: string,
  profile: (typeof SEED_PROFILES)[number],
  role: Role,
): Promise<void> {
  setupE2eDatabase({
    databaseUrl: environment.databaseUrl,
    profile: parseSeedProfile(profile),
    repoRoot: environment.repoRoot,
  });
  const cells = await readAssignedCells(environment, profile, role);
  const validation: DriverValidationInput = {
    sourceSha: environment.sourceSha,
    profile,
    role,
    cells,
  };
  const result = await runOpenCodeDrive({
    maxTurns: MAX_SESSION_TURNS,
    prompt: renderPrompt(
      template,
      role,
      profile,
      environment.sourceSha,
      validation,
    ),
    repoRoot: environment.repoRoot,
  });
  const outputDir = path.join(
    environment.archive,
    "driver",
    environment.sourceSha,
    profile,
  );
  const reportPath = path.join(outputDir, `${role}.json`);
  const reportText = `${result.finalText.trimEnd()}\n`;
  const report = parseOpenCodeDriverReport(reportText, validation);
  const merged = mergeDriverReport(cells, report, {
    ...validation,
    reportText,
    reportArchivePath: reportPath,
  });
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(reportPath, reportText),
    writeFile(
      path.join(outputDir, `${role}.session.json`),
      `${JSON.stringify({ sessionId: result.sessionId, transcripts: result.transcripts }, null, 2)}\n`,
    ),
  ]);
  await writeMergedDriverCells(path.join(outputDir, "cells"), merged);
}

async function run(): Promise<void> {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  const environment = requireEnvironment(repoRoot);
  const template = await readFile(
    path.join(repoRoot, "e2e/sweep/driver/drive-prompt.md"),
    "utf8",
  );
  await assertPlaywrightMcpConnected();
  for (const profile of SEED_PROFILES) {
    for (const role of CANONICAL_ROLES) {
      await driveRole(environment, template, profile, role);
    }
  }
}

await run();
