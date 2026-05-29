// Phase 31 (AI-SPEC §5): the AI module's only Prisma seam. ESLint rules
// added in 31-04 forbid raw @prisma/client imports anywhere else in
// modules/ai/**. This file (and ai-cache.ts) are the whitelisted facade
// boundary.
import { Injectable } from "@nestjs/common";
import { type AiInsightKind, Prisma, type PrismaClient } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

import type { AnthropicUsage } from "./ai-client.js";

export type CondensedSection = {
  authorName: string;
  trafficLights: ReadonlyArray<{
    projectName: string;
    status: "green" | "yellow" | "red";
  }>;
  riskCount: number;
  decisionCount: number;
  itemCount: number;
};

export type ReportForSummary = {
  reportId: string;
  periodLabel: string;
  sectionCount: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  sections: ReadonlyArray<CondensedSection>;
};

export type RiskForSentiment = {
  riskId: string;
  // Phase 32-A1 (C-01): the reportId derived from the risk's section.
  // Required so the budget guard scopes per-report rather than globally.
  reportId: string;
  risk: string;
  impact: string;
  mitigation: string;
};

export type CellForOnTrack = {
  sectionId: string;
  // Phase 32-A1 (C-01): the reportId of the section. Required so the
  // budget guard scopes per-report rather than globally.
  reportId: string;
  projectId: string;
  leadName: string;
  projectName: string;
  leadColour: "green" | "yellow" | "red";
  currentItemCount: number;
  completedCount: number;
  blockedCount: number;
  riskCount: number;
  decisionCount: number;
  currentWeekText: string;
  nextWeekText: string;
  riskHighlights: string;
};

export type AiInsightUpsertInput<R> = {
  kind: AiInsightKind;
  contentHash: string;
  // Phase 32-A1 (C-01): scope insights by reportId so budget guard can
  // sum tokens per-report. Optional to keep the type flexible for callers
  // that haven't yet derived a reportId, but every facade write path now
  // sets it.
  reportId?: string | null;
  result: R;
  modelId: string;
  usage: AnthropicUsage;
};

export type AiInsightRow<R> = {
  id: string;
  kind: AiInsightKind;
  contentHash: string;
  reportId: string | null;
  result: R;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  createdAt: Date;
};

/**
 * AiFacade — minimal Prisma-shaped contract for the AI module. Concrete
 * NestJS implementation below; tests inject an in-memory fake.
 */
export interface AiFacade {
  getReportForSummary(reportId: string): Promise<ReportForSummary | null>;
  getRiskForSentiment(riskId: string): Promise<RiskForSentiment | null>;
  getCellForOnTrack(
    sectionId: string,
    projectId: string,
  ): Promise<CellForOnTrack | null>;
  getAiInsight<R>(
    kind: AiInsightKind,
    contentHash: string,
  ): Promise<AiInsightRow<R> | null>;
  upsertAiInsight<R>(input: AiInsightUpsertInput<R>): Promise<AiInsightRow<R>>;
  deleteAiInsight(kind: AiInsightKind, contentHash: string): Promise<void>;
  /**
   * Phase 32-A1 (C-01): sum input+output tokens across all AiInsight rows
   * scoped to a given reportId within the last hour. Used by all 3 AI
   * features (summary, sentiment, on-track) to enforce the per-report
   * budget cap before calling Anthropic.
   */
  getRecentInsightTokenSum(reportId: string): Promise<number>;
}

@Injectable()
export class AiPrismaFacade implements AiFacade {
  private readonly prisma: PrismaClient;
  constructor(prismaService: PrismaService) {
    this.prisma = prismaService;
  }

