// @vitest-environment node

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const HOOK_FILE = "use-lead-form-autosave.ts";
const ENGINE_FILE = "autosave-live-state.ts";

// openspec/specs/lead-form-draft-module: render-refreshed mutable state must
// not be exposed through a cross-file ref/accessor protocol. The module's
// single mutable live-state holder stays private to the engine file, which
// exposes intent operations only; the hook and sibling modules receive
// ordinary values and callbacks. A file-internal ref that never crosses the
// boundary (the save-echo ledger) remains permitted.
const SMUGGLED_PROTOCOL = /AutosaveRefs|autosave-refs|\bgetRefs\b|\bsetRefs\b/;
const LIVE_HOLDER_TYPE = /\bAutosaveLiveState\b/;

// Detection predicates are exported so planted positive/negative probes can
// pin what they catch instead of only scanning the live source.
export function exposesLiveStateProtocol(text: string): boolean {
  return SMUGGLED_PROTOCOL.test(text);
}

export function referencesLiveHolder(text: string): boolean {
  return LIVE_HOLDER_TYPE.test(text);
}

function exportedNames(text: string): (string | undefined)[] {
  return [
    ...text.matchAll(
      /^export\s+(?:async\s+)?(?:function|const|class|interface|type)\s+(\w+)/gm,
    ),
  ].map((match) => match[1]);
}

function productionSources(): { file: string; text: string }[] {
  return readdirSync(MODULE_DIR)
    .filter(
      (name) =>
        /\.tsx?$/.test(name) &&
        !name.endsWith(".test.ts") &&
        !name.endsWith(".test.tsx"),
    )
    .map((name) => ({
      file: name,
      text: readFileSync(path.join(MODULE_DIR, name), "utf8"),
    }));
}

const sources = productionSources();

describe("lead-form autosave — no cross-file live-state protocol", () => {
  it("detects a planted refs bundle, accessor, or sync hook", () => {
    expect(exposesLiveStateProtocol("const refs: AutosaveRefs = seed();")).toBe(
      true,
    );
    expect(exposesLiveStateProtocol("type GetAutosaveRefs = () => R")).toBe(
      true,
    );
    expect(exposesLiveStateProtocol("useSyncAutosaveRefs(getRefs, args)")).toBe(
      true,
    );
    expect(
      exposesLiveStateProtocol('import { x } from "./autosave-refs";'),
    ).toBe(true);
    expect(exposesLiveStateProtocol("deps.getRefs().queued = null")).toBe(true);
  });

  it("does not flag value-oriented helpers or the plain request type", () => {
    expect(
      exposesLiveStateProtocol(
        "export function encodeKey(payload: DraftSaveContent): string {",
      ),
    ).toBe(false);
    expect(
      exposesLiveStateProtocol("const requests: AutosaveRequest[] = []"),
    ).toBe(false);
  });

  it("detects the live holder type when it leaks to a sibling", () => {
    expect(referencesLiveHolder("live: AutosaveLiveState")).toBe(true);
    expect(referencesLiveHolder("const live = seedLiveState(args)")).toBe(
      false,
    );
  });

  it("keeps every production file free of the refs/accessor protocol", () => {
    const offenders = sources
      .filter(({ text }) => exposesLiveStateProtocol(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("keeps the live holder type inside the engine file", () => {
    const holders = sources
      .filter(({ text }) => referencesLiveHolder(text))
      .map(({ file }) => file);
    expect(holders).toEqual([ENGINE_FILE]);
  });

  it("exports no holder, ref or accessor from the engine file", () => {
    const engine = sources.find(({ file }) => file === ENGINE_FILE);
    expect(engine).toBeDefined();
    expect(exportedNames(engine?.text ?? "")).toEqual(["createAutosaveEngine"]);
  });

  it("exports nothing but the hook from the module entry point", () => {
    const hook = sources.find(({ file }) => file === HOOK_FILE);
    expect(hook).toBeDefined();
    expect(exportedNames(hook?.text ?? "")).toEqual(["useLeadFormAutosave"]);
  });
});
