import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type AppReadyArgument,
  type AppReadyPage,
  navigateReveal,
  type NavigationPage,
  waitForRevealSurfaceReady,
} from "./navigation.ts";

class ReadyElement {
  readonly ariaHidden = "false";

  contains(): boolean {
    return false;
  }

  getAttribute(name: string): string | null {
    return name === "aria-busy" ? "false" : null;
  }

  getClientRects(): readonly object[] {
    return [{}];
  }

  matches(): boolean {
    return false;
  }

  querySelector(selector: string): ReadyElement | null {
    return selector === "h1" ? new ReadyElement() : null;
  }

  querySelectorAll(): readonly ReadyElement[] {
    return [];
  }
}

function installReadyDocument(getAnimations?: () => readonly object[]): void {
  const main = new ReadyElement();
  const documentStub: {
    readonly getAnimations?: () => readonly object[];
    readonly querySelector: () => ReadyElement;
    readonly querySelectorAll: () => readonly ReadyElement[];
  } = {
    querySelector: () => main,
    querySelectorAll: () => [],
    ...(getAnimations === undefined ? {} : { getAnimations }),
  };
  vi.stubGlobal("HTMLElement", ReadyElement);
  vi.stubGlobal("document", documentStub);
}

function requireArgument(
  argument: AppReadyArgument | undefined,
): AppReadyArgument {
  if (argument === undefined)
    throw new Error("Reveal readiness argument was not provided");
  return argument;
}

describe("reveal animation readiness", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("settles finite transitions after reveal navigation without network-idle", async () => {
    const argumentsSeen: AppReadyArgument[] = [];
    const waitForLoadState = vi.fn(() => Promise.resolve());
    const page = {
      url: () => "http://127.0.0.1:3105/head",
      goto: () => Promise.resolve({ status: () => 204 }),
      waitForURL: () => Promise.resolve(),
      waitForLoadState,
      waitForFunction: vi.fn(
        (
          _predicate: (argument: AppReadyArgument) => boolean,
          argument?: AppReadyArgument,
        ) => {
          argumentsSeen.push(requireArgument(argument));
          return Promise.resolve();
        },
      ),
    } satisfies NavigationPage;

    await expect(navigateReveal(page, "/head")).resolves.toBe(204);

    expect(waitForLoadState).not.toHaveBeenCalled();
    expect(argumentsSeen).toHaveLength(2);
    expect(argumentsSeen[0]?.overlaySelector).toBeDefined();
    expect(argumentsSeen[0]?.requireAnimationsSettled).not.toBe(true);
    expect(argumentsSeen[1]?.requireAnimationsSettled).toBe(true);
  });

  it("waits for the final semantic state of a finite transition", async () => {
    const events: string[] = [];
    let playState: "finished" | "running" = "running";
    let semanticState = "collapsed";
    const animation = {
      effect: {
        getComputedTiming: () => ({
          duration: 300,
          iterations: 1,
          progress: playState === "running" ? 0.5 : 1,
        }),
      },
      get playState() {
        return playState;
      },
    };
    installReadyDocument(() => [animation]);
    const waitForFunction = vi.fn(
      (
        predicate: (argument: AppReadyArgument) => boolean,
        argument?: AppReadyArgument,
      ) => {
        const exactArgument = requireArgument(argument);
        events.push("ready");
        if (waitForFunction.mock.calls.length === 1) {
          expect(predicate(exactArgument)).toBe(true);
          expect(semanticState).toBe("collapsed");
          return Promise.resolve();
        }
        expect(predicate(exactArgument)).toBe(false);
        playState = "finished";
        semanticState = "expanded";
        events.push("transition-finished");
        expect(predicate(exactArgument)).toBe(true);
        expect(animation.effect.getComputedTiming().progress).toBe(1);
        expect(semanticState).toBe("expanded");
        return Promise.resolve();
      },
    );

    await waitForRevealSurfaceReady({ waitForFunction });

    expect(waitForFunction).toHaveBeenCalledTimes(2);
    expect(waitForFunction).toHaveBeenNthCalledWith(
      1,
      expect.any(Function),
      expect.not.objectContaining({ requireAnimationsSettled: true }),
      { polling: "raf", timeout: 10_000 },
    );
    expect(waitForFunction).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      expect.objectContaining({ requireAnimationsSettled: true }),
      { polling: "raf", timeout: 10_000 },
    );
    expect(events).toEqual(["ready", "ready", "transition-finished"]);
  });

  it("ignores an infinite decorative animation", async () => {
    installReadyDocument(() => [
      {
        effect: {
          getComputedTiming: () => ({ duration: 300, iterations: Infinity }),
        },
        playState: "running",
      },
    ]);
    const waitForFunction = vi.fn(
      (
        predicate: (argument: AppReadyArgument) => boolean,
        argument?: AppReadyArgument,
      ) => {
        expect(predicate(requireArgument(argument))).toBe(true);
        return Promise.resolve();
      },
    );

    await expect(
      waitForRevealSurfaceReady({ waitForFunction }),
    ).resolves.toBeUndefined();
    expect(waitForFunction).toHaveBeenCalledTimes(2);
  });

  it.each([
    { name: "the animation API is unavailable", getAnimations: undefined },
    {
      name: "a finite animation is running",
      getAnimations: () => [
        {
          effect: {
            getComputedTiming: () => ({ duration: 300, iterations: 1 }),
          },
          playState: "running",
        },
      ],
    },
    {
      name: "a finite animation is pending",
      getAnimations: () => [
        {
          effect: {
            getComputedTiming: () => ({ duration: 300, iterations: 1 }),
          },
          playState: "pending",
        },
      ],
    },
    {
      name: "a finite animation is paused before completion",
      getAnimations: () => [
        {
          effect: {
            getComputedTiming: () => ({ duration: 300, iterations: 1 }),
          },
          playState: "paused",
        },
      ],
    },
    {
      name: "the animation API throws",
      getAnimations: () => {
        throw new Error("animation inspection failed");
      },
    },
  ])("fails closed when $name", async ({ getAnimations }) => {
    const timeout = Object.assign(
      new Error("reveal animation readiness timed out"),
      { name: "TimeoutError" },
    );
    installReadyDocument(getAnimations);
    const waitForFunction = vi.fn(
      (
        predicate: (argument: AppReadyArgument) => boolean,
        argument?: AppReadyArgument,
      ) => {
        const exactArgument = requireArgument(argument);
        if (waitForFunction.mock.calls.length === 1) {
          expect(predicate(exactArgument)).toBe(true);
          return Promise.resolve();
        }
        expect(predicate(exactArgument)).toBe(false);
        return Promise.reject(timeout);
      },
    );
    const page = { waitForFunction } satisfies AppReadyPage;

    await expect(waitForRevealSurfaceReady(page)).rejects.toBe(timeout);
    expect(waitForFunction).toHaveBeenCalledTimes(2);
  });
});
