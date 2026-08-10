import { config as configureZod } from "zod/v4/core";

// Import before schema parsing: CSP blocks Zod's Function probe, so declaring
// jitless avoids a violation report while preserving browser behavior.
configureZod({ jitless: true });
