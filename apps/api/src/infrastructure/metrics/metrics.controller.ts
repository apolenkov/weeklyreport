import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { collectDefaultMetrics, register } from 'prom-client';

collectDefaultMetrics();

@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}
