import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AUTH_BUDGET,
  AUTH_COST,
  DEFAULT_HEIGHT,
  LOGIN_ATTEMPTS,
  LOGIN_BACKOFF_MS,
  MOBILE_HEIGHT,
  MOBILE_WIDTH,
  TRPC_BUDGET,
} from "./constants.ts";
import { type Browser, createBrowser } from "./driver.ts";
import { crawlFullPages } from "./full.ts";
import { CLEAR_COMMANDS, type Ctx } from "./logs.ts";
import { crawlPages } from "./page.ts";
import { configureRate, pace } from "./rate.ts";
import type { Config, Finding, PageRecord, Role, RunRecord } from "./types.ts";

const axeSource = readFileSync(
  createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
  "utf8",
);

function sleep(ms: number): void {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)),
    0,
    0,
    ms,
  );
}

function authBatch(
  browser: Browser,
  commands: readonly (readonly string[])[],
): void {
  const results = browser.batch(commands);
  for (const [index, command] of commands.entries()) {
    const result = results[index];
    if (!result?.ok)
      throw new Error(
        `Sign-in ${command[0] ?? "command"} failed: ${result?.error ?? "no result"}`,
      );
  }
}

function attemptLogin(
  browser: Browser,
  config: Pick<Config, "url">,
  role: Role,
  password: string,
): boolean {
  pace("auth", AUTH_COST);
  authBatch(browser, [
    ["cookies", "clear"],
    ["open", config.url],
    ["wait", "--load", "networkidle"],
  ]);
  browser.evaluate(
    `[...document.querySelectorAll('a')].find((a) => /sign in/i.test(a.textContent))?.click()`,
  );
  authBatch(browser, [
    ["wait", "#username"],
    ["fill", "#username", role.email],
    ["fill", "#password", password],
    ["click", "#kc-login"],
    ["wait", "--url", `${config.url}/**`],
    ["wait", "--load", "networkidle"],
  ]);
  return !String(browser.evaluate("location.pathname")).startsWith("/auth/");
}

/** A slow or throttled identity provider times out the CLI: treat that as a failed attempt. */
function tryLogin(
  browser: Browser,
  config: Pick<Config, "url">,
  role: Role,
  password: string,
): Readonly<{ success: boolean; error: unknown }> {
  try {
    const success = attemptLogin(browser, config, role, password);
    return {
      success,
      error: success
        ? null
        : new Error("Authentication callback did not return to the stand"),
    };
  } catch (error: unknown) {
    return { success: false, error };
  }
}

/** The stand limits sign-ins to 5 per minute per IP: a failed callback waits out the window. */
export function login(
  browser: Browser,
  config: Pick<Config, "url">,
  role: Role,
  password: string,
): void {
  let cause: unknown;
  for (let attempt = 1; attempt <= LOGIN_ATTEMPTS; attempt += 1) {
    const result = tryLogin(browser, config, role, password);
    if (result.success) {
      browser.batch(CLEAR_COMMANDS);
      return;
    }
    cause = result.error;
    if (attempt < LOGIN_ATTEMPTS) sleep(LOGIN_BACKOFF_MS);
  }
  throw new Error(
    `Sign-in as ${role.name} failed after ${LOGIN_ATTEMPTS} attempts`,
    { cause },
  );
}

/** Shot paths in the report are relative to the output directory. */
function relativize(
  name: string,
  pages: readonly PageRecord[],
  findings: readonly Finding[],
) {
  const rel = (shot: string | null) => (shot ? `shots/${name}/${shot}` : null);
  return {
    findings: findings.map((f) => ({ ...f, shot: rel(f.shot) })),
    pages: pages.map((p) => ({
      ...p,
      shot: `shots/${name}/${p.shot}`,
      steps: p.steps.map((s) => ({ ...s, shot: rel(s.shot) })),
      ...(p.states
        ? {
            states: p.states.map((s) => ({
              ...s,
              shot: rel(s.shot) ?? "",
              ...(s.dom ? { dom: rel(s.dom) ?? "" } : {}),
            })),
          }
        : {}),
      ...(p.pairwise
        ? { pairwise: p.pairwise.map((s) => ({ ...s, shot: rel(s.shot) })) }
        : {}),
    })),
  };
}

type Session = Readonly<{ browser: Browser; config: Config; role: Role }>;

function crawlWidth(
  { browser, config, role }: Session,
  width: number,
  landing: string,
  signIn: () => void,
): RunRecord {
  const name = `${role.name}-${width}`;
  const dir = join(config.out, "shots", name);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(config.out, "video"), { recursive: true });
  const video = `video/${name}.webm`;
  const findings: Finding[] = [];
  const ctx: Ctx = {
    browser,
    config,
    role,
    width,
    dir,
    findings,
    signIn,
  };
  const height = width === MOBILE_WIDTH ? MOBILE_HEIGHT : DEFAULT_HEIGHT;
  browser.batch([["set", "viewport", String(width), String(height)]]);
  if (config.video)
    browser.batch([["record", "start", join(config.out, video)]]);
  const start = performance.now();
  const pages =
    config.mode === "full"
      ? crawlFullPages(ctx, landing, axeSource)
      : crawlPages(ctx, landing, axeSource);
  const ms = Math.round(performance.now() - start);
  if (config.video) browser.batch([["record", "stop"]]);
  return {
    role: role.name,
    state: config.state,
    width,
    ms,
    video,
    ...relativize(name, pages, findings),
  };
}

/** Crawls one role at every width inside a single browser session; one video per width. */
export function crawlRole(
  config: Config,
  role: Role,
  password: string,
): readonly RunRecord[] {
  // one ledger per stand, outside the output directory: a run right after another shares the minute
  const ledger = (name: string): string =>
    join(
      tmpdir(),
      `wr-crawl-${new URL(config.url).host.replace(":", "-")}-${name}.log`,
    );
  configureRate("trpc", ledger("trpc"), TRPC_BUDGET);
  configureRate("auth", ledger("auth"), AUTH_BUDGET);
  const browser = createBrowser(role.name);
  using cleanup = new DisposableStack();
  cleanup.defer(() => browser.close());
  cleanup.defer(() => {
    writeJson(join(config.out, `profile-${role.name}.json`), {
      stalls: browser.stalls,
      restarts: browser.restarts,
      calls: Object.fromEntries(
        [...browser.profile].map(([k, v]) => [
          k,
          { calls: v.calls, ms: Math.round(v.ms) },
        ]),
      ),
    });
  });
  login(browser, config, role, password);
  const landing = String(browser.evaluate("location.href"));
  return config.widths.map((width) =>
    crawlWidth({ browser, config, role }, width, landing, () => {
      login(browser, config, role, password);
    }),
  );
}

export function writeJson(file: string, data: unknown): void {
  writeFileSync(file, JSON.stringify(data, null, 2));
}
