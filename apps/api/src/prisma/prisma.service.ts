import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * PrismaService — explicit pg config + aggressive idle close.
 *
 * Two bugs avoided:
 *   1. `@prisma/adapter-pg@7.8.0` drops `port` when `connectionString` is mixed
 *      with extra pg.PoolConfig options → we parse the URL ourselves.
 *   2. Railway's TCP proxy silently closes idle sessions, but pg.Pool doesn't
 *      detect → we set idleTimeoutMillis very low so the pool refuses to hold
 *      idle connections beyond 1s. Trade-off: extra TCP handshake per low-load
 *      request, negligible for a single-tenant PMS.
 */
function parseDbUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 5432,
    database: u.pathname.replace(/^\//, ''),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL is required');
    }
    const cfg = parseDbUrl(dbUrl);

    const ssl = dbUrl.includes('sslmode=require') || dbUrl.includes('sslmode=prefer')
      ? { rejectUnauthorized: false }
      : undefined;

    const adapter = new PrismaPg({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      ssl,
      keepAlive: true,
      max: 5,
      // Aggressive idle close — drop sockets before Railway proxy does.
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 10000,
    });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
