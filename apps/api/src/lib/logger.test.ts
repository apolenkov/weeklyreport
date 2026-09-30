import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { logs } from "@opentelemetry/api-logs";
import type { ClsService } from "nestjs-cls";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";

import { expectDefined } from "../test-utils/expect-defined.js";
import { createAppLogger, createNullLogger } from "./logger.js";

const createLogDir = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "logger-test-"));
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
};

describe("createAppLogger", () => {
  afterEach(() => {
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

  it("degrades to the envelope when context serialization fails", () => {
    const spy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger({ minLevel: "info" });
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => logger.info("circular", { ref: circular })).not.toThrow();

    expect(spy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(
      expectDefined(spy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      level: "info",
      message: "circular",
      contextSerializationFailed: true,
    });
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
    const logDir = createLogDir();
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

    await expectDefined(logger.flush)();

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
    const logDir = createLogDir();
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

    await expectDefined(logger.flush)();

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

  it("does not let caller context spoof canonical trace fields in OTel", () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const emit = vi.fn();
    vi.spyOn(logs, "getLogger").mockReturnValue({ emit } as never);
    const logger = createAppLogger();

    logger.info("trace-safe", {
      traceId: "spoofed-trace",
      spanId: "spoofed-span",
      correlationId: "spoofed-correlation",
      requestId: "request-1",
    });

    const entry = JSON.parse(
      expectDefined(stdoutSpy.mock.calls[0])[0] as string,
    ) as Record<string, unknown>;
    expect(entry.traceId).toBeUndefined();
    expect(entry.spanId).toBeUndefined();
    expect(entry.correlationId).toBe("no-context");
    expect(emit).toHaveBeenCalledOnce();
    const emitted = emit.mock.calls[0]?.[0] as unknown as {
      attributes?: Record<string, unknown>;
    };
    expect(emitted.attributes?.requestId).toBe("request-1");
    expect(emitted.attributes?.correlationId).toBe("no-context");
    expect(emitted.attributes).not.toHaveProperty("traceId");
    expect(emitted.attributes).not.toHaveProperty("spanId");
  });

  it("flush drains pending file writes before resolving", async () => {
    const logDir = createLogDir();
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

  it("shares one process-scoped sink across loggers for the same directory", async () => {
    const logDir = createLogDir();
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const bootstrap = createAppLogger({ logDir, service: "bootstrap" });
    const worker = createAppLogger({ logDir, service: "worker" });

    bootstrap.info("bootstrap-line");
    worker.info("worker-line");
    await expectDefined(bootstrap.flush)();

    const lines = readFileSync(join(logDir, "app.log"), "utf-8")
      .trim()
      .split("\n");
    expect(lines).toHaveLength(2);
    expect(lines.join("\n")).toContain("bootstrap-line");
    expect(lines.join("\n")).toContain("worker-line");
  });

  it("flush rejects when a pending file write failed", async () => {
    const logDir = createLogDir();
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    // A directory at the log path makes every append fail.
    mkdirSync(join(logDir, "app.log"));
    const logger = createAppLogger({ logDir });

    logger.info("doomed");
    await expect(expectDefined(logger.flush)()).rejects.toThrow();
  });

  it("writes log entries asynchronously to <logDir>/app.log", async () => {
    const logDir = createLogDir();
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const logger = createAppLogger({ logDir, service: "file-test" });

    logger.info("first");
    logger.info("second");

    await expectDefined(logger.flush)();

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
    const logDir = createLogDir();
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const nestedDir = join(logDir, "nested", "deep");

    const logger = createAppLogger({ logDir: nestedDir });
    logger.info("nested test");

    await expectDefined(logger.flush)();

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
