const BYTES_PER_KIB = 1024;
const MAX_BODY_KIB = 128;

// Matches the API's express.json limit; the byte form also protects the web hop.
export const CLIENT_LOGS_MAX_BODY_BYTES = MAX_BODY_KIB * BYTES_PER_KIB;
