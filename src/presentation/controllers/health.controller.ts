import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ReadinessService } from '@infrastructure/health/readiness.service';

@Controller('auth/health')
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  // Liveness: the process is up. Must never touch a dependency, otherwise a
  // database blip would restart every pod at once.
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  // Readiness: can this pod serve traffic. Failing it only removes the pod from
  // the Service, it does not restart it.
  @Get('ready')
  async ready() {
    const report = await this.readiness.check();
    if (!report.ready) {
      throw new ServiceUnavailableException(
        `Not ready: ${JSON.stringify(report.checks)}`,
      );
    }
    return { status: 'ok', checks: report.checks };
  }
}
