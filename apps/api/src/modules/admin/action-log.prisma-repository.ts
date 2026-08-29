import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { ActionLogRepository, ActionLogRow } from "./action-log.service";
@Injectable()
export class ActionLogPrismaRepository implements ActionLogRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  readonly listActionLog = (pagination: {
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<ActionLogRow[]> => {
    return this.prisma.userActionLog.findMany({
      take: pagination.limit,
      skip: pagination.cursor ? 1 : 0,
      ...(pagination.cursor ? { cursor: { id: pagination.cursor } } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        createdAt: true,
        userId: true,
        role: true,
        procedure: true,
        targetId: true,
        status: true,
        reason: true,
        ip: true,
        correlationId: true,
        durationMs: true,
      },
    });
  };
}
