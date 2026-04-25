import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId = (req.headers['x-request-id'] as string) ?? randomUUID();
    req.headers['x-request-id'] = correlationId;
    res.setHeader('x-request-id', correlationId);
    // Write into the CLS store so any downstream code (logger, services)
    // can read the id without threading it through every call.
    this.cls.set('correlationId', correlationId);
    next();
  }
}
