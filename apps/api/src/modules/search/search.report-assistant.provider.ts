import type { Provider } from "@nestjs/common";

import { ReportAssistantService } from "./application/report-assistant.service.js";

export const reportAssistantProvider: Provider = {
  provide: ReportAssistantService,
  useClass: ReportAssistantService,
};
