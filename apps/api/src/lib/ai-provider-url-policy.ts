export class ProviderUrlPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUrlPolicyError";
  }
}

export const parseUrl = (value: string): URL => {
  try {
    const parsed = new URL(value);
    if (!/^https?:$/iu.test(parsed.protocol)) {
      throw new ProviderUrlPolicyError(
        "Provider endpoint must use HTTP or HTTPS",
      );
    }
    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      /[?#]/u.test(value)
    ) {
      throw new ProviderUrlPolicyError(
        "Provider endpoint must not contain credentials, a query, or a fragment",
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof ProviderUrlPolicyError) throw error;
    throw new ProviderUrlPolicyError("Provider endpoint must be a valid URL");
  }
};

export const allowedOrigins = (values: string): ReadonlySet<string> => {
  const origins = values
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const parsed = parseUrl(value);
      if (parsed.pathname !== "/")
        throw new ProviderUrlPolicyError(
          "Allowed provider entries must be exact origins",
        );
      return parsed.origin;
    });
  if (origins.length === 0)
    throw new ProviderUrlPolicyError("Provider origin allowlist is empty");
  return new Set(origins);
};
