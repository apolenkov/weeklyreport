import { agentationSessionResponseSchema } from "@customreport/shared";
import type { Annotation } from "agentation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const AGENTATION_ENDPOINT = "/api/v1/agentation";
const FIRST_CONFIRMATION_DELAY_MS = 400;
const SECOND_CONFIRMATION_DELAY_MS = 800;
const FINAL_CONFIRMATION_DELAY_MS = 1600;

export const AGENTATION_CONFIRMATION_DELAYS_MS = [
  FIRST_CONFIRMATION_DELAY_MS,
  SECOND_CONFIRMATION_DELAY_MS,
  FINAL_CONFIRMATION_DELAY_MS,
] as const;
export const AGENTATION_CONFIRMATION_TIMEOUT_MS = 1000;

interface ScopeReference {
  readonly authorUserId: string | null;
  readonly initialSessionId: string | null;
  readonly key: string;
}

interface DeliveryCandidate {
  readonly annotation: Annotation;
  readonly clientId: string;
  readonly scope: ScopeReference;
  readonly sessionId?: string;
  readonly state: "checking" | "retrying" | "unconfirmed";
}

interface SessionReference {
  readonly id: string;
  readonly scope: ScopeReference;
}

interface UseAgentationDeliveryStatusOptions {
  readonly authorUserId: string | null;
  readonly initialSessionId: string | null;
  readonly scopeKey: string;
}

function annotationMatchesClientId(annotation: Annotation, clientId: string) {
  return annotation.id === clientId;
}

function abortableDelay(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const timeout = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function sessionContainsClientId(
  sessionId: string,
  clientId: string,
  authorUserId: string,
  signal: AbortSignal,
) {
  const response = await fetch(
    `${AGENTATION_ENDPOINT}/sessions/${encodeURIComponent(sessionId)}`,
    {
      cache: "no-store",
      credentials: "include",
      headers: { accept: "application/json" },
      signal,
    },
  );
  if (!response.ok) return false;

  const parsed = agentationSessionResponseSchema.safeParse(
    await response.json(),
  );
  return (
    parsed.success &&
    parsed.data.id === sessionId &&
    (parsed.data.annotations ?? []).some(
      (annotation) =>
        annotation.sessionId === sessionId &&
        annotation.clientId === clientId &&
        annotation.authorId === authorUserId,
    )
  );
}

async function sessionContainsClientIdWithinTimeout(
  sessionId: string,
  clientId: string,
  authorUserId: string,
  parentSignal: AbortSignal,
) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parentSignal.reason);
  if (parentSignal.aborted) abortFromParent();
  else parentSignal.addEventListener("abort", abortFromParent, { once: true });
  const timeout = window.setTimeout(
    () =>
      controller.abort(
        new DOMException("Confirmation timed out", "TimeoutError"),
      ),
    AGENTATION_CONFIRMATION_TIMEOUT_MS,
  );

  try {
    return await sessionContainsClientId(
      sessionId,
      clientId,
      authorUserId,
      controller.signal,
    );
  } finally {
    window.clearTimeout(timeout);
    parentSignal.removeEventListener("abort", abortFromParent);
  }
}

