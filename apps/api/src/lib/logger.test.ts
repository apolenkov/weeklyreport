import {
  mkdtempSync,
  promises as fsp,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ClsService } from "nestjs-cls";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../test-utils/expect-defined.js";
import { createAppLogger, createNullLogger } from "./logger.js";

// Allow fire-and-forget file writes to drain: the sink chains writes onto a
// promise, so we poll the in-flight queue via setImmediate to give pipeline
// streams (gzip/createReadStream) time to finish their async work.
async function flush(times = 30): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("createAppLogger", () => {
  let logDir: string;

  beforeEach(() => {
    logDir = mkdtempSync(join(tmpdir(), "logger-test-"));
  });

  afterEach(() => {
    rmSync(logDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("writes info entry to stdout as JSON with correlationId", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger({ minLevel: "info" });

    logger.info("hello");

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(
      expectDefined(spy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      level: "info",
      message: "hello",
      correlationId: "no-context",
    });
    expect(parsed.timestamp).toBeDefined();
  });

  it("writes error entry to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger({ minLevel: "info" });

    logger.error("fail");

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(
      expectDefined(spy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed).toMatchObject({ level: "error", message: "fail" });
  });

  it("suppresses messages below minLevel", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const logger = createAppLogger({ minLevel: "warn" });

    logger.debug("too low");
    logger.info("still too low");

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("includes service name in every entry", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger({ service: "test-svc" });

    logger.info("with service");

    const parsed = JSON.parse(
      expectDefined(spy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed.service).toBe("test-svc");
  });

  it("merges context into log entry", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger();

    logger.info("request", { method: "GET", path: "/api" });

    const parsed = JSON.parse(
      expectDefined(spy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed.method).toBe("GET");
    expect(parsed.path).toBe("/api");
  });

  it("redacts PII-shaped context keys at every sink", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger({ logDir, service: "redact-test" });

    logger.info("creating reminder execution", {
      ruleId: "rule-1",
      recipientEmail: "person@example.com",
    });

    const parsed = JSON.parse(
      expectDefined(stdoutSpy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed.recipientEmail).toBe("[redacted]");
    expect(parsed.ruleId).toBe("rule-1");

    await flush();

    const line = readFileSync(join(logDir, "app.log"), "utf-8").trim();
    expect(line).not.toContain("person@example.com");
    const fileParsed = JSON.parse(line) as Record<string, unknown>;
    expect(fileParsed.recipientEmail).toBe("[redacted]");
  });

  it("leaves a context with no PII-shaped keys unchanged", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger();

    logger.info("creating reminder execution", {
      ruleId: "rule-2",
      executionId: "exec-9",
    });

    const parsed = JSON.parse(
      expectDefined(spy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed.ruleId).toBe("rule-2");
    expect(parsed.executionId).toBe("exec-9");
  });

  it("redacts person-name and generic-email context keys at every sink", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger({ logDir });

    logger.info("nudge", {
      leadName: "Иван Иванов",
      email: "ivan@example.com",
      ruleId: "rule-1",
    });

    const parsed = JSON.parse(
      expectDefined(stdoutSpy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed.leadName).toBe("[redacted]");
    expect(parsed.email).toBe("[redacted]");
    expect(parsed.ruleId).toBe("rule-1");

    await flush();

    const fileParsed = JSON.parse(
      readFileSync(join(logDir, "app.log"), "utf-8").trim(),
    ) as Record<string, unknown>;
    expect(fileParsed.leadName).toBe("[redacted]");
    expect(fileParsed.email).toBe("[redacted]");
  });

  it("does not redact organization identity keys (no over-redaction)", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger();

    logger.info("org update", {
      fullName: "CustomReport Department",
      shortName: "CR",
    });

    const parsed = JSON.parse(
      expectDefined(spy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed.fullName).toBe("CustomReport Department");
    expect(parsed.shortName).toBe("CR");
  });

  it("protects canonical event fields from caller-supplied context", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger();

    logger.info("the real message", {
      timestamp: "1970-01-01T00:00:00.000Z",
      level: "debug",
      message: "spoofed message",
      correlationId: "spoofed-correlation",
    });

    const parsed = JSON.parse(
      expectDefined(spy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed.message).toBe("the real message");
    expect(parsed.level).toBe("info");
    expect(parsed.correlationId).toBe("no-context");
    expect(parsed.timestamp).not.toBe("1970-01-01T00:00:00.000Z");
  });

  it("flush drains pending file writes before resolving", async () => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger({ logDir, service: "flush-test" });

    logger.info("before-flush");
    await expectDefined(logger.flush)();

    const lines = readFileSync(join(logDir, "app.log"), "utf-8")
      .trim()
      .split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("before-flush");
  });

  it("flush rejects when a pending file write failed", async () => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const logger = createAppLogger({ logDir });
    const appendSpy = vi
      .spyOn(fsp, "appendFile")
      .mockRejectedValueOnce(new Error("disk full"));

    logger.info("doomed");
    await expect(expectDefined(logger.flush)()).rejects.toThrow(/lost 1 write/);

    appendSpy.mockRestore();
  });

  it("writes log entries asynchronously to <logDir>/app.log", async () => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger({ logDir, service: "file-test" });

    logger.info("first");
    logger.info("second");

    await flush();

    const files = readdirSync(logDir);
    expect(files).toContain("app.log");

    const lines = readFileSync(join(logDir, "app.log"), "utf-8")
      .trim()
      .split("\n");
    expect(lines).toHaveLength(2);

    const first = JSON.parse(expectDefined(lines[0])) as Record<
      string,
      unknown
    >;
    expect(first).toMatchObject({
      level: "info",
      message: "first",
      service: "file-test",
      correlationId: "no-context",
    });
  });

  // retry: the async rotation races its assertions under a loaded machine
  // (turbo runs 4 package suites in parallel); a real regression fails all 3.
  it(
    "rotates when active log exceeds maxBytes (creates gzip archive)",
    { retry: 2 },
    async () => {
      vi.spyOn(process.stdout, "write").mockReturnValue(true);
      const logger = createAppLogger({
        logDir,
        service: "rot",
        maxBytes: 200, // tiny threshold so a few lines trigger rotation
        maxAgeDays: 30,
      });

      // Write enough lines that the active file exceeds 200 bytes before rotation
      // is checked on the NEXT write. A typical entry here is ~140 bytes.
      for (let i = 0; i < 6; i++) {
        logger.info(`line-${i}`, { padding: "x".repeat(40) });
      }

      await flush(8);

      const files = readdirSync(logDir);
      const archives = files.filter(
        (f) => f.startsWith("app.log.") && f.endsWith(".gz"),
      );
      expect(archives.length).toBeGreaterThanOrEqual(1);
      expect(files).toContain("app.log");

      // Archive is gzipped — verify it has gzip magic bytes (0x1f, 0x8b).
      const archiveBytes = readFileSync(
        join(logDir, expectDefined(archives[0])),
      );
      expect(archiveBytes[0]).toBe(0x1f);
      expect(archiveBytes[1]).toBe(0x8b);

      // The active file was truncated at rotation, then later writes appended.
      // It must be strictly smaller than the un-rotated total (~840B).
      const activeSize = statSync(join(logDir, "app.log")).size;
      expect(activeSize).toBeLessThan(840);
    },
  );

  it("does not prune (readdir) the log directory on every log line", async () => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const readdirSpy = vi.spyOn(fsp, "readdir");

    // Large maxBytes so no rotation fires: only the interval-gated prune can
    // touch the directory, and it must run at most once across many lines.
    const logger = createAppLogger({ logDir, maxBytes: 50 * 1024 * 1024 });

    for (let i = 0; i < 12; i++) {
      logger.info(`line-${i}`);
    }
    await flush(8);

    expect(readdirSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });

  // retry: same load-induced rotation race as above.
  it(
    "prunes archives older than maxAgeDays during rotation",
    { retry: 2 },
    async () => {
      vi.spyOn(process.stdout, "write").mockReturnValue(true);

      // Pre-create a stale archive whose mtime is 2 days old.
      const staleArchive = join(logDir, "app.log.STALE.gz");
      writeFileSync(staleArchive, "gzip-bytes");
      const twoDaysAgo = Date.now() / 1000 - 2 * 86_400;
      utimesSync(staleArchive, twoDaysAgo, twoDaysAgo);

      const logger = createAppLogger({
        logDir,
        maxBytes: 100,
        maxAgeDays: 0, // anything older than now should be pruned
      });

      // Trigger writes large enough to force rotation, which calls pruneOldArchives.
      for (let i = 0; i < 5; i++) {
        logger.info(`prune-${i}`, { padding: "y".repeat(40) });
      }

      await flush(8);

      const remaining = readdirSync(logDir);
      expect(remaining).not.toContain("app.log.STALE.gz");
    },
  );

  it("reads correlationId from CLS when clsService.isActive()", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const cls = {
      isActive: () => true,
      get: vi.fn().mockReturnValue("fixed-uuid"),
    } as unknown as ClsService;

    const logger = createAppLogger({ clsService: cls });
    logger.info("with-cls");

    const parsed = JSON.parse(
      expectDefined(spy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed.correlationId).toBe("fixed-uuid");
  });

  it("falls back to 'no-context' when clsService is inactive", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const cls = {
      isActive: () => false,
      get: vi.fn(),
    } as unknown as ClsService;

    const logger = createAppLogger({ clsService: cls });
    logger.info("no-cls");

    const parsed = JSON.parse(
      expectDefined(spy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed.correlationId).toBe("no-context");
  });

  it("falls back to 'no-context' when clsService is omitted", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger();

    logger.info("plain");

    const parsed = JSON.parse(
      expectDefined(spy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed.correlationId).toBe("no-context");
  });

  it("creates logDir if it does not exist", async () => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const nestedDir = join(logDir, "nested", "deep");

    const logger = createAppLogger({ logDir: nestedDir });
    logger.info("nested test");

    await flush();

    const files = readdirSync(nestedDir);
    expect(files.length).toBeGreaterThan(0);
  });
});

