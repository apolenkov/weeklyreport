import { Module } from "@nestjs/common";

import {
  ConfigModule,
  ENV_CONFIG,
} from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { AiProviderConfigurationRepository } from "./infrastructure/ai-provider.repository.js";
import { AesGcmCredentialCodec } from "./infrastructure/credential-codec.js";

@Module({
  imports: [ConfigModule],
  providers: [
    AiProviderConfigurationRepository,
    {
      provide: AesGcmCredentialCodec,
      useFactory: (env: EnvConfig) =>
        new AesGcmCredentialCodec(
          env.AI_PROVIDER_CONFIG_ENCRYPTION_KEY,
          env.AI_PROVIDER_CONFIG_KEY_VERSION,
        ),
      inject: [ENV_CONFIG],
    },
  ],
  exports: [AiProviderConfigurationRepository, AesGcmCredentialCodec],
})
export class AiProviderModule {}
