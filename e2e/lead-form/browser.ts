import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { runtimeSignal, trackRuntimeOperation } from "../setup/shutdown.js";
import type { BrowserSnapshot } from "./snapshot-scope.js";

export type { BrowserSnapshot } from "./snapshot-scope.js";

const execute = promisify(execFile);
const COMMAND_TIMEOUT_MS = 40_000;
const CLEANUP_TIMEOUT_MS = 40_000;
const MAX_OUTPUT_BYTES = 8_388_608;
const WEB_ORIGIN = "http://localhost:3000";
const sessions: {
  base: string;
  lead: string;
  head: string;
  serial: number;
  used: Set<string>;
  configDir: string;
  signal?: AbortSignal;
  closing?: Promise<void>;
  disposing?: Promise<void>;
} = {
  base: "",
  lead: "",
  head: "",
  serial: 0,
  used: new Set<string>(),
  configDir: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownedSession(session?: string): string {
  assert(sessions.lead, "E2E browser sessions have not been initialized");
  const selected = session ?? sessions.lead;
  assert([sessions.lead, sessions.head].includes(selected), "Unowned session");
  return selected;
}

function runnerEnvironment(session?: string): NodeJS.ProcessEnv {
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => !name.startsWith("AGENT_BROWSER_"),
      ),
    ),
    ...(session === undefined ? {} : { AGENT_BROWSER_SESSION: session }),
  };
}

function executeClient(
  args: readonly string[],
  signal: AbortSignal,
  session?: string,
) {
  signal.throwIfAborted();
  const client = execute(
    "agent-browser",
    [
      "--config",
      join(sessions.configDir, "agent-browser.json"),
      ...(session === undefined ? [] : ["--session", session, "--json"]),
      ...args,
    ],
    {
      encoding: "utf8",
      timeout: args.at(0) === "close" ? CLEANUP_TIMEOUT_MS : COMMAND_TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT_BYTES,
      signal,
      env: runnerEnvironment(session),
    },
  );
  // AbortError can precede child shutdown; cleanup waits for close.
  const closed = new Promise<void>((resolve) => {
    client.child.once("close", () => resolve());
  });
  return trackRuntimeOperation(client.finally(() => closed));
}

export function initializeSessions(signal?: AbortSignal): Promise<void> {
  return trackRuntimeOperation(createSessions(runtimeSignal(signal)));
}

async function createSessions(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  assert(!sessions.base, "E2E browser sessions are already initialized");
  const directory = await mkdtemp(join(tmpdir(), "weeklyreport-e2e-browser-"));
  sessions.configDir = directory;
  try {
    const configPath = join(directory, "agent-browser.json");
    await writeFile(configPath, "{}\n", { encoding: "utf8", signal });
    const { stdout } = await executeClient(
      [
        "session",
        "id",
        "--scope",
        "worktree",
        "--prefix",
        `e2e-${Date.now()}-${process.pid}`,
      ],
      signal,
    );
    const base = stdout.trim();
    assert(/^[a-zA-Z0-9_-]+$/.test(base), "Invalid agent-browser session id");
    sessions.base = base;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    sessions.configDir = "";
    throw error;
  }
}

export function beginTestSessions(signal: AbortSignal): void {
  assert(sessions.base, "Call initializeSessions before beginning a test");
  assert(sessions.used.size === 0, "Previous E2E browsers remain open");
  sessions.serial += 1;
  sessions.signal = signal;
  sessions.lead = `${sessions.base}-${sessions.serial}-lead`;
  sessions.head = `${sessions.base}-${sessions.serial}-head`;
  process.env.AGENT_BROWSER_SESSION = sessions.lead;
}

export function headSession(): string {
  return ownedSession(sessions.head);
}

export async function command(
  args: readonly string[],
  session?: string,
): Promise<Record<string, unknown>> {
  const selected = ownedSession(session);
  const isClosing = args.at(0) === "close";
  const signal = isClosing
    ? AbortSignal.timeout(CLEANUP_TIMEOUT_MS)
    : runtimeSignal(sessions.signal);
  signal.throwIfAborted();
  sessions.used.add(selected);
  const { stdout } = await executeClient(args, signal, selected);
  const response: unknown = JSON.parse(stdout);
  assert(isRecord(response), "agent-browser returned an invalid JSON response");
  assert(response.success === true, "agent-browser command failed");
  assert(isRecord(response.data), "Invalid agent-browser response data");
  return response.data;
}

export function open(
  pathOrUrl: string,
  session?: string,
): Promise<Record<string, unknown>> {
  return command(["open", new URL(pathOrUrl, WEB_ORIGIN).href], session);
}

