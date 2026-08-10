import { createRequire } from "node:module";

import type {
  FaultDeclaration,
  FaultExpectation,
  FaultResponse,
  InjectableFaultMode,
} from "./fault-injection.ts";

type SuperJsonModule =
  typeof import("../../../../apps/api/node_modules/superjson/dist/index.js");

const productionRequire = createRequire(
  new URL("../../../../apps/api/package.json", import.meta.url),
);
const superjson = productionRequire("superjson") as SuperJsonModule;

export const INJECTABLE_FAULT_MODES = [
  "auth-missing",
  "auth-expired",
  "auth-forbidden",
  "network-timeout",
  "request-aborted",
  "http-4xx",
  "http-5xx",
] as const satisfies readonly InjectableFaultMode[];

const PUBLISH_URL = /\/trpc\/period\.publish(?:[/?]|$)/u;
const JSON_HEADERS = Object.freeze({ "content-type": "application/json" });
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_UNPROCESSABLE_CONTENT = 422;
const HTTP_SERVICE_UNAVAILABLE = 503;
const RPC_UNAUTHORIZED = -32_001;
const RPC_FORBIDDEN = -32_003;
const RPC_UNPROCESSABLE_CONTENT = -32_022;
const RPC_INTERNAL_SERVER_ERROR = -32_603;

const expectation = (
  userVisibleMessage: string,
  recovery: FaultExpectation["recovery"],
): FaultExpectation =>
  Object.freeze({
    userVisibleMessage,
    statusRole: "alert",
    recovery,
    persistedState: "unchanged",
  });

const trpcErrorBody = (message: string, code: number): string =>
  JSON.stringify([{ error: superjson.serialize({ code, message }) }]);

const response = (
  status: number,
  message: string,
  code: number,
): FaultResponse =>
  Object.freeze({
    status,
    body: trpcErrorBody(message, code),
    headers: JSON_HEADERS,
  });

const httpDeclaration = (
  id: string,
  mode: Extract<
    InjectableFaultMode,
    "auth-missing" | "auth-expired" | "auth-forbidden" | "http-4xx" | "http-5xx"
  >,
  status: number,
  message: string,
  code: number,
  recovery: FaultExpectation["recovery"],
): FaultDeclaration =>
  Object.freeze({
    id,
    mode,
    urlPattern: PUBLISH_URL,
    operation: "period.publish",
    expectation: expectation(message, recovery),
    response: response(status, message, code),
    abortCode: null,
  });

const abortedDeclaration = (
  id: string,
  mode: Extract<InjectableFaultMode, "network-timeout" | "request-aborted">,
  abortCode: "timedout" | "aborted",
  recovery: FaultExpectation["recovery"],
): FaultDeclaration =>
  Object.freeze({
    id,
    mode,
    urlPattern: PUBLISH_URL,
    operation: "period.publish",
    expectation: expectation("Failed to publish period", recovery),
    response: null,
    abortCode,
  });

export const FAULT_DECLARATIONS = Object.freeze([
  httpDeclaration(
    "publish-auth-missing",
    "auth-missing",
    HTTP_UNAUTHORIZED,
    "Not authenticated",
    RPC_UNAUTHORIZED,
    "reauthenticate",
  ),
  httpDeclaration(
    "publish-auth-expired",
    "auth-expired",
    HTTP_UNAUTHORIZED,
    "Session expired",
    RPC_UNAUTHORIZED,
    "reauthenticate",
  ),
  httpDeclaration(
    "publish-auth-forbidden",
    "auth-forbidden",
    HTTP_FORBIDDEN,
    "Forbidden",
    RPC_FORBIDDEN,
    "none",
  ),
  abortedDeclaration(
    "publish-network-timeout",
    "network-timeout",
    "timedout",
    "retry",
  ),
  abortedDeclaration(
    "publish-request-aborted",
    "request-aborted",
    "aborted",
    "reload",
  ),
  httpDeclaration(
    "publish-http-4xx",
    "http-4xx",
    HTTP_UNPROCESSABLE_CONTENT,
    "Request rejected",
    RPC_UNPROCESSABLE_CONTENT,
    "none",
  ),
  httpDeclaration(
    "publish-http-5xx",
    "http-5xx",
    HTTP_SERVICE_UNAVAILABLE,
    "Service unavailable",
    RPC_INTERNAL_SERVER_ERROR,
    "retry",
  ),
] satisfies readonly FaultDeclaration[]);

class FaultDeclarationError extends Error {
  override readonly name = "FaultDeclarationError";
}

export function faultDeclarationFor(
  mode: InjectableFaultMode,
): FaultDeclaration {
  const declaration = FAULT_DECLARATIONS.find(
    (candidate) => candidate.mode === mode,
  );
  if (declaration === undefined)
    throw new FaultDeclarationError(`No declaration exists for ${mode}`);
  return declaration;
}
