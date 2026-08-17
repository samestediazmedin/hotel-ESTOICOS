import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function buildPrisma(): PrismaClient {
  const dbUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL or DIRECT_DATABASE_URL must be set');
  const u = new URL(dbUrl);
  const ssl = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
  const adapter = new PrismaPg({
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 5432,
    database: u.pathname.replace(/^\//, ''),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl,
    max: 1,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 10000,
  });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

const prisma = buildPrisma();

async function main() {
  console.log('[update-offer-images] Updating offer image keys from .jpg to .svg...');
  
  const offers = await prisma.offer.findMany();
  console.log(`[update-offer-images] Found ${offers.length} offers`);
  
  for (const offer of offers) {
    if (offer.imageKey.endsWith('.jpg')) {
      const newKey = offer.imageKey.replace('.jpg', '.svg');
      await prisma.offer.update({
        where: { id: offer.id },
        data: { imageKey: newKey },
      });
      console.log(`[update-offer-images] UPDATED: ${offer.id} -> ${newKey}`);
    } else {
      console.log(`[update-offer-images] SKIPPED: ${offer.id} already ${offer.imageKey}`);
    }
  }
  
  console.log('[update-offer-images] Done.');
}

main()
  .catch((e) => {
    console.error('[update-offer-images] FAILED', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
