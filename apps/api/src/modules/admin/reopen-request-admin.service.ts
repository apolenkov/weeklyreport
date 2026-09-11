import type {
  ReopenRequestCursor,
  ReopenRequestListInput,
  UserSession,
} from "@customreport/shared";

import type { AppLogger } from "../../lib/logger";
import {
  AdminReopenRequestAlreadyProcessedError,
  type AdminRepository,
} from "./admin-shared";
import type { AdminTelemetry } from "./admin-telemetry.port.js";
import {
  type ReopenRequestListItem,
  toReopenRequestListItem,
} from "./reopen-request/envelope.js";

export type ListReopenRequestsArgs = ReopenRequestListInput & {
  readonly session: UserSession;
};

export interface ReopenRequestListPage {
  readonly items: ReopenRequestListItem[];
  readonly nextCursor: ReopenRequestCursor | null;
}

export interface RespondReopenRequestArgs {
  readonly id: string;
  readonly decision: "approved" | "rejected";
  readonly note?: string;
  readonly decidedBy: string;
  readonly session: UserSession;
}

export interface RespondReopenRequestResult {
  readonly success: true;
  readonly decision: "approved" | "rejected";
  readonly staleAutoClosed: boolean;
}

export class ReopenRequestAdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly logger: AppLogger,
    private readonly telemetry: AdminTelemetry,
  ) {}

  // Head sees own group only; admin scope is global.
  async listReopenRequests(
    input: ListReopenRequestsArgs,
  ): Promise<ReopenRequestListPage> {
    const rows = await this.repository.listReopenRequests(input);
    const pageRows = rows.slice(0, input.limit);
    const last = pageRows.at(-1);
    return {
      items: pageRows.map(toReopenRequestListItem),
      nextCursor:
        rows.length > input.limit && last
          ? { id: last.id, createdAt: last.createdAt.toISOString() }
          : null,
    };
  }

  async pendingReopenCount(session: UserSession): Promise<{ count: number }> {
    const count = await this.repository.countPendingReopenRequests(session);
    return { count };
  }

  // Race-safe CAS in admin-reopen-request-lifecycle; funnel metric only after
  // a real winning decision commits.
  async respondReopenRequest(
    input: RespondReopenRequestArgs,
  ): Promise<RespondReopenRequestResult> {
    const reviewNote = input.note?.trim() ? input.note.trim() : null;
    this.logger.info("deciding reopen request", {
      reopenRequestId: input.id,
      decision: input.decision,
    });
    const outcome = await this.repository.decideReopenRequest({
      id: input.id,
      decision: input.decision,
      reviewNote,
      decidedBy: input.decidedBy,
      session: input.session,
    });
    // Concurrent loser: 409, no funnel metric.
    if (outcome.kind === "already-processed") {
      throw new AdminReopenRequestAlreadyProcessedError("Already processed.");
    }
    // Stale auto-close: terminal, out of pending, no funnel skew.
    if (outcome.kind === "stale") {
      return { success: true, decision: "rejected", staleAutoClosed: true };
    }
    this.telemetry.recordReopenRequestDecision(outcome.decision);
    return {
      success: true,
      decision: outcome.decision,
      staleAutoClosed: false,
    };
  }
}
