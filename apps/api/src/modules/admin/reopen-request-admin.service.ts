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

/**
 * Reopen-request lifecycle surface (reopen-request-lifecycle, ADR 0008) —
 * reopen requests are period lifecycle, so this is a sibling of
 * `PeriodAdminService` in the `AdminService` facade's sub-service set
 * (kept in its own file/class rather than inlined into
 * `PeriodAdminService` to keep that file under the line budget).
 */
export class ReopenRequestAdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: AdminRepository,
    logger?: AppLogger,
    private readonly telemetry: AdminTelemetry = NOOP_ADMIN_TELEMETRY,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  /**
   * Group-scoped reopen-request list for the Admin Panel "Reopen Requests"
   * tab and the head dashboard card. A head sees only its own group's
   * requests; admin scope is global.
   */
  async listReopenRequests(
    input: ListReopenRequestsArgs,
  ): Promise<ReopenRequestListItem[]> {
    const rows = await this.repository.listReopenRequests({
      status: input.status ?? "pending",
      session: input.session,
    });
    return rows.map(toReopenRequestListItem);
  }

  /** Group-scoped pending-reopen count — same group scope as the list. */
  async pendingReopenCount(session: UserSession): Promise<{ count: number }> {
    const count = await this.repository.countPendingReopenRequests(session);
    return { count };
  }

  /**
   * Decide a reopen request (approve/reject). Race-safe against a second
   * decider (head + admin can both act) — see
   * `admin-reopen-request-lifecycle.ts` for the compare-and-set transaction.
   * Only a winning, real decision increments the funnel metric, AFTER the
   * transaction commits.
   */
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

    // Loser of a concurrent decision: changed nothing. A 409 CONFLICT is the
    // honest code (the request slipped out from under this call); no funnel
    // metric.
    if (outcome.kind === "already-processed") {
      throw new AdminReopenRequestAlreadyProcessedError("Already processed.");
    }
    // Stale auto-close: the request is now terminal and out of the pending
    // queue; report it without skewing the funnel.
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
