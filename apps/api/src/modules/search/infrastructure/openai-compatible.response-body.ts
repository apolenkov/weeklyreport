const KIBIBYTE_BYTES = 1024;

export const MAX_PROVIDER_RESPONSE_BYTES = 2 * KIBIBYTE_BYTES * KIBIBYTE_BYTES;

export class ProviderResponseTooLargeError extends Error {
  constructor() {
    super("OpenAI-compatible provider response exceeds the configured limit");
    this.name = "ProviderResponseTooLargeError";
  }
}

type BoundedChunks = Readonly<{
  chunks: readonly Uint8Array[];
  totalBytes: number;
}>;

const readBoundedChunks = async (
  body: ReadableStream<Uint8Array>,
): Promise<BoundedChunks> => {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  // eslint-disable-next-line no-restricted-syntax -- streaming byte total is the response-size boundary
  let totalBytes = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) return { chunks, totalBytes };
      const nextTotal = totalBytes + result.value.byteLength;
      if (nextTotal > MAX_PROVIDER_RESPONSE_BYTES) {
        throw new ProviderResponseTooLargeError();
      }
      chunks.push(result.value);
      totalBytes = nextTotal;
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
};

const decodeJson = ({ chunks, totalBytes }: BoundedChunks): unknown => {
  const bytes = new Uint8Array(totalBytes);
  chunks.reduce((offset, chunk) => {
    bytes.set(chunk, offset);
    return offset + chunk.byteLength;
  }, 0);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
};

export const readProviderResponseBody = async (
  response: Response,
): Promise<unknown> => {
  const declaredLength = Number.parseInt(
    response.headers.get("content-length") ?? "",
    10,
  );
  if (
    Number.isSafeInteger(declaredLength) &&
    declaredLength > MAX_PROVIDER_RESPONSE_BYTES
  ) {
    await response.body?.cancel().catch(() => undefined);
    throw new ProviderResponseTooLargeError();
  }
  return response.body
    ? decodeJson(await readBoundedChunks(response.body))
    : undefined;
};
