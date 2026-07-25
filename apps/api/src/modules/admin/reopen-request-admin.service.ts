import type { UserSession } from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger";
import {
  AdminReopenRequestAlreadyProcessedError,
  type AdminRepository,
  type ReopenRequestStatusFilter,
} from "./admin-shared";
import {
  type AdminTelemetry,
  NOOP_ADMIN_TELEMETRY,
} from "./admin-telemetry.port.js";
import {
  type ReopenRequestListItem,
  toReopenRequestListItem,
} from "./period-admin.envelope.js";

export interface ListReopenRequestsArgs {
  status?: ReopenRequestStatusFilter;
  session: UserSession;
}

export interface RespondReopenRequestArgs {
  id: string;
  decision: "approved" | "rejected";
  note?: string;
  decidedBy: string;
  session: UserSession;
}

export interface RespondReopenRequestResult {
  success: true;
  decision: "approved" | "rejected";
  staleAutoClosed: boolean;
}

export class ReopenRequestAdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: AdminRepository,
    logger?: AppLogger,
    private readonly telemetry: AdminTelemetry = NOOP_ADMIN_TELEMETRY,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  // Head sees own group only; admin scope is global.
  async listReopenRequests(
    input: ListReopenRequestsArgs,
  ): Promise<ReopenRequestListItem[]> {
    const rows = await this.repository.listReopenRequests({
      status: input.status ?? "pending",
      session: input.session,
    });
    return rows.map(toReopenRequestListItem);
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
