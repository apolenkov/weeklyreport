import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { assertDiagnosticFailureArtifacts } from "./preflight-diagnostic-artifacts.ts";

const bodylessHar = (content: Record<string, unknown> = {}): string =>
  JSON.stringify({
    log: {
      version: "1.2",
      entries: [
        {
          response: {
            content: { size: 0, mimeType: "text/plain", ...content },
          },
        },
      ],
    },
  });

async function createFixture(): Promise<string> {
  const root = await fsMkdtemp();
  const playwrightRoot = path.join(root, "playwright", "result");
  await mkdir(playwrightRoot, { recursive: true });
  await writeFile(path.join(root, "playwright", "network.har"), bodylessHar());
  for (const file of [
    "test-failed-1.png",
    "video.webm",
    "trace.zip",
    "error-context.md",
  ])
    await writeFile(path.join(playwrightRoot, file), "evidence");
  return root;
}

const fsMkdtemp = async (): Promise<string> => {
  const { mkdtemp } = await import("node:fs/promises");
  return mkdtemp(path.join(os.tmpdir(), "diagnostic-artifacts-"));
};

describe("diagnostic failure artifact contract", () => {
  it("accepts the complete bodyless failure packet", async () => {
    const root = await createFixture();
    try {
      await expect(
        assertDiagnosticFailureArtifacts({ outputRoot: root }),
      ).resolves.toMatchObject({ harEntryCount: 1 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a response body even when the other artifacts exist", async () => {
    const root = await createFixture();
    try {
      await writeFile(
        path.join(root, "playwright", "network.har"),
        bodylessHar({ text: "secret response" }),
      );
      await expect(
        assertDiagnosticFailureArtifacts({ outputRoot: root }),
      ).rejects.toThrow(/response body/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed when a required artifact is missing", async () => {
    const root = await createFixture();
    try {
      await rm(path.join(root, "playwright", "result", "video.webm"));
      await expect(
        assertDiagnosticFailureArtifacts({ outputRoot: root }),
      ).rejects.toThrow(/failure video/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
