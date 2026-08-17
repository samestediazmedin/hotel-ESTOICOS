import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * HealthController — simple health check for CI/CD and monitoring.
 *
 * Returns 200 with a JSON payload when the API and database are reachable.
 * Used by GitHub Actions E2E workflow to wait for API readiness.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    // Verify database connectivity with a lightweight query
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
