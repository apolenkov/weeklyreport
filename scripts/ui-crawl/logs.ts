import {
  DETAIL_LIMIT,
  READ_COMMANDS,
  SERVER_ERROR,
  TOO_MANY_REQUESTS,
} from "./constants.ts";
import type { Browser, Step } from "./driver.ts";
import type { Config, Finding, Role } from "./types.ts";

/** Everything a step needs: the session, the run settings and the shared findings sink. */
export type Ctx = Readonly<{
  browser: Browser;
  config: Config;
  role: Role;
  width: number;
  dir: string;
  findings: Finding[];
  /** Signs the role in again after a browser restart dropped the session. */
  signIn: () => void;
}>;

export type Place = Readonly<{ page: string; shot: string | null }>;

type Entry = Readonly<Record<string, unknown>>;

function asList(value: unknown, field: string): readonly Entry[] {
  const list =
    typeof value === "object" && value !== null
      ? (value as Entry)[field]
      : null;
  return Array.isArray(list) ? (list as Entry[]) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export type Issue = Readonly<{
  severity: Finding["severity"];
  kind: string;
  detail: string;
}>;

export function add(ctx: Ctx, place: Place, issue: Issue): void {
  ctx.findings.push({
    ...issue,
    role: ctx.role.name,
    width: ctx.width,
    page: place.page,
    detail: issue.detail.slice(0, DETAIL_LIMIT),
    shot: place.shot,
  });
}

function reportConsole(ctx: Ctx, place: Place, raw: unknown): void {
  for (const message of asList(raw, "messages")) {
    const type = text(message.type ?? message.level ?? "");
    if (type !== "error" && type !== "warning") continue;
    add(ctx, place, {
      severity: type === "error" ? "medium" : "low",
      kind: `console-${type}`,
      detail: text(message.text ?? message.message ?? message),
    });
  }
}

function reportNetwork(ctx: Ctx, place: Place, raw: unknown): void {
  for (const request of asList(raw, "requests")) {
    const status = Number(request.status);
    add(ctx, place, {
      severity: status >= SERVER_ERROR ? "high" : "medium",
      kind: status === TOO_MANY_REQUESTS ? "rate-limited" : "http-error",
      detail: `${text(request.status)} ${text(request.method)} ${text(request.url)}`,
    });
  }
}

/** Turns raw console, network (>= 400) and page-error payloads into findings. */
function reportLogs(
  ctx: Ctx,
  place: Place,
  raw: Readonly<{ console: unknown; network: unknown; errors: unknown }>,
): void {
  reportConsole(ctx, place, raw.console);
  reportNetwork(ctx, place, raw.network);
  for (const error of asList(raw.errors, "errors")) {
    add(ctx, place, {
      severity: "high",
      kind: "page-error",
      detail: text(error),
    });
  }
}

/** Commands that read and clear console, failed requests and page errors. */
const DRAIN_COMMANDS: readonly (readonly string[])[] = [
  ["console"],
  ["network", "requests", "--status", "400-599"],
  ["errors"],
  ["console", "--clear"],
  ["network", "requests", "--clear"],
  ["errors", "--clear"],
];

export const CLEAR_COMMANDS: readonly (readonly string[])[] =
  DRAIN_COMMANDS.slice(READ_COMMANDS);

function logCommands(
  browser: Browser,
  commands: readonly (readonly string[])[],
): readonly Step[] {
  try {
    return browser.batch(commands);
  } catch (error: unknown) {
    return commands.map(() => ({
      ok: false,
      value: null,
      error: error instanceof Error ? error.message : "log transport failed",
    }));
  }
}

function noteLogFailure(ctx: Ctx, place: Place, detail: string): void {
  add(ctx, place, { severity: "medium", kind: "log-drain-failed", detail });
}

function readValue(step: Step | undefined): unknown {
  return step?.ok ? step.value : null;
}

export function drainLogs(ctx: Ctx, place: Place): void {
  const reads = logCommands(
    ctx.browser,
    DRAIN_COMMANDS.slice(0, READ_COMMANDS),
  );
  const [console_, network, errors] = reads;
  reportLogs(ctx, place, {
    console: readValue(console_),
    network: readValue(network),
    errors: readValue(errors),
  });
  const pending: (readonly string[])[] = [];
  for (const [index, clear] of CLEAR_COMMANDS.entries()) {
    const read = reads[index];
    if (read?.ok) pending.push(clear);
    else
      noteLogFailure(
        ctx,
        place,
        `${clear[0] ?? "logs"} read: ${read?.error ?? "no result"}`,
      );
  }
  if (pending.length === 0) return;
  const cleared = logCommands(ctx.browser, pending);
  for (const [index, command] of pending.entries()) {
    const result = cleared[index];
    if (!result?.ok)
      noteLogFailure(
        ctx,
        place,
        `${command[0] ?? "logs"} clear: ${result?.error ?? "no result"}`,
      );
  }
}
