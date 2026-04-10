import 'reflect-metadata';

import { createAppLogger, type LogLevel } from './lib/logger';

async function bootstrap() {
  const logger = createAppLogger({
    service: 'customreport-api',
    minLevel: (process.env.LOG_LEVEL as LogLevel) ?? 'info',
    logDir: process.env.LOG_DIR,
  });

  logger.info('bootstrap started');

  logger.info('bootstrap completed');

  return {
    name: 'customreport-api',
    status: 'bootstrapped',
    logger,
  } as const;
}

void bootstrap();
