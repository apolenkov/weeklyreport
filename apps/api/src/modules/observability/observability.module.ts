import { Module } from "@nestjs/common";

import { WebVitalsController } from "./web-vitals.controller.js";

@Module({ controllers: [WebVitalsController] })
export class ObservabilityModule {}
