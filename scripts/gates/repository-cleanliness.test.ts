import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertRepositoryClean,
  inventoryRepository,
  validateInventory,
  validateOpenSpecIndex,
} from "./repository-cleanliness.ts";

const execFileAsync = promisify(execFile);
const roots: string[] = [];

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "weeklyreport-clean-"));
  roots.push(root);
  await execFileAsync("git", ["init", "-q", "-b", "main"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], {
    cwd: root,
  });
  await execFileAsync("git", ["config", "user.name", "Test"], { cwd: root });
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("repository cleanliness", () => {
  it("detects tracked OpenSpec archive and deferred topology", async () => {
    const root = await repository();
    await mkdir(join(root, "openspec/changes/archive"), { recursive: true });
    await mkdir(join(root, "openspec/deferred"), { recursive: true });
    await writeFile(join(root, "openspec/changes/archive/old.md"), "old");
    await writeFile(join(root, "openspec/deferred/old.md"), "old");
    await execFileAsync("git", ["add", "."], { cwd: root });
    expect(validateInventory(await inventoryRepository(root))).toEqual([
      "tracked: openspec/changes/archive/old.md",
      "tracked: openspec/deferred/old.md",
    ]);
  });

  it("distinguishes forbidden untracked and ignored artifacts", async () => {
    const root = await repository();
    await writeFile(
      join(root, ".gitignore"),
      "ignored/**\n.cache/**\n.env\nnode_modules/\n.next-docker-dev/\napps/web/next-env.d.ts\n",
    );
    await mkdir(join(root, "browser-harness"), { recursive: true });
    await writeFile(join(root, "browser-harness/run.json"), "{}");
    await mkdir(join(root, "ignored"), { recursive: true });
    await writeFile(join(root, "ignored/HANDOFF-test.md"), "handoff");
    await writeFile(join(root, "junk.tmp"), "junk");
    await mkdir(join(root, ".cache"), { recursive: true });
    await writeFile(join(root, ".cache/junk"), "junk");
    await writeFile(join(root, ".env"), "LOCAL_ONLY=true");
    await mkdir(join(root, "node_modules/pkg"), { recursive: true });
    await mkdir(join(root, ".next-docker-dev/cache"), { recursive: true });
    await mkdir(join(root, "apps/web"), { recursive: true });
    await writeFile(join(root, ".next-docker-dev/cache/build"), "generated");
    await writeFile(join(root, "apps/web/next-env.d.ts"), "generated");
    await execFileAsync("git", ["add", ".gitignore"], { cwd: root });
    const inventory = await inventoryRepository(root);
    expect(validateInventory(inventory)).toEqual([
      "ignored: .cache/junk",
      "ignored: ignored/HANDOFF-test.md",
      "untracked: browser-harness/run.json",
      "untracked: junk.tmp",
    ]);
    expect(inventory.ignored).toContain(".env");
    expect(
      inventory.ignored.some((path) => path.startsWith("node_modules/")),
    ).toBe(false);
  });

  it("detects empty directories while allowing stock generated and env trees", async () => {
    const root = await repository();
    await mkdir(join(root, "empty-dir"));
    await mkdir(join(root, ".next/cache"), { recursive: true });
    await mkdir(join(root, ".next-docker-dev/cache"), { recursive: true });
    await mkdir(join(root, ".turbo/cache"), { recursive: true });
    await mkdir(join(root, "dist/assets"), { recursive: true });
    await mkdir(join(root, "coverage/raw"), { recursive: true });
    await mkdir(join(root, "node_modules/pkg"), { recursive: true });
    await writeFile(join(root, ".gitignore"), ".env\n");
    await writeFile(join(root, ".env"), "LOCAL_ONLY=true");
    await expect(assertRepositoryClean(root)).rejects.toThrow(
      "empty: empty-dir",
    );
    expect((await inventoryRepository(root)).emptyDirectories).toEqual([
      "empty-dir",
    ]);
  });

  it("rejects ignored agent and hook installations", async () => {
    const root = await repository();
    await writeFile(join(root, ".gitignore"), ".agents/**\n.husky/_/**\n");
    await mkdir(join(root, ".agents/skills/openspec-apply-change"), {
      recursive: true,
    });
    await mkdir(join(root, ".husky/_"), { recursive: true });
    await writeFile(
      join(root, ".agents/skills/openspec-apply-change/SKILL.md"),
      "generated",
    );
    await writeFile(join(root, ".husky/_/husky.sh"), "generated");
    await execFileAsync("git", ["add", ".gitignore"], { cwd: root });

    expect(validateInventory(await inventoryRepository(root))).toEqual([
      "ignored: .agents/skills/openspec-apply-change/SKILL.md",
      "ignored: .husky/_/husky.sh",
    ]);
  });

  it("allows per-machine Pi runtime state and session exports", async () => {
    const root = await repository();
    await writeFile(
      join(root, ".gitignore"),
      ".pi/goals/\n.pi/.goals-pool-snapshot.json\n.pi/pi-goal-x-settings.json\npi-session-*.html\n",
    );
    await mkdir(join(root, ".pi/goals/.locks"), { recursive: true });
    await writeFile(join(root, ".pi/goals/goal_events.jsonl"), "{}\n");
    await writeFile(join(root, ".pi/.goals-pool-snapshot.json"), "{}\n");
    await writeFile(join(root, ".pi/pi-goal-x-settings.json"), "{}\n");
    await writeFile(
      join(root, "pi-session-2026-09-16T21-19-40-299Z_test.html"),
      "<html></html>",
    );
    await execFileAsync("git", ["add", ".gitignore"], { cwd: root });

    expect(validateInventory(await inventoryRepository(root))).toEqual([]);
  });

  it("accepts a minimal current repository", async () => {
    const root = await repository();
    await mkdir(join(root, "openspec/specs/current"), { recursive: true });
    await writeFile(join(root, "openspec/specs/current/spec.md"), "current");
    await writeFile(
      join(root, "openspec/specs/README.md"),
      "[current](./current/spec.md)\n",
    );
    await execFileAsync("git", ["add", "."], { cwd: root });
    await expect(assertRepositoryClean(root)).resolves.toBeUndefined();
  });

  it("rejects unindexed, duplicate, and missing OpenSpec entries", async () => {
    const root = await repository();
    await mkdir(join(root, "openspec/specs/current"), { recursive: true });
    await writeFile(join(root, "openspec/specs/current/spec.md"), "current");
    await writeFile(
      join(root, "openspec/specs/README.md"),
      [
        "[missing](./missing/spec.md)",
        "[missing again](./missing/spec.md)",
      ].join("\n"),
    );
    await execFileAsync("git", ["add", "."], { cwd: root });
    const inventory = await inventoryRepository(root);

    await expect(
      validateOpenSpecIndex(root, inventory.tracked),
    ).resolves.toEqual([
      "openspec-index: duplicate missing",
      "openspec-index: missing spec missing",
      "openspec-index: unindexed current",
    ]);
  });
});
