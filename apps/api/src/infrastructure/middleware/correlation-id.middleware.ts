import { randomUUID } from "node:crypto";

import type { NestMiddleware } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { ClsService } from "nestjs-cls";

// A correlation id we are willing to echo back must be a bounded run of
// printable ASCII: anything with control chars, non-ASCII, or excessive length
// is attacker-controlled noise that could poison logs or response headers.
const VALID_REQUEST_ID = /^[\x20-\x7E]{1,128}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.headers["x-request-id"] as string | undefined;
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
