// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { Annotation } from "agentation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AGENTATION_CONFIRMATION_DELAYS_MS,
  AGENTATION_CONFIRMATION_TIMEOUT_MS,
  useAgentationDeliveryStatus,
} from "./use-agentation-delivery-status";

const SESSION_ID = "session-1";
const USER_ID = "user-1";
const NOW = "2026-09-06T18:00:00.000Z";
const CONFIRMATION_WINDOW_MS =
  AGENTATION_CONFIRMATION_DELAYS_MS.reduce((total, delay) => total + delay, 0) +
  AGENTATION_CONFIRMATION_TIMEOUT_MS * AGENTATION_CONFIRMATION_DELAYS_MS.length;

function annotation(id: string, sessionId?: string): Annotation {
  return {
    id,
    x: 10,
    y: 20,
    comment: `Comment ${id}`,
    element: "button",
    elementPath: "main > button",
    timestamp: 1_788_720_000_000,
    ...(sessionId ? { sessionId } : {}),
  };
}

function sessionResponse(clientIds: readonly string[]) {
  return {
    id: SESSION_ID,
    url: "/reports/report-1",
    status: "active",
    projectId: "weekly-report",
    createdAt: NOW,
    updatedAt: NOW,
    annotations: clientIds.map((clientId) => ({
      ...annotation(`server-${clientId}`, SESSION_ID),
      clientId,
      status: "pending",
      thread: [],
      createdAt: NOW,
      updatedAt: NOW,
      authorId: USER_ID,
    })),
  };
}

async function advanceConfirmationWindow() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(CONFIRMATION_WINDOW_MS + 1);
  });
}

