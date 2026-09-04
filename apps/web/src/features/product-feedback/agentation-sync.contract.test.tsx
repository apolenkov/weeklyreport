import { act, cleanup, render, waitFor } from "@testing-library/react";
import {
  Agentation,
  type Annotation,
  loadAnnotations,
  saveAnnotations,
} from "agentation";
import { afterEach, describe, expect, it, vi } from "vitest";

const ENDPOINT = "/api/v1/agentation";
const SESSION_ID = "upstream-contract-session";
const streams: ContractEventSource[] = [];

// Only the browser transport is simulated; Agentation's sync and storage code runs unchanged.
class ContractEventSource extends EventTarget {
  constructor(readonly url: string) {
    super();
    streams.push(this);
  }
  close = vi.fn();
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  streams.length = 0;
});

const annotation = (id: string): Annotation => ({
  id,
  x: 10,
  y: 20,
  comment: "Contract annotation",
  element: "button",
  elementPath: "main > button",
  timestamp: Date.now(),
});

function respond(sessionAnnotations: Annotation[], replayStatus = "pending") {
  vi.stubGlobal("EventSource", ContractEventSource);
  const fetcher = vi.fn((url: string, options?: RequestInit) => {
    if (url === `${ENDPOINT}/health`)
      return Promise.resolve(Response.json({ status: "ok" }));
    if (url === `${ENDPOINT}/sessions/${SESSION_ID}`)
      return Promise.resolve(
        Response.json({ id: SESSION_ID, annotations: sessionAnnotations }),
      );
    if (
      url === `${ENDPOINT}/sessions/${SESSION_ID}/annotations` &&
      options?.method === "POST"
    ) {
      if (typeof options.body !== "string")
        throw new Error("Expected a JSON request body");
      const input = JSON.parse(options.body) as Annotation;
      return Promise.resolve(
        Response.json({
          ...input,
          id: "server-id",
          sessionId: SESSION_ID,
          status: replayStatus,
        }),
      );
    }
    throw new Error(`Unexpected public Agentation request: ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

describe("unmodified Agentation browser sync", () => {
  it("uploads a retained local annotation and adopts its server ID", async () => {
    const fetcher = respond([]);
    saveAnnotations(location.pathname, [annotation("client-id")]);
    render(<Agentation endpoint={ENDPOINT} sessionId={SESSION_ID} />);
    await waitFor(() =>
      expect(loadAnnotations(location.pathname).map((item) => item.id)).toEqual(
        ["server-id"],
      ),
    );
    expect(fetcher).toHaveBeenCalledWith(
      `${ENDPOINT}/sessions/${SESSION_ID}/annotations`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it.each(["client-id", "server-id"])(
    "discards a stale %s when replay returns dismissed",
    async (id) => {
      const fetcher = respond([], "dismissed");
      saveAnnotations(location.pathname, [annotation(id)]);
      render(<Agentation endpoint={ENDPOINT} sessionId={SESSION_ID} />);
      await waitFor(() =>
        expect(fetcher).toHaveBeenCalledWith(
          `${ENDPOINT}/sessions/${SESSION_ID}/annotations`,
          expect.objectContaining({ method: "POST" }),
        ),
      );
      await waitFor(() =>
        expect(loadAnnotations(location.pathname)).toEqual([]),
      );
    },
  );

  it("uses terminal annotation.updated to clear its native storage and closes the stream", async () => {
    respond([{ ...annotation("server-id"), status: "pending" }]);
    const { unmount } = render(
      <Agentation endpoint={ENDPOINT} sessionId={SESSION_ID} />,
    );
    await waitFor(() => expect(streams).toHaveLength(1));
    expect(streams[0]?.url).toBe(`${ENDPOINT}/sessions/${SESSION_ID}/events`);
    await waitFor(() =>
      expect(loadAnnotations(location.pathname).map((item) => item.id)).toEqual(
        ["server-id"],
      ),
    );
    act(() => {
      streams[0]?.dispatchEvent(
        new MessageEvent("annotation.updated", {
          data: JSON.stringify({
            payload: { id: "server-id", status: "dismissed", deleted: true },
          }),
        }),
      );
    });
    await waitFor(() => expect(loadAnnotations(location.pathname)).toEqual([]));
    unmount();
    expect(streams[0]?.close).toHaveBeenCalledOnce();
  });
});
