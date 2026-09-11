// listMessages is thin (no retry); call-sites that wait use pollForMessage.
const MAILPIT_BASE = "http://localhost:8025";

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
  messages?: MailpitMessage[];
}

async function listMessages(signal: AbortSignal): Promise<MailpitMessage[]> {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/messages`, { signal });
  if (!res.ok) throw new Error(`Mailpit GET failed: ${res.status}`);
  const body = (await res.json()) as MailpitMessagesResponse;
  return body.messages ?? [];
}

export async function clearMessages(): Promise<void> {
  const res = await fetch(`${MAILPIT_BASE}/api/v1/messages`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Mailpit DELETE failed: ${res.status}`);
}

export async function pollForMessage(
  recipientEmail: string,
  timeoutMs = 3000,
  intervalMs = 100,
): Promise<MailpitMessage | null> {
  const deadline = Date.now() + timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    while (Date.now() < deadline) {
      const all = await listMessages(controller.signal);
      if (Date.now() >= deadline) return null;
      const match = all.find((m) =>
        m.To.some((addr) => addr.Address === recipientEmail),
      );
      if (match) return match;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(intervalMs, deadline - Date.now())),
      );
    }
    return null;
  } catch (error) {
    if (controller.signal.aborted) return null;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
