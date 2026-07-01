/**
 * Minimal Mailpit HTTP API helper for integration tests.
 *
 * Mailpit exposes a REST API at http://localhost:8025/api/v1/messages.
 * `listMessages` is intentionally thin — no retry loop; call-sites that
 * need to wait for a message import `pollForMessage` instead.
 */

const MAILPIT_BASE = "http://localhost:8025";

/** Returns true if Mailpit is reachable (non-throwing GET within 2s). */
export async function isMailpitUp(): Promise<boolean> {
  try {
    const res = await fetch(`${MAILPIT_BASE}/api/v1/messages`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface MailpitAddress {
  Name: string;
  Address: string;
}

export interface MailpitMessage {
  ID: string;
  MessageID: string;
  Subject: string;
  From: MailpitAddress;
  To: MailpitAddress[];
  Cc: MailpitAddress[] | null;
  Snippet: string;
  Created: string;
}

export interface MailpitMessagesResponse {
  total: number;
  messages: MailpitMessage[];
}

/** Lists all messages currently stored in Mailpit. */
export async function listMessages(): Promise<MailpitMessage[]> {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/messages`);
  if (!res.ok) throw new Error(`Mailpit GET failed: ${res.status}`);
  const body = (await res.json()) as MailpitMessagesResponse;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- external Mailpit API response; messages may be absent despite the typed shape
  return body.messages ?? [];
}

/** Deletes all messages from Mailpit (purge the inbox). */
export async function clearMessages(): Promise<void> {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/messages`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Mailpit DELETE failed: ${res.status}`);
}

/**
 * Polls Mailpit until a message addressed to `recipientEmail` appears or
 * `timeoutMs` elapses. Returns the first matching message or null.
 */
export async function pollForMessage(
  recipientEmail: string,
  timeoutMs = 3000,
  intervalMs = 100,
): Promise<MailpitMessage | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const all = await listMessages();
    const match = all.find((m) =>
      m.To.some((addr) => addr.Address === recipientEmail),
    );
    if (match) return match;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}
