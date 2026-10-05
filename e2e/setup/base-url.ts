const DEFAULT_E2E_BASE_URL = "http://localhost:3000";

/**
 * Parse the web origin the browser regression drives. Unset keeps the local
 * source run; anything but a plain http(s) origin fails closed.
 */
export function parseE2eBaseUrl(
  raw: string | undefined = process.env.E2E_BASE_URL,
): string {
  const value = raw === undefined || raw === "" ? DEFAULT_E2E_BASE_URL : raw;
  const url = URL.parse(value);
  if (
    url === null ||
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    `${url.origin}/` !== url.href
  ) {
    throw new Error(
      `[e2e-base-url] E2E_BASE_URL must be a bare http(s) origin: ${value}`,
    );
  }
  return url.origin;
}

export const E2E_BASE_URL = parseE2eBaseUrl();
