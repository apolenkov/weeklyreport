import { mkdtemp, readFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { expect, test, vi } from "vitest";

import type { CoverageCell } from "../source/contracts.ts";
import {
  indexLiveControlRecords,
  writeLiveControlEvidence,
} from "./live-control-evidence.ts";
import type { LiveControlActionRecord } from "./live-control-lane.ts";

const SOURCE_SHA = "0123456789abcdef0123456789abcdef01234567";
const PROFILE = "minimal" as const;
const ROLE = "viewer" as const;

const cellFor = (
  controlKeys: readonly string[],
  cellId = "cell-live-controls",
): CoverageCell => ({
  cellId,
  sourceSha: SOURCE_SHA,
  profile: PROFILE,
  role: ROLE,
  catalogRoute: "/reports",
  resolvedRoute: "/reports",
  viewport: { browser: "chromium", width: 1440, height: 900 },
  state: {
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
  action: {
    controlKey: "route:viewer:/reports",
    operation: "navigate",
    safety: "read-only",
    transition: "none",
  },
  execution: {
    kind: "navigation",
    action: {
      controlKey: "route:viewer:/reports",
      operation: "navigate",
      safety: "read-only",
      transition: "none",
    },
  },
  faultId: null,
  oracle: {
    domainSpecRefs: ["openspec/specs/exhaustive-runtime-sweep/spec.md"],
    function: { required: true, expectation: "route renders" },
    accessibility: { required: true, expectation: "controls are named" },
    visual: { required: true, expectation: "desktop is stable" },
    runtime: { required: true, expectation: "runtime telemetry is clean" },
  },
  controls: controlKeys.map((controlKey, index) => ({
    controlKey,
    cellId,
    ariaRole: "button",
    accessibleName: controlKey,
    enabled: true,
    order: index + 1,
    actionResult: {
      kind: "not-exercised",
      policy: "unavailable",
      reason: "baseline only",
    },
  })),
  evidence: {
    before: [],
    action: [],
    after: [],
    observations: [],
    inapplicable: [],
  },
  verdict: "pending",
});

const recordFor = (
  controlKey: string,
  status: LiveControlActionRecord["status"] = "pass",
  reason = "Control is disabled",
): LiveControlActionRecord => ({
  controlKey,
  ariaRole: "button",
  accessibleName: controlKey,
  enabled: true,
  order: 1,
  action: {
    controlKey,
    operation: "click",
    safety: "read-only",
    transition: "none",
  },
  status,
  resetPerformed: false,
  ...(status === "not-exercised"
    ? { policy: "unavailable" as const, reason }
    : status === "ambiguous"
      ? { reason: "Stateful outcome was ambiguous" }
      : {}),
});

const write = async (
  root: string,
  cell: CoverageCell,
  records: readonly LiveControlActionRecord[],
) =>
  writeLiveControlEvidence({
    archiveRoot: root,
    sourceSha: SOURCE_SHA,
    profile: PROFILE,
    role: ROLE,
    catalogRoute: "/reports",
    resolvedRoute: "/reports",
    cellPath: path.join(root, "cell.json"),
    cell,
    records,
    capturedAt: "2026-08-04T00:00:00.000Z",
  });

test("closes a pending cell only after every baseline control passes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "live-controls-"));
  const result = await write(root, cellFor(["button:Open:1"]), [
    recordFor("button:Open:1"),
  ]);

  expect(result.cell.verdict).toBe("pass");
  expect(result.cell.controls[0]?.actionResult.kind).toBe("exercised");
});

test("fails action failures, ambiguous outcomes, and omitted baseline controls", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "live-controls-"));
  const result = await write(
    root,
    cellFor(["button:Open:1", "button:Next:1"]),
    [recordFor("button:Open:1", "ambiguous")],
  );

  expect(result.cell.verdict).toBe("fail");
  const cellText = await readFile(path.join(root, "cell.json"), "utf8");
  expect(cellText).toContain("Baseline control has no live action result");
});

test("retains an unknown revealed control only in raw evidence and fails the cell", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "live-controls-"));
  const result = await write(root, cellFor(["button:Open:1"]), [
    recordFor("button:Open:1"),
    recordFor("menuitem:Delete:1"),
  ]);

  expect(result.cell.controls.map(({ controlKey }) => controlKey)).toEqual([
    "button:Open:1",
  ]);
  expect(result.cell.verdict).toBe("fail");
  expect(await readFile(result.evidence.archivePath, "utf8")).toContain(
    "menuitem:Delete:1",
  );
});

