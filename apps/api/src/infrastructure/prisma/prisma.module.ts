import { Global, Module } from "@nestjs/common";

import { ConfigModule, ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema.js";
import { PrismaService } from "./prisma.service.js";

@Global()
@Module({
  imports: [ConfigModule],
  // PrismaService is factory-provided (not a constructor @Inject parameter)
  // because the web tsconfig type-checks PrismaService through the tRPC
  // AppRouter type graph under ES decorators, which reject parameter decorators
  // (TS1206). The factory injects the validated EnvConfig without one.
  providers: [
    {
      provide: PrismaService,
      useFactory: (env: EnvConfig) => new PrismaService(env),
      inject: [ENV_CONFIG],
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
