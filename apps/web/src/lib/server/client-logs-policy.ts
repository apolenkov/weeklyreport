// Matches the API's express.json limit; the byte form also protects the web hop.
// eslint-disable-next-line @typescript-eslint/no-magic-numbers -- protocol limit expressed in kibibytes
export const CLIENT_LOGS_MAX_BODY_BYTES = 128 * 1024;