export function findRole(
  role: string,
  name: string,
  action: "click" | "fill" | "text",
  text?: string,
  session?: string,
): Promise<Record<string, unknown>> {
  assert(action !== "fill" || text !== undefined, "Fill requires text");
  return command(
    [
      "find",
      "role",
      role,
      action,
      ...(text === undefined ? [] : [text]),
      "--name",
      name,
      "--exact",
    ],
    session,
  );
}

export function fill(
  label: string,
  value: string,
  session?: string,
): Promise<Record<string, unknown>> {
  return command(["find", "label", label, "fill", value, "--exact"], session);
}

export function waitText(
  text: string,
  session?: string,
): Promise<Record<string, unknown>> {
  return command(["wait", "--text", text], session);
}

export async function snapshot(session?: string): Promise<BrowserSnapshot> {
  const data = await command(["snapshot"], session);
  assert(typeof data.snapshot === "string", "Invalid browser snapshot text");
  assert(isRecord(data.refs), "Invalid browser snapshot refs");
  const refs = Object.fromEntries(
    Object.entries(data.refs).map(([ref, value]) => {
      assert(/^e\d+$/.test(ref), "Invalid browser snapshot ref");
      assert(isRecord(value), "Invalid browser snapshot ref metadata");
      assert(typeof value.role === "string", "Invalid browser snapshot role");
      assert(
        value.name === undefined || typeof value.name === "string",
        "Invalid browser snapshot accessible name",
      );
      return [
        ref,
        {
          role: value.role,
          ...(value.name === undefined ? {} : { name: value.name }),
        },
      ];
    }),
  );
  return { snapshot: data.snapshot, refs };
}

export function refsByRole(
  data: BrowserSnapshot,
  role: string,
  name?: string | RegExp,
): string[] {
  return Object.entries(data.refs)
    .filter(
      ([, value]) =>
        value.role === role &&
        (name === undefined ||
          (typeof name === "string"
            ? value.name === name
            : value.name !== undefined && name.test(value.name))),
    )
    .map(([ref]) => `@${ref}`);
}

export async function getText(ref: string, session?: string): Promise<string> {
  const data = await command(["get", "text", ref], session);
  assert(typeof data.text === "string", "Invalid browser text result");
  return data.text;
}

export async function getUrl(session?: string): Promise<string> {
  const data = await command(["get", "url"], session);
  assert(typeof data.url === "string", "Invalid browser URL result");
  return data.url;
}

export async function isVisible(
  ref: string,
  session?: string,
): Promise<boolean> {
  const data = await command(["is", "visible", ref], session);
  assert(typeof data.visible === "boolean", "Invalid browser visibility");
  return data.visible;
}

export async function getAttr(
  selector: string,
  attribute: string,
  session?: string,
): Promise<string | null> {
  const data = await command(["get", "attr", selector, attribute], session);
  assert(
    data.value === null || typeof data.value === "string",
    "Invalid browser attribute result",
  );
  return data.value;
}

export function reload(session?: string): Promise<Record<string, unknown>> {
  return command(["reload"], session);
}

export async function close(session?: string): Promise<void> {
  const selected = ownedSession(session);
  const data = await command(["close"], selected);
  assert(data.closed === true, "agent-browser did not close the owned session");
  sessions.used.delete(selected);
}

export function closeOwnedSessions(): Promise<void> {
  sessions.closing ??= closeUsedSessions().finally(() => {
    delete sessions.closing;
  });
  return sessions.closing;
}

async function closeUsedSessions(): Promise<void> {
  const results = await Promise.allSettled(
    [...sessions.used].map((session) => close(session)),
  );
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure): unknown => failure.reason),
      "Could not close owned E2E browser sessions",
    );
  }
}

export function disposeSessions(): Promise<void> {
  sessions.disposing ??= disposeOwnedSessions().finally(() => {
    delete sessions.disposing;
  });
  return sessions.disposing;
}

async function disposeOwnedSessions(): Promise<void> {
  const closed = await Promise.allSettled([closeOwnedSessions()]);
  const removed = await Promise.allSettled(
    sessions.configDir
      ? [rm(sessions.configDir, { recursive: true, force: true })]
      : [],
  );
  if (removed.at(0)?.status === "fulfilled") sessions.configDir = "";
  const failures = [...closed, ...removed].flatMap((result): unknown[] =>
    result.status === "rejected" ? [result.reason] : [],
  );
  if (failures.length === 1) throw failures.at(0);
  if (failures.length > 1) {
    throw new AggregateError(failures, "E2E cleanup failed");
  }
}
