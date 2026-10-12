import { agentationSessionResponseSchema } from "@weeklyreport/shared";

// Single owner for the Agentation REST base path; the widget's transport and
// the delivery readback must never diverge on it.
export const AGENTATION_ENDPOINT = "/api/v1/agentation";
const FIRST_CONFIRMATION_DELAY_MS = 400;
const SECOND_CONFIRMATION_DELAY_MS = 800;
const FINAL_CONFIRMATION_DELAY_MS = 1600;

export const AGENTATION_CONFIRMATION_DELAYS_MS = [
  FIRST_CONFIRMATION_DELAY_MS,
  SECOND_CONFIRMATION_DELAY_MS,
  FINAL_CONFIRMATION_DELAY_MS,
] as const;
export const AGENTATION_CONFIRMATION_TIMEOUT_MS = 1000;

export function abortableDelay(milliseconds: number, signal: AbortSignal) {
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

export async function sessionContainsClientIdWithinTimeout(
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
