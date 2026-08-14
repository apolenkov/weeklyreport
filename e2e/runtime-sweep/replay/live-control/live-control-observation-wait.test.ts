import { errors, type Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";

import {
  type PageSnapshot,
  waitForObservation,
} from "./live-control-observation.ts";

interface ObservationSignalFixture {
  readonly documentId: string;
  readonly url: string;
  readonly focus: string;
  readonly focusTarget: string;
  readonly network: number;
}

const snapshot = (overrides: Partial<PageSnapshot> = {}): PageSnapshot => ({
  url: "http://127.0.0.1:3105/report",
  dom: '{"text":"Report","controls":[]}',
  focus: "BODY::Report",
  focusTarget: "body#:",
  network: 1,
  documentId: "document-before",
  ...overrides,
});

const signal = (
  overrides: Partial<ObservationSignalFixture> = {},
): ObservationSignalFixture => ({
  documentId: "document-before",
  url: "http://127.0.0.1:3105/report",
  focus: "BODY::Report",
  focusTarget: "body#:",
  network: 1,
  ...overrides,
});

const pageForObservation = (input: {
  readonly signals: readonly (ObservationSignalFixture | Error | undefined)[];
  readonly snapshots?: readonly PageSnapshot[];
}) => {
  const signals = [...input.signals];
  const snapshots = [...(input.snapshots ?? [])];
  const fullSnapshots = { count: 0 };
  const evaluate = vi.fn((): Promise<unknown> => {
    fullSnapshots.count += 1;
    const nextSnapshot = snapshots.shift();
    return nextSnapshot === undefined
      ? Promise.reject(new Error("Missing full snapshot fixture"))
      : Promise.resolve(nextSnapshot);
  });
  const waitForFunction = vi.fn((): Promise<unknown> => {
    const nextSignal = signals.shift();
    if (nextSignal instanceof Error) return Promise.reject(nextSignal);
    if (nextSignal === undefined)
      return Promise.reject(new errors.TimeoutError("Signal wait timed out"));
    return Promise.resolve({ dispose: () => Promise.resolve() });
  });
  return {
    evaluate,
    fullSnapshotCalls: () => fullSnapshots.count,
    page: { evaluate, waitForFunction } as unknown as Page,
    signalWaitCalls: () => waitForFunction.mock.calls.length,
  };
};

describe("bounded live control observation waiting", () => {
  it.each([
    {
      kind: "url",
      after: snapshot({ url: "http://127.0.0.1:3105/reports" }),
      signal: signal({ url: "http://127.0.0.1:3105/reports" }),
      expected: {
        kind: "url",
        detail: "URL changed to http://127.0.0.1:3105/reports",
      },
    },
    {
      kind: "dom",
      after: snapshot({
        dom: '{"text":"Changed","controls":[]}',
      }),
      signal: signal({ documentId: "document-after" }),
      expected: {
        kind: "dom",
        detail: "Live DOM or control state changed",
      },
    },
    {
      kind: "network",
      after: snapshot({ network: 2 }),
      signal: signal({ network: 2 }),
      expected: {
        kind: "network",
        detail: "1 resource request(s) observed",
      },
    },
    {
      kind: "focus",
      after: snapshot({
        focus: "MAIN::Report",
        focusTarget: "main#main-content:",
      }),
      signal: signal({
        focus: "MAIN::Report",
        focusTarget: "main#main-content:",
      }),
      expected: {
        kind: "focus",
        detail: "Focus moved to page content after the action",
      },
    },
  ] as const)(
    "takes one full snapshot after a $kind signal",
    async (fixture) => {
      const fake = pageForObservation({
        signals: [fixture.signal],
        snapshots: [fixture.after],
      });

      await expect(
        waitForObservation(fake.page, snapshot(), 100),
      ).resolves.toEqual(fixture.expected);
      expect(fake.fullSnapshotCalls()).toBe(1);
    },
  );

  it("requires a canonical observation after a same-URL document replacement", async () => {
    const fake = pageForObservation({
      signals: [signal({ documentId: "document-after" })],
      snapshots: [
        snapshot({
          documentId: "document-after",
          dom: '{"text":"Changed document","controls":[]}',
        }),
      ],
    });

    await expect(
      waitForObservation(fake.page, snapshot(), 100),
    ).resolves.toEqual({
      kind: "dom",
      detail: "Live DOM or control state changed",
    });
    expect(fake.fullSnapshotCalls()).toBe(1);
  });

  it("rejects a same-URL document replacement without a canonical observation", async () => {
    const fake = pageForObservation({
      signals: [signal({ documentId: "document-after" }), undefined],
      snapshots: [snapshot({ documentId: "document-after" })],
    });

    await expect(
      waitForObservation(fake.page, snapshot(), 100),
    ).resolves.toBeUndefined();
    expect(fake.fullSnapshotCalls()).toBe(1);
  });

  it("retries a destroyed navigation context and requires settled evidence", async () => {
    const fake = pageForObservation({
      signals: [
        new Error("Execution context was destroyed because of a navigation"),
        signal({ documentId: "document-after" }),
      ],
      snapshots: [
        snapshot({
          documentId: "document-after",
          dom: '{"text":"Changed document","controls":[]}',
        }),
      ],
    });

    await expect(
      waitForObservation(fake.page, snapshot(), 100),
    ).resolves.toEqual({
      kind: "dom",
      detail: "Live DOM or control state changed",
    });
    expect(fake.fullSnapshotCalls()).toBe(1);
  });

  it("rejects a destroyed context without a settled observation", async () => {
    const fake = pageForObservation({
      signals: [
        new Error("Execution context was destroyed because of a navigation"),
        undefined,
      ],
    });

    await expect(
      waitForObservation(fake.page, snapshot(), 100),
    ).resolves.toBeUndefined();
    expect(fake.fullSnapshotCalls()).toBe(0);
  });

  it("preserves a canonical control-property DOM observation after a signal", async () => {
    const fake = pageForObservation({
      signals: [signal({ documentId: "document-after" })],
      snapshots: [
        snapshot({
          dom: '{"text":"Changed input","controls":[]}',
        }),
      ],
    });

    await expect(
      waitForObservation(fake.page, snapshot(), 100),
    ).resolves.toEqual({
      kind: "dom",
      detail: "Live DOM or control state changed",
    });
    expect(fake.fullSnapshotCalls()).toBe(1);
  });

  it("rebases an unchanged signal instead of snapshotting every frame", async () => {
    const fake = pageForObservation({
      signals: [signal({ network: 2 }), undefined],
      snapshots: [snapshot()],
    });

    await expect(
      waitForObservation(fake.page, snapshot(), 100),
    ).resolves.toBeUndefined();
    expect(fake.fullSnapshotCalls()).toBe(1);
    expect(fake.signalWaitCalls()).toBe(2);
  });
});
