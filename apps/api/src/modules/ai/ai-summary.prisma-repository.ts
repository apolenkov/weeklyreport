// Phase 54 (UFB-055): Prisma-backed AiSummaryRepository. Reads the
// report (period) by id and pulls the section bodies that the future
// RAG pipeline will need. The "text" field is a short condensation of
// every section's narrative content — the mock adapter ignores it, but
// having it on the read shape keeps the cutover to a real provider a
// pure adapter swap.

import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AiSummaryRepository } from "./ai-summary.service.js";

@Injectable()
export class AiSummaryPrismaRepository implements AiSummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSectionsForPeriod(periodId: string): Promise<null | Array<{
    sectionId: string;
    authorName: string;
    text: string;
  }>> {
    const report = await this.prisma.report.findUnique({
      where: { id: periodId },
      select: {
        id: true,
        sections: {
          select: {
            id: true,
            author: { select: { name: true } },
            // The text payload — small projection on purpose so the
            // future real adapter has *something* to ground, but the
            // cache row stays compact. Items / risks / decisions text
            // is what humans actually read; the mock ignores it.
            items: { select: { text: true } },
            risks: { select: { risk: true } },
            decisions: { select: { text: true } },
          },
          orderBy: { author: { name: "asc" } },
        },
      },
    });

    if (!report) return null;
    return report.sections.map((s) => ({
      sectionId: s.id,
      authorName: s.author?.name ?? "Unknown",
      text: [
        ...s.items.map((i) => i.text),
        ...s.risks.map((r) => r.risk),
        ...s.decisions.map((d) => d.text),
      ]
        .filter((line) => line && line.trim().length > 0)
        .join("\n"),
    }));
  }
}
