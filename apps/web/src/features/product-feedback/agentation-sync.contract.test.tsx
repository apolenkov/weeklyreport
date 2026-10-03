import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  Agentation,
  type Annotation,
  loadAnnotations,
  saveAnnotations,
} from "agentation";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { useAgentationDeliveryStatus } from "./ui/use-agentation-delivery-status";

const ENDPOINT = "/api/v1/agentation";
const SESSION_ID = "upstream-contract-session";
const streams: ContractEventSource[] = [];

// Only the browser transport is simulated; the installed Agentation package owns sync and storage.
class ContractEventSource extends EventTarget {
  constructor(readonly url: string) {
    super();
    streams.push(this);
  }
  close = vi.fn();
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "elementFromPoint");
  localStorage.clear();
  streams.length = 0;
});

// Agentation's 200 ms exit timer survives unmount; let it fire before jsdom is torn down.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 300)));

const annotation = (id: string): Annotation => ({
  id,
  x: 10,
  y: 20,
  comment: "Contract annotation",
  element: "button",
  elementPath: "main > button",
  timestamp: Date.now(),
});

function respond(
  sessionAnnotations: Annotation[],
  replayStatus = "pending",
  failReadbackAfterInitialSync = false,
  holdAnnotationSync = false,
) {
  vi.stubGlobal("EventSource", ContractEventSource);
  let sessionReadCount = 0;
  let annotationWriteCount = 0;
  const fetcher = vi.fn((url: string, options?: RequestInit) => {
    if (url === `${ENDPOINT}/health`)
      return Promise.resolve(Response.json({ status: "ok" }));
    if (url === `${ENDPOINT}/sessions/${SESSION_ID}`) {
      sessionReadCount += 1;
      if (failReadbackAfterInitialSync && sessionReadCount > 1)
        return Promise.resolve(Response.json({}, { status: 503 }));
      return Promise.resolve(
        Response.json({ id: SESSION_ID, annotations: sessionAnnotations }),
      );
    }
    if (
      url === `${ENDPOINT}/sessions/${SESSION_ID}/annotations` &&
      options?.method === "POST"
    ) {
      if (typeof options.body !== "string")
        throw new Error("Expected a JSON request body");
      const input = JSON.parse(options.body) as Annotation;
      annotationWriteCount += 1;
      if (holdAnnotationSync)
        return new Promise<Response>(() => {
          // Held open to model a pending Agentation annotation sync.
        });
      return Promise.resolve(
        Response.json({
          ...input,
          clientId: input.id,
          id: `server-id-${annotationWriteCount}`,
          sessionId: SESSION_ID,
          status: replayStatus,
        }),
      );
    }
    if (
      url.startsWith(`${ENDPOINT}/annotations/`) &&
      options?.method === "DELETE"
    )
      return Promise.resolve(new Response(null, { status: 204 }));
    throw new Error(`Unexpected public Agentation request: ${url}`);
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

// agentation 3.1 renders its toolbar, popups and markers inside an open shadow root.
function nativeRoot(): ShadowRoot {
  const root = document.querySelector("agentation-toolbar")?.shadowRoot;
  if (!root) throw new Error("Expected the Agentation shadow root");
  return root;
}

function nativeUi() {
  return within(nativeRoot() as unknown as HTMLElement);
}

describe("pinned Agentation browser sync", () => {
  it("uploads a retained local annotation and adopts its server ID", async () => {
    const fetcher = respond([]);
    saveAnnotations(location.pathname, [annotation("client-id")]);
    render(<Agentation endpoint={ENDPOINT} sessionId={SESSION_ID} />);
    await waitFor(() =>
      expect(loadAnnotations(location.pathname).map((item) => item.id)).toEqual(
        ["server-id-1"],
      ),
    );
    expect(fetcher).toHaveBeenCalledWith(
      `${ENDPOINT}/sessions/${SESSION_ID}/annotations`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("adopts the server ID without preserving the client-local ID", async () => {
    const fetcher = respond([]);
    const onAnnotationAdd = vi.fn();
    render(
      <>
        <button data-testid="feedback-target" type="button">
          Feedback target
        </button>
        <Agentation
          endpoint={ENDPOINT}
          onAnnotationAdd={onAnnotationAdd}
          sessionId={SESSION_ID}
        />
      </>,
    );
    const target = screen.getByTestId("feedback-target");
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => target),
    });
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        `${ENDPOINT}/sessions/${SESSION_ID}`,
      ),
    );

    fireEvent.click(
      nativeUi().getByRole("button", { name: "Start feedback mode" }),
    );
    fireEvent.click(target, { clientX: 10, clientY: 20 });
    fireEvent.change(
      await nativeUi().findByPlaceholderText("What should change?"),
      {
        target: { value: "Live contract annotation" },
      },
    );
    fireEvent.click(nativeUi().getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onAnnotationAdd).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(loadAnnotations(location.pathname).map(({ id }) => id)).toEqual([
        "server-id-1",
      ]),
    );
    expect(loadAnnotations(location.pathname)[0]).not.toHaveProperty(
      "clientId",
    );
    expect(fetcher).toHaveBeenCalledWith(
      `${ENDPOINT}/sessions/${SESSION_ID}/annotations`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("clears delivery state on native delete or clear while sync is pending", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const fetcher = respond([], "pending", true, true);
    const onAnnotationAdd = vi.fn();
    const onAnnotationDelete = vi.fn();
    const onAnnotationsClear = vi.fn();

    function DeliveryHarness() {
      const delivery = useAgentationDeliveryStatus({
        authorUserId: "author-1",
        initialSessionId: SESSION_ID,
        scopeKey: `${location.pathname}:${SESSION_ID}`,
      });
      return (
        <>
          <button data-testid="feedback-target" type="button">
            Feedback target
          </button>
          <Agentation
            endpoint={ENDPOINT}
            onAnnotationAdd={(item) => {
              onAnnotationAdd(item);
              delivery.onAnnotationAdd(item);
            }}
            onAnnotationDelete={(item) => {
              onAnnotationDelete(item);
              delivery.onAnnotationDelete(item);
            }}
            onAnnotationsClear={(items) => {
              onAnnotationsClear(items);
              delivery.onAnnotationsClear(items);
            }}
            sessionId={SESSION_ID}
          />
          <output data-testid="delivery-status">{delivery.status}</output>
        </>
      );
    }

    render(<DeliveryHarness />);
    const target = screen.getByTestId("feedback-target");
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => target),
    });
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        `${ENDPOINT}/sessions/${SESSION_ID}`,
      ),
    );

    fireEvent.click(
      nativeUi().getByRole("button", { name: "Start feedback mode" }),
    );
    fireEvent.click(target, { clientX: 10, clientY: 20 });
    fireEvent.change(
      await nativeUi().findByPlaceholderText("What should change?"),
      {
        target: { value: "Delete after failed readback" },
      },
    );
    fireEvent.click(nativeUi().getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onAnnotationAdd).toHaveBeenCalledTimes(1));
    const deleteClientId = (onAnnotationAdd.mock.calls[0]?.[0] as Annotation)
      .id;
    await waitFor(() =>
      expect(loadAnnotations(location.pathname)).toEqual([
        expect.objectContaining({ id: deleteClientId }),
      ]),
    );
    await waitFor(() =>
      expect(screen.getByTestId("delivery-status")).toHaveTextContent(
        "checking",
      ),
    );
    await waitFor(
      () =>
        expect(
          fetcher.mock.calls.filter(
            ([url, options]) =>
              url === `${ENDPOINT}/sessions/${SESSION_ID}` &&
              options?.cache === "no-store",
          ),
        ).toHaveLength(1),
      { timeout: 1500 },
    );

    const deleteMarker = nativeRoot().querySelector("[data-annotation-marker]");
    if (!deleteMarker) throw new Error("Expected the retained native marker");
    fireEvent.click(deleteMarker);
    const editPopup = (
      await nativeUi().findByPlaceholderText("Edit your feedback...")
    ).closest("[data-annotation-popup]");
    const deleteButton = editPopup?.querySelector<HTMLButtonElement>(
      'button[class*="deleteButton"]',
    );
    if (!deleteButton) throw new Error("Expected the native delete action");
    fireEvent.click(deleteButton);

    expect(onAnnotationDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: deleteClientId }),
    );
    expect(screen.getByTestId("delivery-status")).toHaveTextContent("idle");
    await waitFor(() => expect(loadAnnotations(location.pathname)).toEqual([]));

    fireEvent.click(target, { clientX: 20, clientY: 30 });
    fireEvent.change(
      await nativeUi().findByPlaceholderText("What should change?"),
      {
        target: { value: "Clear while sync is pending" },
      },
    );
    fireEvent.click(nativeUi().getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onAnnotationAdd).toHaveBeenCalledTimes(2));
    const clearClientId = (onAnnotationAdd.mock.calls[1]?.[0] as Annotation).id;
    await waitFor(() =>
      expect(loadAnnotations(location.pathname)).toEqual([
        expect.objectContaining({ id: clearClientId }),
      ]),
    );
    await waitFor(
      () =>
        expect(
          fetcher.mock.calls.filter(
            ([url, options]) =>
              url === `${ENDPOINT}/sessions/${SESSION_ID}` &&
              options?.cache === "no-store",
          ),
        ).toHaveLength(2),
      { timeout: 1500 },
    );

    fireEvent.click(nativeUi().getByRole("button", { name: "Clear all" }));

    expect(onAnnotationsClear).toHaveBeenCalledWith([
      expect.objectContaining({ id: clearClientId }),
    ]);
    expect(screen.getByTestId("delivery-status")).toHaveTextContent("idle");
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