test("updates a known frozen dynamic control without appending a duplicate", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "live-controls-"));
  const result = await write(
    root,
    cellFor(["button:Open:1", "menuitem:Delete:1"]),
    [recordFor("button:Open:1"), recordFor("menuitem:Delete:1")],
  );

  expect(result.cell.verdict).toBe("pass");
  expect(result.cell.controls.map(({ controlKey }) => controlKey)).toEqual([
    "button:Open:1",
    "menuitem:Delete:1",
  ]);
});

test("indexes many unique controls and duplicates with one key read per record", () => {
  const uniqueCount = 4096;
  const duplicateKeys = [
    "button:Unique:512",
    "button:Unique:2048",
    "button:Unique:3500",
  ] as const;
  const records = [
    ...Array.from({ length: uniqueCount }, (_, index) =>
      recordFor(`button:Unique:${index}`),
    ),
    ...duplicateKeys.flatMap((duplicateKey) => [
      recordFor(duplicateKey, "pass"),
      recordFor(duplicateKey, "fail"),
    ]),
  ];
  const readControlKey = vi.fn(
    (record: LiveControlActionRecord) => record.controlKey,
  );
  const instrumentedRecords = Object.freeze(
    records.map((record) =>
      Object.defineProperty({ ...record }, "controlKey", {
        configurable: false,
        enumerable: true,
        get: () => readControlKey(record),
      }),
    ),
  );

  const index = indexLiveControlRecords(instrumentedRecords);

  expect(readControlKey).toHaveBeenCalledTimes(records.length);
  expect(index.lastRecordByControlKey.size).toBe(uniqueCount);
  expect(index.duplicateControlKeys).toEqual(new Set(duplicateKeys));
  duplicateKeys.forEach((duplicateKey) => {
    expect(index.lastRecordByControlKey.get(duplicateKey)?.status).toBe("fail");
  });
});

test("fails duplicate frozen records while retaining the final action result", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "live-controls-"));
  const result = await write(root, cellFor(["button:Open:1"]), [
    recordFor("button:Open:1"),
    recordFor("button:Open:1", "fail"),
  ]);

  expect(result.cell.verdict).toBe("fail");
  expect(result.cell.controls[0]?.actionResult).toMatchObject({
    kind: "exercised",
    result: "fail",
  });
});

test("stores different state cells under distinct action artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "live-controls-"));
  const first = await write(root, cellFor(["button:Open:1"], "state-a"), [
    recordFor("button:Open:1"),
  ]);
  const second = await write(root, cellFor(["button:Open:1"], "state-b"), [
    recordFor("button:Open:1"),
  ]);

  expect(first.evidence.archivePath).toContain("/cells/state-a/action/");
  expect(second.evidence.archivePath).toContain("/cells/state-b/action/");
  expect(first.evidence.archivePath).not.toBe(second.evidence.archivePath);
  expect(first.evidence.kind).toBe("control-action");
});

test("keeps a typed disabled disposition terminal without treating it as a pass action", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "live-controls-"));
  const result = await write(root, cellFor(["button:Locked:1"]), [
    recordFor("button:Locked:1", "not-exercised"),
  ]);

  expect(result.cell.verdict).toBe("pass");
  expect(result.cell.controls[0]?.actionResult).toMatchObject({
    kind: "not-exercised",
    policy: "unavailable",
    reason: "Control is disabled",
  });
});

test("fails an enabled control that became unavailable during execution", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "live-controls-"));
  const result = await write(root, cellFor(["button:Open:1"]), [
    recordFor(
      "button:Open:1",
      "not-exercised",
      "Control is not present in the live DOM",
    ),
  ]);
  const cell = result.cell;
  const unavailable = cell.controls[0];
  expect(unavailable?.actionResult).toMatchObject({
    kind: "not-exercised",
    policy: "unavailable",
  });
  expect(cell.verdict).toBe("fail");
});

test("fails an enabled potentially mutating control without recovery", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "live-controls-"));
  const result = await write(root, cellFor(["button:Save:1"]), [
    {
      ...recordFor("button:Save:1", "not-exercised", "no disposable reset"),
      action: {
        controlKey: "button:Save:1",
        operation: "click",
        safety: "irreversible",
        transition: "none",
      },
      policy: "unsafe",
    },
  ]);

  expect(result.cell.verdict).toBe("fail");
});
