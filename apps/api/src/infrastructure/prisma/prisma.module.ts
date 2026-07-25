import { Global, Module } from "@nestjs/common";

import { ConfigModule, ENV_CONFIG } from "../config/config.module.js";
import type { EnvConfig } from "../config/env.schema.js";
import { PrismaService } from "./prisma.service.js";

@Global()
@Module({
  imports: [ConfigModule],
  // Factory-provided: ES decorators reject parameter decorators (TS1206) when
  // the web tsconfig type-checks PrismaService through the tRPC AppRouter graph.
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
