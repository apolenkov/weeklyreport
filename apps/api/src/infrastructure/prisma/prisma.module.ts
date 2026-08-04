import { Global, Module } from "@nestjs/common";

import { ConfigModule, ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema.js";
import { PrismaService } from "./prisma.service.js";

@Global()
@Module({
  imports: [ConfigModule],
  // Factory-provided: PrismaService takes `EnvConfig` as a constructor arg, so
  // the module builds it explicitly instead of relying on Nest parameter DI.
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
