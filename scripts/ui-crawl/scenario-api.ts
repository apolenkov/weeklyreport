import superjson from "superjson";

import { AUTH_BUDGET, TRPC_BUDGET } from "./constants.ts";
import { type Browser, createBrowser } from "./driver.ts";
import { configureRate, pace } from "./rate.ts";
import { type Role, ROLES } from "./types.ts";
import { login } from "./worker.ts";

export function sleep(ms: number): void {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)),
    0,
    0,
    ms,
  );
}

export type RoleName = "lead" | "head" | "viewer" | "admin";

/** One finished call: the evidence the report is built from. */
export type CallRecord = Readonly<{
  step: string;
  role: RoleName;
  path: string;
  ok: boolean;
  /** The step expected the call to be refused (a guard under test), and it was. */
  expected: "ok" | "refused";
  status: number;
  code: string;
}>;

export type Outcome = Readonly<{
  ok: boolean;
  status: number;
  code: string;
  data: unknown;
}>;

type Wire = Readonly<{
  result?: { data: { json: unknown; meta?: never } };
  error?: { json: { message?: string; data?: { code?: string } } };
}>;

/** In-page request: the browser carries the session cookie, the stand's edge routes `/trpc` to the api. */
function requestScript(
  path: string,
  type: "query" | "mutation",
  input: unknown,
): string {
  const body =
    input === undefined
      ? undefined
      : JSON.stringify(superjson.serialize(input));
  const query =
    type === "query" && body !== undefined
      ? `?input=${encodeURIComponent(body)}`
      : "";
  const init =
    type === "mutation"
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          ...(body === undefined ? {} : { body }),
        }
      : {};
  return `(async () => {
  const response = await fetch(${JSON.stringify(`/trpc/${path}${query}`)}, ${JSON.stringify({ credentials: "include", ...init })});
  return {status: response.status, text: await response.text()};
})()`;
}

function parse(status: number, text: string): Outcome {
  let wire: Wire;
  try {
    wire = JSON.parse(text) as Wire;
  } catch {
    return { ok: false, status, code: "UNPARSEABLE", data: undefined };
  }
  if (wire.result)
    return {
      ok: true,
      status,
      code: "",
      data: superjson.deserialize(wire.result.data as never),
    };
  const code = wire.error?.json.data?.code ?? "UNKNOWN";
  const message = summarize(wire.error?.json.message ?? "");
  return {
    ok: false,
    status,
    code: `${code}: ${message.slice(0, MESSAGE_CHARS)}`,
    data: undefined,
  };
}

type Issue = Readonly<{
  path?: readonly (string | number)[];
  message?: string;
}>;

/** A rejected input arrives as a JSON list of validation issues: one short line says which fields. */
function summarize(message: string): string {
  if (!message.startsWith("[")) return message;
  try {
    return (JSON.parse(message) as readonly Issue[])
      .map((issue) => `${(issue.path ?? []).join(".")} ${issue.message ?? ""}`)
      .join("; ");
  } catch {
    return message;
  }
}

type CallSpec = Readonly<{
  step: string;
  role: RoleName;
  path: string;
  type: "query" | "mutation";
  input?: unknown;
  expected?: CallRecord["expected"] | undefined;
}>;

const MESSAGE_CHARS = 240;

/** Signed-in browsers per role; each one calls `/trpc` like the web client does. */
export function createApi(
  url: string,
  passwords: Readonly<Record<string, string>>,
  ledgerDir: string,
) {
  configureRate("trpc", `${ledgerDir}/trpc.log`, TRPC_BUDGET);
  configureRate("auth", `${ledgerDir}/auth.log`, AUTH_BUDGET);
  const browsers = new Map<RoleName, Browser>();
  const calls: CallRecord[] = [];

  const browserFor = (name: RoleName): Browser => {
    const open = browsers.get(name);
    if (open) return open;
    const role: Role | undefined = ROLES.find((r) => r.name === name);
    const password = role ? passwords[role.passwordKey] : undefined;
    if (!role || !password) throw new Error(`No role or password for ${name}`);
    const browser = createBrowser(`scenario-${name}`);
    login(browser, { url }, role, password);
    browsers.set(name, browser);
    return browser;
  };

  const call = (spec: CallSpec): Outcome => {
    const { step, role, path, type, input } = spec;
    const browser = browserFor(role);
    pace("trpc", 1);
    const raw = browser.evaluate(requestScript(path, type, input)) as {
      status: number;
      text: string;
    };
    const outcome = parse(raw.status, raw.text);
    calls.push({
      step,
      role,
      path,
      ok: outcome.ok,
      expected: spec.expected ?? "ok",
      status: outcome.status,
      code: outcome.code,
    });
    return outcome;
  };

  /** The calls of one signed-in role: `query(step, path, input, expected)` and `mutate(...)`. */
  const as = (role: RoleName) => ({
    query: (
      step: string,
      path: string,
      input?: unknown,
      expected?: CallRecord["expected"],
    ) => call({ step, role, path, type: "query", input, expected }),
    mutate: (
      step: string,
      path: string,
      input?: unknown,
      expected?: CallRecord["expected"],
    ) => call({ step, role, path, type: "mutation", input, expected }),
  });

  return {
    calls,
    as,
    close: (): void => {
      for (const browser of browsers.values()) browser.close();
    },
  };
}

export type Api = ReturnType<typeof createApi>;
