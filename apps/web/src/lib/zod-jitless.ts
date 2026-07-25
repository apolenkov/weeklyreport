import { config as configureZod } from "zod/v4/core";

/**
 * Side-effect module: must be imported before anything that parses a zod
 * schema, which is why it is a bare import at the very top of
 * `instrumentation-client.ts` rather than a call inside it — ES imports are
 * hoisted, so a statement in that file would run after `web-env` had already
 * parsed at module scope and triggered the probe.
 *
 * The browser runs jitless regardless: zod's JIT probe is `Function("")`, which
 * the production Content-Security-Policy blocks (no 'unsafe-eval'). Left to the
 * probe, every page load emits a violation report and the fallback looks
 * accidental. Declaring it keeps the behaviour identical and the reports clean.
 */
configureZod({ jitless: true });
