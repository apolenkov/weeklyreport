import net from "node:net";

const CONNECT_TIMEOUT_MS = 250;
const RELEASE_POLL_MS = 100;
const DEFAULT_RELEASE_TIMEOUT_MS = 10_000;

export const isLoopbackPortOpen = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (open: boolean): void => {
      socket.destroy();
      resolve(open);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => finish(false));
  });

export async function waitForLoopbackPortsFree(
  ports: readonly number[],
  options: Readonly<{
    readonly isOpen?: (port: number) => Promise<boolean>;
    readonly timeoutMs?: number;
  }> = {},
): Promise<boolean> {
  const isOpen = options.isOpen ?? isLoopbackPortOpen;
  const timeoutMs = options.timeoutMs ?? DEFAULT_RELEASE_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  do {
    const states = await Promise.all(ports.map((port) => isOpen(port)));
    if (states.every((open) => !open)) return true;
    await new Promise((resolve) => setTimeout(resolve, RELEASE_POLL_MS));
  } while (Date.now() < deadline);
  return false;
}