describe("useAgentationDeliveryStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("binds an early public annotation callback to the later public session callback", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json(sessionResponse(["client-1"])));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() =>
      useAgentationDeliveryStatus({
        authorUserId: USER_ID,
        initialSessionId: null,
        scopeKey: "/reports/report-1:new",
      }),
    );

    act(() => result.current.onAnnotationAdd(annotation("client-1")));
    expect(result.current.status).toBe("checking");
    act(() => result.current.onSessionCreated(SESSION_ID, 0));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        AGENTATION_CONFIRMATION_DELAYS_MS[0] + 1,
      );
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/agentation/sessions/session-1",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      }),
    );
    expect(result.current.status).toBe("idle");
  });

  it("does not remount retry until a public callback supplies the session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(sessionResponse([]))),
    );
    const { result } = renderHook(() =>
      useAgentationDeliveryStatus({
        authorUserId: USER_ID,
        initialSessionId: null,
        scopeKey: "/reports/report-1:new",
      }),
    );

    act(() => result.current.onAnnotationAdd(annotation("unknown-session")));
    await advanceConfirmationWindow();
    expect(result.current.unconfirmed).toBe(true);
    expect(result.current.canRetry).toBe(false);
    act(() => result.current.retry());
    expect(result.current.retryRevision).toBe(0);

    act(() => result.current.onSessionCreated(SESSION_ID, 0));
    expect(result.current.status).toBe("retrying");
    expect(result.current.unconfirmed).toBe(true);
    await advanceConfirmationWindow();
    expect(result.current.unconfirmed).toBe(true);
    expect(result.current.canRetry).toBe(true);
  });

  it("moves a hanging readback from checking to a distinct unconfirmed status", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options?: RequestInit) => {
        if (options?.signal) signals.push(options.signal);
        return new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(options.signal?.reason),
            { once: true },
          );
        });
      }),
    );
    const { result } = renderHook(() =>
      useAgentationDeliveryStatus({
        authorUserId: USER_ID,
        initialSessionId: SESSION_ID,
        scopeKey: "/reports/report-1:session-1",
      }),
    );

    act(() => result.current.onAnnotationAdd(annotation("slow", SESSION_ID)));
    expect(result.current.status).toBe("checking");
    await advanceConfirmationWindow();

    expect(result.current.status).toBe("unconfirmed");
    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it("retries by remount revision and confirms the original client and session IDs", async () => {
    const fetcher = vi
      .fn((_input: RequestInfo | URL, _init?: RequestInit) =>
        Promise.resolve(Response.json(sessionResponse(["original-client"]))),
      )
      .mockResolvedValueOnce(Response.json(sessionResponse([])))
      .mockResolvedValueOnce(Response.json(sessionResponse([])))
      .mockResolvedValueOnce(Response.json(sessionResponse([])));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() =>
      useAgentationDeliveryStatus({
        authorUserId: USER_ID,
        initialSessionId: SESSION_ID,
        scopeKey: "/reports/report-1:session-1",
      }),
    );

    act(() =>
      result.current.onAnnotationAdd(annotation("original-client", SESSION_ID)),
    );
    await advanceConfirmationWindow();
    expect(result.current.status).toBe("unconfirmed");

    act(() => result.current.retry());
    expect(result.current.retryRevision).toBe(1);
    expect(result.current.status).toBe("retrying");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        AGENTATION_CONFIRMATION_DELAYS_MS[0] + 1,
      );
    });

    expect(result.current.status).toBe("idle");
    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/v1/agentation/sessions/session-1",
      expect.not.objectContaining({ method: "POST" }),
    );
    expect(fetcher.mock.calls.every(([, options]) => !options?.body)).toBe(
      true,
    );
  });

  it("clears delivery state when the retained annotation is deleted or cleared", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(sessionResponse([]))),
    );
    const { result } = renderHook(() =>
      useAgentationDeliveryStatus({
        authorUserId: USER_ID,
        initialSessionId: SESSION_ID,
        scopeKey: "/reports/report-1:session-1",
      }),
    );
    const deleted = annotation("deleted", SESSION_ID);
    const cleared = annotation("cleared", SESSION_ID);

    act(() => result.current.onAnnotationAdd(deleted));
    await advanceConfirmationWindow();
    expect(result.current.unconfirmed).toBe(true);
    act(() => result.current.onAnnotationDelete(deleted));
    expect(result.current.status).toBe("idle");

    act(() => result.current.onAnnotationAdd(cleared));
    await advanceConfirmationWindow();
    expect(result.current.unconfirmed).toBe(true);
    act(() => result.current.onAnnotationsClear([cleared]));
    expect(result.current.status).toBe("idle");
  });

  it("cannot correlate callbacks that carry only an adopted server id", async () => {
    // Stock Agentation replaces the local id with the server id and does not
    // expose the original client id again, so a post-adoption delete or clear
    // callback cannot be matched back to the pending delivery candidate.
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json(sessionResponse([])));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() =>
      useAgentationDeliveryStatus({
        authorUserId: USER_ID,
        initialSessionId: SESSION_ID,
        scopeKey: "/reports/report-1:session-1",
      }),
    );

    act(() =>
      result.current.onAnnotationAdd(annotation("client-delete", SESSION_ID)),
    );
    await advanceConfirmationWindow();
    expect(result.current.unconfirmed).toBe(true);
    const fetchCountBeforeDelete = fetcher.mock.calls.length;
    act(() =>
      result.current.onAnnotationDelete(
        annotation("server-delete", SESSION_ID),
      ),
    );
    expect(result.current.unconfirmed).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(fetchCountBeforeDelete);

    act(() =>
      result.current.onAnnotationsClear([
        annotation("server-clear", SESSION_ID),
      ]),
    );
    expect(result.current.unconfirmed).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(fetchCountBeforeDelete);
  });

  it("keeps a newer delivery alert when an older server annotation is removed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(sessionResponse([]))),
    );
    const { result } = renderHook(() =>
      useAgentationDeliveryStatus({
        authorUserId: USER_ID,
        initialSessionId: SESSION_ID,
        scopeKey: "/reports/report-1:session-1",
      }),
    );

    act(() =>
      result.current.onAnnotationAdd(annotation("older-client", SESSION_ID)),
    );
    await advanceConfirmationWindow();
    act(() =>
      result.current.onAnnotationAdd(annotation("newer-client", SESSION_ID)),
    );

    act(() =>
      result.current.onAnnotationDelete(annotation("older-server", SESSION_ID)),
    );
    expect(result.current.status).toBe("checking");
    act(() =>
      result.current.onAnnotationsClear([
        annotation("older-server", SESSION_ID),
      ]),
    );
    expect(result.current.status).toBe("checking");

    await advanceConfirmationWindow();
    expect(result.current.status).toBe("unconfirmed");
  });

  it("rejects a matching client ID returned under a different session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          ...sessionResponse(["client-1"]),
          id: "wrong-session",
          annotations: sessionResponse(["client-1"]).annotations.map(
            (item) => ({ ...item, sessionId: "wrong-session" }),
          ),
        }),
      ),
    );
    const { result } = renderHook(() =>
      useAgentationDeliveryStatus({
        authorUserId: USER_ID,
        initialSessionId: SESSION_ID,
        scopeKey: "/reports/report-1:session-1",
      }),
    );

    act(() =>
      result.current.onAnnotationAdd(annotation("client-1", SESSION_ID)),
    );
    await advanceConfirmationWindow();

    expect(result.current.status).toBe("unconfirmed");
  });

  it("rejects a matching client ID persisted by a different author", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          ...sessionResponse(["client-1"]),
          annotations: sessionResponse(["client-1"]).annotations.map(
            (item) => ({ ...item, authorId: "other-user" }),
          ),
        }),
      ),
    );
    const { result } = renderHook(() =>
      useAgentationDeliveryStatus({
        authorUserId: USER_ID,
        initialSessionId: SESSION_ID,
        scopeKey: "/reports/report-1:session-1",
      }),
    );

    act(() =>
      result.current.onAnnotationAdd(annotation("client-1", SESSION_ID)),
    );
    await advanceConfirmationWindow();

    expect(result.current.status).toBe("unconfirmed");
  });

  it("rebinds confirmation to a replacement session announced after retry", async () => {
    const fetcher = vi
      .fn((_input: RequestInfo | URL, _init?: RequestInit) =>
        Promise.resolve(Response.json(sessionResponse(["original-client"]))),
      )
      .mockResolvedValueOnce(Response.json(sessionResponse([])))
      .mockResolvedValueOnce(Response.json(sessionResponse([])))
      .mockResolvedValueOnce(Response.json(sessionResponse([])))
      .mockResolvedValueOnce(
        Response.json({
          ...sessionResponse(["original-client"]),
          id: "replacement-session",
          annotations: sessionResponse(["original-client"]).annotations.map(
            (item) => ({ ...item, sessionId: "replacement-session" }),
          ),
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() =>
      useAgentationDeliveryStatus({
        authorUserId: USER_ID,
        initialSessionId: SESSION_ID,
        scopeKey: "/reports/report-1:session-1",
      }),
    );

    act(() =>
      result.current.onAnnotationAdd(annotation("original-client", SESSION_ID)),
    );
    await advanceConfirmationWindow();
    act(() => result.current.retry());
    expect(result.current.retrySessionId).toBe(SESSION_ID);
    act(() => result.current.onSessionCreated("replacement-session", 1));
    expect(result.current.status).toBe("retrying");
    expect(result.current.unconfirmed).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        AGENTATION_CONFIRMATION_DELAYS_MS[0] + 1,
      );
    });

    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/v1/agentation/sessions/replacement-session",
      expect.any(Object),
    );
    expect(result.current.status).toBe("idle");
  });

  it("ignores a late session callback from the native mount replaced by retry", async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(Response.json(sessionResponse([]))),
    );
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() =>
      useAgentationDeliveryStatus({
        authorUserId: USER_ID,
        initialSessionId: SESSION_ID,
        scopeKey: "/reports/report-1:session-1",
      }),
    );

    act(() =>
      result.current.onAnnotationAdd(annotation("original-client", SESSION_ID)),
    );
    await advanceConfirmationWindow();
    act(() => result.current.retry());
    act(() => result.current.onSessionCreated("stale-session", 0));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        AGENTATION_CONFIRMATION_DELAYS_MS[0] + 1,
      );
    });

    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/v1/agentation/sessions/session-1",
      expect.any(Object),
    );
  });

  it("cannot let an older observer clear a newer annotation error", async () => {
    let resolveOlder!: (response: Response) => void;
    const older = new Promise<Response>((resolve) => {
      resolveOlder = resolve;
    });
    const fetcher = vi
      .fn()
      .mockReturnValueOnce(older)
      .mockResolvedValue(Response.json(sessionResponse([])));
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() =>
      useAgentationDeliveryStatus({
        authorUserId: USER_ID,
        initialSessionId: SESSION_ID,
        scopeKey: "/reports/report-1:session-1",
      }),
    );

    act(() => result.current.onAnnotationAdd(annotation("older", SESSION_ID)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        AGENTATION_CONFIRMATION_DELAYS_MS[0] + 1,
      );
    });
    act(() => result.current.onAnnotationAdd(annotation("newer", SESSION_ID)));
    resolveOlder(Response.json(sessionResponse(["older"])));
    await advanceConfirmationWindow();

    expect(result.current.status).toBe("unconfirmed");
  });

  it("aborts the active confirmation when its page scope changes or unmounts", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options?: RequestInit) => {
        if (options?.signal) signals.push(options.signal);
        return new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(options.signal?.reason),
            { once: true },
          );
        });
      }),
    );
    const { result, rerender, unmount } = renderHook(
      ({ scopeKey }) =>
        useAgentationDeliveryStatus({
          authorUserId: USER_ID,
          initialSessionId: SESSION_ID,
          scopeKey,
        }),
      { initialProps: { scopeKey: "/reports/report-1:session-1" } },
    );

    act(() =>
      result.current.onAnnotationAdd(annotation("client-1", SESSION_ID)),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        AGENTATION_CONFIRMATION_DELAYS_MS[0] + 1,
      );
    });
    rerender({ scopeKey: "/reports/report-2:session-1" });
    expect(signals[0]?.aborted).toBe(true);

    act(() =>
      result.current.onAnnotationAdd(annotation("client-2", SESSION_ID)),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        AGENTATION_CONFIRMATION_DELAYS_MS[0] + 1,
      );
    });
    unmount();
    expect(signals.at(-1)?.aborted).toBe(true);
  });
});
