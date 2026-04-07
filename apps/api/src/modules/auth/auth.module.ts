import { Injectable } from '@nestjs/common';

import { createJwtSigner } from './auth.controller';
import { createJwtStrategyOptions } from './jwt.strategy';
import { createRoleGuard } from './roles.guard';
import { createSamlStrategy, createSamlStrategyOptions } from './saml.strategy';

@Injectable()
export class AuthModule {
  createDependencies(env: NodeJS.ProcessEnv) {
    const samlOptions = createSamlStrategyOptions(env);
    const jwtOptions = createJwtStrategyOptions(env);

    return {
      samlOptions,
      samlStrategy: createSamlStrategy(samlOptions),
      jwtOptions,
      jwtSigner: createJwtSigner(env),
      createRoleGuard,
    } as const;
  }
}