describe("child logger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("inherits parent context and adds its own", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const parent = createAppLogger({ service: "api" });
    const child = parent.child({ module: "reminders" });

    child.info("reminder sent");

    const parsed = JSON.parse(
      expectDefined(spy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed.service).toBe("api");
    expect(parsed.module).toBe("reminders");
    expect(parsed.message).toBe("reminder sent");
  });

  it("preserves parent minLevel", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const parent = createAppLogger({ minLevel: "warn" });
    const child = parent.child({ module: "test" });

    child.info("should be suppressed");

    expect(spy).not.toHaveBeenCalled();
  });

  it("inherits clsService so child entries carry the same correlationId", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const cls = {
      isActive: () => true,
      get: vi.fn().mockReturnValue("child-uuid"),
    } as unknown as ClsService;

    const parent = createAppLogger({ service: "api", clsService: cls });
    const child = parent.child({ module: "svc" });
    child.info("inherited");

    const parsed = JSON.parse(
      expectDefined(spy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed.correlationId).toBe("child-uuid");
  });
});

describe("createNullLogger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not write to stdout or stderr", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const logger = createNullLogger();

    logger.debug("noop");
    logger.info("noop");
    logger.warn("noop");
    logger.error("noop");

    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("child returns itself", () => {
    const logger = createNullLogger();
    const child = logger.child({ key: "value" });

    expect(child).toBe(logger);
  });
});