  async getReportForSummary(
    reportId: string,
  ): Promise<ReportForSummary | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        sections: {
          include: {
            author: { select: { name: true } },
            projectStatuses: {
              include: { project: { select: { name: true } } },
            },
            risks: { select: { id: true } },
            decisions: { select: { id: true } },
            items: { select: { id: true } },
          },
        },
      },
    });
    if (!report) return null;

    let g = 0;
    let y = 0;
    let r = 0;
    const sections: CondensedSection[] = [];
    for (const s of report.sections) {
      const lights: CondensedSection["trafficLights"] = s.projectStatuses.map(
        (ps) => ({
          projectName: ps.project.name,
          status: ps.status as "green" | "yellow" | "red",
        }),
      );
      for (const l of lights) {
        if (l.status === "green") g += 1;
        else if (l.status === "yellow") y += 1;
        else if (l.status === "red") r += 1;
      }
      sections.push({
        authorName: s.author.name,
        trafficLights: lights,
        riskCount: s.risks.length,
        decisionCount: s.decisions.length,
        itemCount: s.items.length,
      });
    }

    const periodLabel =
      report.weekLabel ?? `${report.periodStart.toISOString().slice(0, 10)}`;
    return {
      reportId: report.id,
      periodLabel,
      sectionCount: report.sections.length,
      greenCount: g,
      yellowCount: y,
      redCount: r,
      sections,
    };
  }

  async getRiskForSentiment(riskId: string): Promise<RiskForSentiment | null> {
    // Phase 32-A1 (C-01): include the section so we can derive reportId.
    // The extra column read is acceptable; alternative would be a separate
    // query for the section's reportId.
    const risk = await this.prisma.risk.findUnique({
      where: { id: riskId },
      include: { reportSection: { select: { reportId: true } } },
    });
    if (!risk) return null;
    return {
      riskId: risk.id,
      reportId: risk.reportSection.reportId,
      risk: risk.risk,
      impact: risk.impact,
      mitigation: risk.mitigation,
    };
  }

  async getCellForOnTrack(
    sectionId: string,
    projectId: string,
  ): Promise<CellForOnTrack | null> {
    const section = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      include: {
        author: { select: { name: true } },
        projectStatuses: {
          where: { projectId },
          include: { project: { select: { name: true } } },
        },
        items: { where: { projectId } },
        risks: { where: { projectId } },
        decisions: { select: { id: true } },
      },
    });
    if (!section) return null;
    const ps = section.projectStatuses[0];
    if (!ps) return null;
    const currentItems = section.items.filter((i) => i.type === "current");
    const completed = currentItems.filter((i) => i.completed === true);
    const blocked = currentItems.filter((i) => i.workflowStatus === "blocked");
    const currentWeekText = currentItems.map((i) => i.text).join("\n");
    const nextWeekText = section.items
      .filter((i) => i.type === "next")
      .map((i) => i.text)
      .join("\n");
    const riskHighlights = section.risks
      .map((rk) => `- ${rk.risk} (impact: ${rk.impact})`)
      .join("\n");

    return {
      sectionId: section.id,
      reportId: section.reportId,
      projectId,
      leadName: section.author.name,
      projectName: ps.project.name,
      leadColour: ps.status as "green" | "yellow" | "red",
      currentItemCount: currentItems.length,
      completedCount: completed.length,
      blockedCount: blocked.length,
      riskCount: section.risks.length,
      decisionCount: section.decisions.length,
      currentWeekText,
      nextWeekText,
      riskHighlights,
    };
  }

  async getAiInsight<R>(
    kind: AiInsightKind,
    contentHash: string,
  ): Promise<AiInsightRow<R> | null> {
    const row = await this.prisma.aiInsight.findUnique({
      where: { kind_contentHash: { kind, contentHash } },
    });
    if (!row) return null;
    return row as unknown as AiInsightRow<R>;
  }

  async upsertAiInsight<R>(
    input: AiInsightUpsertInput<R>,
  ): Promise<AiInsightRow<R>> {
    const reportId = input.reportId ?? null;
    const row = await this.prisma.aiInsight.upsert({
      where: {
        kind_contentHash: { kind: input.kind, contentHash: input.contentHash },
      },
      update: {
        reportId,
        result: input.result as Prisma.InputJsonValue,
        modelId: input.modelId,
        inputTokens: input.usage.inputTokens,
        outputTokens: input.usage.outputTokens,
        cacheCreationTokens: input.usage.cacheCreationTokens,
        cacheReadTokens: input.usage.cacheReadTokens,
      },
      create: {
        kind: input.kind,
        contentHash: input.contentHash,
        reportId,
        result: input.result as Prisma.InputJsonValue,
        modelId: input.modelId,
        inputTokens: input.usage.inputTokens,
        outputTokens: input.usage.outputTokens,
        cacheCreationTokens: input.usage.cacheCreationTokens,
        cacheReadTokens: input.usage.cacheReadTokens,
      },
    });
    return row as unknown as AiInsightRow<R>;
  }

  async deleteAiInsight(
    kind: AiInsightKind,
    contentHash: string,
  ): Promise<void> {
    await this.prisma.aiInsight
      .delete({ where: { kind_contentHash: { kind, contentHash } } })
      .catch(() => undefined);
  }

  async getRecentInsightTokenSum(reportId: string): Promise<number> {
    if (!reportId) return 0;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const rows = await this.prisma.aiInsight.findMany({
      where: {
        reportId,
        createdAt: { gte: oneHourAgo },
      },
      select: { inputTokens: true, outputTokens: true },
    });
    return rows.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0);
  }
}
