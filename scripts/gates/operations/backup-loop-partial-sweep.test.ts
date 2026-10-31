import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { afterEach, test } from "vitest";

import {
  backupHealthScript,
  backupScript,
  createBackupFixture,
  finiteDump,
  oneShot,
  removeFixtureRoots,
  runBackup,
} from "./backup-loop.fixtures.ts";

afterEach(removeFixtureRoots);

test("unique published names remain subject to retention and health freshness", () => {
  const { directory, result, runAgain } = runBackup(
    { ...oneShot, BACKUP_PAYLOAD: "finite-fixture" },
    {
      pgDump: finiteDump,
      timeoutMs: 10_000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const backups = join(directory, "backups");
  const oldDump = join(backups, "weeklyreport-old.dump");
  const recentDump = join(backups, "weeklyreport-recent.dump");
  const otherFile = join(backups, "other-product.dump");
  const partialName = "weeklyreport-old.partial.fixture";
  const partial = join(backups, partialName);
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = new Date(Date.now() - 24 * 60 * 60 * 1000);
  for (const file of [oldDump, otherFile, partial]) {
    writeFileSync(file, "old-finite-fixture");
    utimesSync(file, old, old);
  }
  writeFileSync(recentDump, "recent-finite-fixture");
  utimesSync(recentDump, recent, recent);
  assert.equal(runAgain().status, 0);
  assert.ok(!readdirSync(backups).includes("weeklyreport-old.dump"));
  assert.equal(readFileSync(recentDump, "utf8"), "recent-finite-fixture");
  assert.equal(readFileSync(otherFile, "utf8"), "old-finite-fixture");
  assert.ok(!readdirSync(backups).includes(partialName), "partial kept");
  const health = () =>
    spawnSync("/bin/sh", [backupHealthScript], {
      env: {
        ...process.env,
        BACKUP_DIR: backups,
        BACKUP_INTERVAL_SECONDS: "3600",
      },
      encoding: "utf8",
      timeout: 10_000,
    });
  assert.equal(
    health().status,
    0,
    "health did not recognize a unique published dump",
  );
  for (const file of readdirSync(backups).filter(
    (file) => file.startsWith("weeklyreport-") && file.endsWith(".dump"),
  )) {
    utimesSync(join(backups, file), old, old);
  }
  writeFileSync(partial, "fresh-partial");
  utimesSync(partial, new Date(), new Date());
  assert.equal(health().status, 1, "a partial file hid stale complete dumps");
});

test("a held writer lock leaves partial files in place", () => {
  const { directory, environment } = createBackupFixture(oneShot, {
    additional: { flock: "exit 1" },
  });
  const backups = join(directory, "backups");
  mkdirSync(backups);
  const partial = join(backups, "weeklyreport-old.partial.fixture");
  writeFileSync(partial, "held-lock-fixture");
  const result = spawnSync("/bin/sh", [backupScript], {
    env: environment(),
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.status, 75, result.stderr);
  assert.equal(readFileSync(partial, "utf8"), "held-lock-fixture");
});
