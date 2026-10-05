import type { Annotation } from "agentation";
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  abortableDelay,
  AGENTATION_CONFIRMATION_DELAYS_MS,
  sessionContainsClientIdWithinTimeout,
} from "./agentation-delivery-confirmation";

export {
  AGENTATION_CONFIRMATION_DELAYS_MS,
  AGENTATION_CONFIRMATION_TIMEOUT_MS,
} from "./agentation-delivery-confirmation";

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

type SetCandidate = Dispatch<SetStateAction<DeliveryCandidate | null>>;

function useCandidateConfirmation(
  candidate: DeliveryCandidate | null,
  scope: ScopeReference,
  setCandidate: SetCandidate,
) {
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
  }, [candidate, scope, setCandidate]);
}

function useAnnotationHandlers({
  scope,
  activeScopeRef,
  sessionRef,
  setCandidate,
}: {
  readonly scope: ScopeReference;
  readonly activeScopeRef: RefObject<ScopeReference>;
  readonly sessionRef: RefObject<SessionReference | null>;
  readonly setCandidate: SetCandidate;
}) {
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
    [scope, activeScopeRef, sessionRef, setCandidate],
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
    [scope, activeScopeRef, setCandidate],
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
    [scope, activeScopeRef, setCandidate],
  );
  return { onAnnotationAdd, onAnnotationDelete, onAnnotationsClear };
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

  const { onAnnotationAdd, onAnnotationDelete, onAnnotationsClear } =
    useAnnotationHandlers({ scope, activeScopeRef, sessionRef, setCandidate });

  useCandidateConfirmation(candidate, scope, setCandidate);

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