export function useAgentationDeliveryStatus({
  authorUserId,
  initialSessionId,
  scopeKey,
}: UseAgentationDeliveryStatusOptions) {
  const scope = useMemo(
    () => ({ authorUserId, initialSessionId, key: scopeKey }),
    [authorUserId, initialSessionId, scopeKey],
  );
  const [candidate, setCandidate] = useState<DeliveryCandidate | null>(null);
  const [retryRevision, setRetryRevision] = useState(0);
  const retryRevisionRef = useRef(0);
  const [retrySession, setRetrySession] = useState<SessionReference | null>(
    null,
  );
  const activeScopeRef = useRef(scope);
  const sessionRef = useRef<SessionReference | null>(
    initialSessionId ? { id: initialSessionId, scope } : null,
  );

  useEffect(() => {
    activeScopeRef.current = scope;
    sessionRef.current = initialSessionId
      ? { id: initialSessionId, scope }
      : null;
  }, [initialSessionId, scope]);

  const onSessionCreated = useCallback(
    (sessionId: string, mountRevision: number) => {
      if (
        activeScopeRef.current !== scope ||
        mountRevision !== retryRevisionRef.current
      )
        return;
      sessionRef.current = { id: sessionId, scope };
      setCandidate((current) => {
        if (current?.scope !== scope || current.sessionId === sessionId)
          return current;
        return {
          ...current,
          sessionId,
          state: current.state === "checking" ? "checking" : "retrying",
        };
      });
    },
    [scope],
  );

  const onAnnotationAdd = useCallback(
    (annotation: Annotation) => {
      if (activeScopeRef.current !== scope) return;
      const knownSession = sessionRef.current;
      const sessionId =
        annotation.sessionId ??
        (knownSession?.scope === scope
          ? knownSession.id
          : (scope.initialSessionId ?? undefined));
      setCandidate({
        annotation,
        clientId: annotation.id,
        scope,
        ...(sessionId ? { sessionId } : {}),
        state: "checking",
      });
    },
    [scope],
  );

  const onAnnotationDelete = useCallback(
    (annotation: Annotation) => {
      if (activeScopeRef.current !== scope) return;
      setCandidate((current) =>
        current?.scope === scope &&
        annotationMatchesClientId(annotation, current.clientId)
          ? null
          : current,
      );
    },
    [scope],
  );

  const onAnnotationsClear = useCallback(
    (annotations: Annotation[]) => {
      if (activeScopeRef.current !== scope) return;
      setCandidate((current) =>
        current?.scope === scope &&
        annotations.some((annotation) =>
          annotationMatchesClientId(annotation, current.clientId),
        )
          ? null
          : current,
      );
    },
    [scope],
  );

  useEffect(() => {
    if (
      (candidate?.state !== "checking" && candidate?.state !== "retrying") ||
      candidate.scope !== scope
    )
      return;

    const controller = new AbortController();
    const expectedCandidate = candidate;

    void (async () => {
      for (const delay of AGENTATION_CONFIRMATION_DELAYS_MS) {
        try {
          await abortableDelay(delay, controller.signal);
          controller.signal.throwIfAborted();
          if (
            expectedCandidate.sessionId &&
            expectedCandidate.scope.authorUserId &&
            (await sessionContainsClientIdWithinTimeout(
              expectedCandidate.sessionId,
              expectedCandidate.clientId,
              expectedCandidate.scope.authorUserId,
              controller.signal,
            ))
          ) {
            setCandidate((current) =>
              current === expectedCandidate ? null : current,
            );
            return;
          }
        } catch {
          if (controller.signal.aborted) return;
        }
      }

      setCandidate((current) =>
        current === expectedCandidate
          ? { ...current, state: "unconfirmed" }
          : current,
      );
    })();

    return () => controller.abort();
  }, [candidate, scope]);

  const retry = useCallback(() => {
    if (candidate?.scope !== scope || !candidate.sessionId) return;

    setRetrySession({ id: candidate.sessionId, scope });
    setCandidate({
      ...candidate,
      state: "retrying",
    });
    retryRevisionRef.current += 1;
    setRetryRevision(retryRevisionRef.current);
  }, [candidate, scope]);

  return {
    canRetry:
      candidate?.scope === scope &&
      candidate.state === "unconfirmed" &&
      Boolean(candidate.sessionId),
    onAnnotationAdd,
    onAnnotationDelete,
    onAnnotationsClear,
    onSessionCreated,
    retry,
    retryRevision,
    retrySessionId: retrySession?.scope === scope ? retrySession.id : null,
    retrying: candidate?.scope === scope && candidate.state === "retrying",
    status: candidate?.scope === scope ? candidate.state : ("idle" as const),
    unconfirmed:
      candidate?.scope === scope &&
      (candidate.state === "unconfirmed" || candidate.state === "retrying"),
  };
}
