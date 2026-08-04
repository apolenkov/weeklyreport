import type { ClsService } from "nestjs-cls";

import {
  captureJobTraceContext,
  resolveCorrelationId,
} from "../../infrastructure/bullmq/worker-observability.js";
import type {
  ReminderJobContext,
  RemindersTelemetry,
} from "./reminders.ports.js";

export class RemindersInfrastructureTelemetry implements RemindersTelemetry {
  constructor(private readonly cls: ClsService | null) {}

  readonly captureJobContext = (): ReminderJobContext => {
    return captureJobTraceContext(resolveCorrelationId(this.cls));
  };
}
