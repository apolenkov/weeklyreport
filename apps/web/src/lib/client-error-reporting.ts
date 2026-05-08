'use client';

export type ClientErrorContext = Readonly<Record<string, unknown>>;

export type ClientErrorLogEntry = Readonly<{
  event: string;
  message: string;
  name: string | null;
  context: ClientErrorContext;
}>;

export function buildClientErrorLogEntry(
  event: string,
  error: unknown,
  context: ClientErrorContext = {},
): ClientErrorLogEntry {
  if (error instanceof Error) {
    return {
      event,
      message: error.message,
      name: error.name,
      context,
    };
  }

  return {
    event,
    message: typeof error === 'string' ? error : String(error),
    name: null,
    context,
  };
}

export function logClientError(
  event: string,
  error: unknown,
  context: ClientErrorContext = {},
): void {
  const entry = buildClientErrorLogEntry(event, error, context);
  if (error instanceof Error) {
    console.error(`[${event}] ${entry.message}`, error, entry.context);
    return;
  }
  console.error(`[${event}] ${entry.message}`, entry.context);
}
