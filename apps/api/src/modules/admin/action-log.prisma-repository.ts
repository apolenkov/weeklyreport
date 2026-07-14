import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { ActionLogRepository, ActionLogRow } from "./action-log.service";

@Injectable()
export class ActionLogPrismaRepository implements ActionLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  listActionLog(pagination: {
    limit: number;
    cursor?: string;
  }): Promise<ActionLogRow[]> {
    return this.prisma.userActionLog.findMany({
      take: pagination.limit,
      skip: pagination.cursor ? 1 : 0,
      cursor: pagination.cursor ? { id: pagination.cursor } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }
}
