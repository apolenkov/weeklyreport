// agent-browser 0.38–0.39 `press` sends the Windows virtual-key code as
// nativeVirtualKeyCode. Chrome on macOS reads that field as a native key code
// (Escape 27 is the Minus key), after which the page receives thousands of
// phantom keydown events per second until it navigates. The flood saturates
// the main thread, so timers (Radix focus restore) and touch handling stall
// for tens of seconds. These events omit nativeVirtualKeyCode.
const META = 4;
const SHIFT = 8;
const MODIFIER_BITS = new Map([
  ["Alt", 1],
  ["Control", 2],
  ["Meta", META],
  ["Shift", SHIFT],
]);

interface KeyDefinition {
  readonly key: string;
  readonly code: string;
  readonly keyCode: number;
  readonly text?: string;
  readonly command?: string;
}

const NAMED_KEYS: Readonly<Record<string, KeyDefinition>> = {
  Enter: { key: "Enter", code: "Enter", keyCode: 13, text: "\r" },
  Escape: { key: "Escape", code: "Escape", keyCode: 27 },
  Tab: { key: "Tab", code: "Tab", keyCode: 9 },
  Space: { key: " ", code: "Space", keyCode: 32, text: " " },
  Backspace: {
    key: "Backspace",
    code: "Backspace",
    keyCode: 8,
    command: "deleteBackward",
  },
  ArrowLeft: {
    key: "ArrowLeft",
    code: "ArrowLeft",
    keyCode: 37,
    command: "moveLeft",
  },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", keyCode: 38, command: "moveUp" },
  ArrowRight: {
    key: "ArrowRight",
    code: "ArrowRight",
    keyCode: 39,
    command: "moveRight",
  },
  ArrowDown: {
    key: "ArrowDown",
    code: "ArrowDown",
    keyCode: 40,
    command: "moveDown",
  },
  Home: {
    key: "Home",
    code: "Home",
    keyCode: 36,
    command: "moveToBeginningOfLine",
  },
  End: { key: "End", code: "End", keyCode: 35, command: "moveToEndOfLine" },
};

export interface KeyEvent {
  readonly type: "keyDown" | "rawKeyDown" | "keyUp";
  readonly key: string;
  readonly code: string;
  readonly windowsVirtualKeyCode: number;
  readonly modifiers: number;
  readonly text?: string;
  readonly unmodifiedText?: string;
  readonly commands?: readonly string[];
}

function definition(name: string): KeyDefinition {
  const named = NAMED_KEYS[name];
  if (named) return named;
  if (/^[a-z0-9]$/u.test(name)) {
    const upper = name.toUpperCase();
    return {
      key: name,
      code: /\d/u.test(name) ? `Digit${name}` : `Key${upper}`,
      keyCode: upper.charCodeAt(0),
      text: name,
    };
  }
  throw new Error(`Unsupported E2E key: ${name}`);
}

/** Expands "Control+Enter"-style specs into the CDP key down/up pair. */
export function keyEvents(spec: string): readonly [KeyEvent, KeyEvent] {
  const parts = spec.split("+");
  const name = parts.pop();
  if (name === undefined) throw new Error("Empty E2E key spec");
  let modifiers = 0;
  for (const modifier of parts) {
    const bit = MODIFIER_BITS.get(modifier);
    if (bit === undefined) {
      throw new Error(`Unsupported E2E key modifier in ${spec}`);
    }
    modifiers += bit;
  }
  const def = definition(name);
  const typed = def.text !== undefined && (modifiers & ~SHIFT) === 0;
  const command =
    def.command !== undefined && modifiers & SHIFT
      ? `${def.command}AndModifySelection`
      : def.command;
  const base = {
    key: def.key,
    code: def.code,
    windowsVirtualKeyCode: def.keyCode,
    modifiers,
  };
  return [
    {
      ...base,
      type: typed ? "keyDown" : "rawKeyDown",
      ...(typed ? { text: def.text, unmodifiedText: def.text } : {}),
      ...(command === undefined ? {} : { commands: [command] }),
    },
    { ...base, type: "keyUp" },
  ];
}

interface PageTarget {
  readonly type: string;
  readonly url: string;
  readonly webSocketDebuggerUrl: string;
}

async function connect(webSocketUrl: string, signal: AbortSignal) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error("CDP connect")), {
      once: true,
    });
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
  let counter = 0;
  const waiting = new Map<number, (error: string | undefined) => void>();
  socket.addEventListener("message", (event) => {
    const reply = JSON.parse(String(event.data)) as {
      id?: number;
      error?: { message: string };
    };
    if (reply.id !== undefined) waiting.get(reply.id)?.(reply.error?.message);
  });
  const send = (method: string, params: object) =>
    new Promise<void>((resolve, reject) => {
      counter += 1;
      waiting.set(counter, (error) =>
        error === undefined
          ? resolve()
          : reject(new Error(`${method}: ${error}`)),
      );
      socket.send(JSON.stringify({ id: counter, method, params }));
    });
  return { send, close: () => socket.close() };
}

type PageSocket = Awaited<ReturnType<typeof connect>> & {
  readonly url: string;
};
const pageSockets = new Map<string, PageSocket>();

/**
 * Closing a CDP client resets the page's offline emulation, so each session
 * keeps one page socket open until its browser closes.
 */
export function releasePressSocket(session: string): void {
  pageSockets.get(session)?.close();
  pageSockets.delete(session);
}

/**
 * Dispatches a key press to the session's page over a direct page socket.
 * Attaching through the browser socket makes agent-browser re-enable its
 * network capture. Returns false when the command is not a press, or when
 * fullscreen is active: the browser exits fullscreen on Escape only for the
 * native key code, so agent-browser's own press stays responsible there.
 * `run` executes an agent-browser command for the session.
 */
export async function pressKey(
  session: string,
  args: readonly string[],
  run: (
    args: readonly string[],
    session: string,
  ) => Promise<Record<string, unknown>>,
  signal: AbortSignal,
): Promise<boolean> {
  if (args.at(0) !== "press") return false;
  const fullscreen = await run(
    ["eval", "document.fullscreenElement !== null"],
    session,
  );
  if (fullscreen.result === true) return false;
  const { cdpUrl } = await run(["get", "cdp-url"], session);
  const { url } = await run(["get", "url"], session);
  if (typeof cdpUrl !== "string" || typeof url !== "string") {
    throw new TypeError("agent-browser returned no CDP or page URL");
  }
  const listing = await fetch(
    new URL("/json/list", cdpUrl.replace(/^ws/u, "http")),
    { signal },
  );
  const pages = ((await listing.json()) as PageTarget[]).filter(
    (target) => target.type === "page",
  );
  const page =
    pages.length === 1
      ? pages.at(0)
      : pages.find((target) => target.url === url);
  if (!page) throw new Error(`No unique page target for ${url}`);
  let cdp = pageSockets.get(session);
  if (cdp?.url !== page.webSocketDebuggerUrl) {
    releasePressSocket(session);
    cdp = {
      ...(await connect(page.webSocketDebuggerUrl, signal)),
      url: page.webSocketDebuggerUrl,
    };
    pageSockets.set(session, cdp);
  }
  for (const event of keyEvents(String(args.at(1)))) {
    await cdp.send("Input.dispatchKeyEvent", event);
  }
  return true;
}
