import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { logs } from "@opentelemetry/api";
import type { Request, Response } from "express";
import type { ClsService } from "nestjs-cls";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { createAppLogger } from "../lib/logger.js";
import { expectDefined } from "../test-utils/expect-defined.js";
import { createClientLogsHandler } from "./client-logs-handler.js";

const SECRET = "CLIENT_PRIVATE_MARKER";

function makeRequest(url: string): Request {
  return {
    body: {
      entries: ["debug", "info", "warn", "error"].map((level) => ({
        level,
        source: "window-error",
        message: `Request failed: ${SECRET}`,
        stack: `Error: ${SECRET}\n at ${url}`,
        url,
        ts: 1_785_608_000_000,
      })),
    },
    ip: "127.0.0.1",
    get: () => `Private user-agent ${SECRET}`,
  } as unknown as Request;
}

describe("client log privacy at every AppLogger sink", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [
      `https://person:${SECRET}@weeklyreport.test/lead/report?token=${SECRET}#${SECRET}`,
      "https://weeklyreport.test/lead/report",
    ],
    [`data:text/plain,${SECRET}`, undefined],
    [`screen-${SECRET}.tsx`, undefined],
  ] as const)(
    "removes browser secrets from an event with URL %s",
    async (url, expectedUrl) => {
      const logDir = mkdtempSync(join(tmpdir(), "client-log-privacy-"));
      onTestFinished(() => rmSync(logDir, { recursive: true, force: true }));
      const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const emit = vi.fn();
      vi.spyOn(logs, "getLogger").mockReturnValue({ emit } as never);
      const cls = {
        isActive: () => true,
        get: () => "privacy-request-id",
      } as unknown as ClsService;
      const logger = createAppLogger({
        minLevel: "debug",
        logDir,
        clsService: cls,
      });
      const handler = createClientLogsHandler({ logger, enabled: true });
      const sendStatus = vi.fn();

      handler(makeRequest(url), { sendStatus } as unknown as Response, vi.fn());
      await expectDefined(logger.flush)();

      expect(sendStatus).toHaveBeenCalledWith(204);
      const file = readFileSync(join(logDir, "app.log"), "utf8");
      const sinks = [
        stdout.mock.calls.map(([line]) => line).join(""),
        stderr.mock.calls.map(([line]) => line).join(""),
        file,
        JSON.stringify(emit.mock.calls),
      ];
      sinks.forEach((sink) => expect(sink).not.toContain(SECRET));
      expect(emit).toHaveBeenCalledTimes(4);
      const entries = file
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(entries).toHaveLength(4);
      expect(entries.map(({ level }) => level)).toEqual([
        "debug",
        "info",
        "warn",
        "error",
      ]);
      entries.forEach((entry) => {
        expect(entry).toMatchObject({
          phase: "web.client",
          source: "window-error",
          ts: 1_785_608_000_000,
          ip: "127.0.0.1",
          correlationId: "privacy-request-id",
        });
        expect(entry.url).toBe(expectedUrl);
        expect(entry).not.toHaveProperty("stack");
        expect(entry).not.toHaveProperty("ua");
      });
    },
  );
});
