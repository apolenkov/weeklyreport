// listMessages is thin (no retry); call-sites that wait use pollForMessage.
const MAILPIT_BASE = "http://localhost:8025";

/**
 * Is Mailpit Up.
 */
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

interface MailpitAddress {
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

interface MailpitMessagesResponse {
  total: number;
  messages: MailpitMessage[];
}

async function listMessages(): Promise<MailpitMessage[]> {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/messages`);
  if (!res.ok) throw new Error(`Mailpit GET failed: ${res.status}`);
  const body = (await res.json()) as MailpitMessagesResponse;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- external Mailpit API response; messages may be absent despite the typed shape
  return body.messages ?? [];
}

/**
 * Clear Messages.
 */
export async function clearMessages(): Promise<void> {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/messages`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Mailpit DELETE failed: ${res.status}`);
}

/**
 * Poll For Message.
 * @param recipientEmail - The recipientEmail argument.
 * @param timeoutMs - The timeoutMs argument.
 * @param intervalMs - The intervalMs argument.
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
