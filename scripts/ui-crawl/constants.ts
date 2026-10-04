export const MS_PER_SECOND = 1000;
export const QUIET_MS = 100;
export const BATCH_BUDGET_MS = 10_000;
export const MAX_QUIET_MS = 6000;
export const SLOW_MS = 1500;
export const SLOW_LOAD_MS = 3000;
export const REPEAT_LIMIT = 2;
export const DEFAULT_HEIGHT = 800;
export const MOBILE_WIDTH = 375;
export const MOBILE_HEIGHT = 812;
export const P95 = 0.95;
export const STAMP_LENGTH = 19;
export const CLI_TIMEOUT_MS = 30_000;
export const MAX_BUFFER_BYTES = 16_777_216;
export const DETAIL_LIMIT = 300;
export const SERVER_ERROR = 500;
export const SHOT_INDEX_WIDTH = 3;
export const TOO_MANY_REQUESTS = 429;
export const LOGIN_ATTEMPTS = 4;
export const LOGIN_BACKOFF_MS = 30_000;
export const READ_COMMANDS = 3;
/** Expected tRPC requests of a page load, a press batch and a repeated press, for pacing. */
export const PAGE_LOAD_COST = 3;
export const BATCH_COST = 3;
export const REPRESS_COST = 1;
/** Requests per minute the crawl allows itself, out of the stand's 200. */
export const TRPC_BUDGET = 150;
/** /auth requests per minute (the stand allows 5) and per sign-in (login plus callback). */
export const AUTH_BUDGET = 5;
export const AUTH_COST = 2;
export const STALL_MS = 5000;
/** How long DOM changes alone may keep a press from counting as finished, after the last request. */
export const DOM_GRACE_MS = 400;
export const VISIT_ATTEMPTS = 2;
/** Leading characters of a control's name that must match before it is pressed again. */
export const REPRESS_NAME_CHARS = 20;
export const SECONDS_PER_MINUTE = 60;
/** How long a page that is still returning to its parent state is waited for before a control counts as gone. */
export const RETURN_WAIT_MS = 3000;
/** Default press budget per page in --full mode; a page that reaches it is reported as limited. */
export const FULL_MAX_CONTROLS = 200;
