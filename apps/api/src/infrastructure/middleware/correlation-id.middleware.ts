import { randomUUID } from "node:crypto";

import { Inject, type NestMiddleware } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import { ClsService } from "nestjs-cls";

// A correlation id we are willing to echo back must be a bounded run of
// printable ASCII: anything with control chars, non-ASCII, or excessive length
// is attacker-controlled noise that could poison logs or response headers.
const VALID_REQUEST_ID = /^[\x20-\x7E]{1,128}$/;

// The CLS surface the middleware writes; ClsService is nominal (private `als`),
// so declaring the single consumed member lets tests inject `{ set }` without
// an erasing cast.
export interface CorrelationIdStore {
  set(key: string, value: unknown): void;
}

export interface CorrelationRequest {
  readonly headers: Request["headers"];
}

export interface CorrelationResponse {
  setHeader(name: string, value: string): unknown;
}

export type CorrelationNext = () => void;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(@Inject(ClsService) private readonly cls: CorrelationIdStore) {}

  use(
    req: CorrelationRequest,
    res: CorrelationResponse,
    next: CorrelationNext,
  ): void {
    const header = req.headers["x-request-id"];
    const inbound = typeof header === "string" ? header : undefined;
    const correlationId =
      inbound !== undefined && VALID_REQUEST_ID.test(inbound)
        ? inbound
        : randomUUID();
    req.headers["x-request-id"] = correlationId;
    res.setHeader("x-request-id", correlationId);
    // Write into the CLS store so any downstream code (logger, services)
    // can read the id without threading it through every call.
    this.cls.set("correlationId", correlationId);
    next();
  }
}
