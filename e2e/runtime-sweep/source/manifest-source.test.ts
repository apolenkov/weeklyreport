import { execFile } from "node:child_process";
import {
  access,
  link,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import { withoutLocalGitEnvironment } from "../../../scripts/shared/git-environment.ts";
import {
  createManifestFixture,
  fakeManifestGit,
} from "../manifest/manifest-fixture.ts";
import { runGitCommand } from "./manifest-git.ts";
import {
  cleanSourceIdentity,
  cleanTreeDigest,
  writeAtomicManifestPair,
} from "./manifest-source.ts";

const execFileAsync = promisify(execFile);

const runOracleGit = async (
  args: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<string> =>
  (
    await execFileAsync("/usr/bin/git", [...args], {
      cwd,
      env: withoutLocalGitEnvironment(environment),
    })
  ).stdout;

const initializeRepository = async (root: string): Promise<void> => {
  await runOracleGit(["init", "--quiet"], root);
  await writeFile(path.join(root, "source.txt"), `${root}\n`);
  for (const args of [
    ["add", "source.txt"],
    [
      "-c",
      "user.name=Runtime fixture",
      "-c",
      "user.email=runtime-fixture@customreport.local",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
  ] as const)
    await runOracleGit(args, root);
};

describe("atomic runtime artifact publication", () => {
  it("rolls back MATRIX when MANIFEST publication fails", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-pair-"));
    const matrixPath = path.join(root, "MATRIX.json");
    const manifestPath = path.join(root, "MANIFEST.json");
    const publishFile = async (
      oldPath: string,
      newPath: string,
    ): Promise<void> => {
      if (oldPath.endsWith("MANIFEST.json"))
        throw new Error("manifest publication failed");
      await link(oldPath, newPath);
    };
    try {
      await expect(
        writeAtomicManifestPair(
          {
            matrixPath,
            matrixText: "matrix",
            manifestPath,
            manifestText: "manifest",
          },
          publishFile,
        ),
      ).rejects.toThrow("manifest publication failed");
      await expect(access(matrixPath)).rejects.toThrow();
      await expect(access(manifestPath)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("never overwrites or deletes a concurrently published pair", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-pair-race-"));
    const input = {
      matrixPath: path.join(root, "MATRIX.json"),
      manifestPath: path.join(root, "MANIFEST.json"),
    };
    try {
      const results = await Promise.allSettled([
        writeAtomicManifestPair({
          ...input,
          matrixText: "matrix-a",
          manifestText: "manifest-a",
        }),
        writeAtomicManifestPair({
          ...input,
          matrixText: "matrix-b",
          manifestText: "manifest-b",
        }),
      ]);
      expect(
        results.filter(({ status }) => status === "fulfilled"),
      ).toHaveLength(1);
      const [matrix, manifest] = await Promise.all([
        readFile(input.matrixPath, "utf8"),
        readFile(input.manifestPath, "utf8"),
      ]);
      expect(["matrix-a:manifest-a", "matrix-b:manifest-b"]).toContain(
        `${matrix}:${manifest}`,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("clean source identity", () => {
  it("binds Git commands to cwd when a hook exports parent repository state", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "runtime-parent-git-"));
    const child = await mkdtemp(path.join(tmpdir(), "runtime-child-git-"));
    try {
      await initializeRepository(parent);
      await writeFile(path.join(child, "source.txt"), `${child}\n`);
      const parentHead = (
        await runOracleGit(["rev-parse", "HEAD"], parent)
      ).trim();
      const parentIndexTree = (
        await runOracleGit(["write-tree"], parent)
      ).trim();
      expect(
        await runOracleGit(
          ["status", "--porcelain=v1", "--untracked-files=all"],
          parent,
        ),
      ).toBe("");
      const poisonedEnvironment = {
        ...process.env,
        GIT_DIR: path.join(parent, ".git"),
        GIT_INDEX_FILE: path.join(parent, ".git", "index"),
        GIT_WORK_TREE: parent,
      };
      for (const args of [
        ["init", "--quiet"],
        ["add", "source.txt"],
        [
          "-c",
          "user.name=Runtime fixture",
          "-c",
          "user.email=runtime-fixture@customreport.local",
          "commit",
          "--quiet",
          "-m",
          "fixture",
        ],
      ] as const)
        await runGitCommand(args, child, poisonedEnvironment);

      await expect(
        runGitCommand(
          ["rev-parse", "--show-toplevel"],
          child,
          poisonedEnvironment,
        ).then((output) => output.trim()),
      ).resolves.toBe(await realpath(child));
      await expect(
        runGitCommand(["show", "HEAD:source.txt"], child, poisonedEnvironment),
      ).resolves.toBe(`${child}\n`);
      await expect(
        runOracleGit(["rev-parse", "HEAD"], parent, poisonedEnvironment),
      ).resolves.toBe(`${parentHead}\n`);
      await expect(
        runOracleGit(["write-tree"], parent, poisonedEnvironment),
      ).resolves.toBe(`${parentIndexTree}\n`);
      await expect(
        runOracleGit(
          ["status", "--porcelain=v1", "--untracked-files=all"],
          parent,
          poisonedEnvironment,
        ),
      ).resolves.toBe("");
    } finally {
      await Promise.all([
        rm(parent, { recursive: true, force: true }),
        rm(child, { recursive: true, force: true }),
      ]);
    }
  });

  it("keeps cleanTreeDigest as a digest-only compatibility wrapper", async () => {
    const fixture = await createManifestFixture();
    try {
      const identity = await cleanSourceIdentity(
        fixture.input,
        fakeManifestGit(),
      );
      await expect(
        cleanTreeDigest(fixture.input, fakeManifestGit()),
      ).resolves.toBe(identity.treeDigest);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
