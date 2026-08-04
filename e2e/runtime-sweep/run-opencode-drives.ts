import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseSeedProfile } from "../../prisma/seed-profile-contract.js";
import { setupE2eDatabase } from "../helpers/e2e-database-setup.js";
import { CANONICAL_ROLES, type Role, SEED_PROFILES } from "./contracts.js";
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

function renderPrompt(template: string, role: Role, sourceSha: string): string {
  const identity = DRIVER_IDENTITIES[role];
  return template
    .replaceAll("<ROLE>", role)
    .replaceAll("<EMAIL>", identity.email)
    .replaceAll("<LANDING>", identity.landing)
    .replaceAll("<CATALOG>", identity.catalog)
    .replaceAll("<SOURCE_SHA>", sourceSha);
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
  const result = await runOpenCodeDrive({
    maxTurns: MAX_SESSION_TURNS,
    prompt: renderPrompt(template, role, environment.sourceSha),
    repoRoot: environment.repoRoot,
  });
  const report = parseOpenCodeDriverReport(
    result.finalText,
    environment.sourceSha,
  );
  const outputDir = path.join(
    environment.archive,
    "driver",
    environment.sourceSha,
    profile,
  );
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(outputDir, `${role}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
    ),
    writeFile(
      path.join(outputDir, `${role}.session.json`),
      `${JSON.stringify({ sessionId: result.sessionId, transcripts: result.transcripts }, null, 2)}\n`,
    ),
  ]);
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
