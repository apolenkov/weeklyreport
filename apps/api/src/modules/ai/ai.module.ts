import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';
import { AiPrismaFacade } from './ai-facade.js';
import { AiService } from './ai.service.js';

@Module({
  imports: [PrismaModule],
  providers: [
    AiPrismaFacade,
    {
      provide: AiService,
      useFactory: (facade: AiPrismaFacade) => new AiService(facade),
      inject: [AiPrismaFacade],
    },
  ],
  exports: [AiService],
})
export class AiModule {}
