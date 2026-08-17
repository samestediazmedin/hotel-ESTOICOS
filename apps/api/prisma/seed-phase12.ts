/**
 * Phase 12 — Public Portal Data Seed
 *
 * Idempotent — safe to run multiple times. Strategy:
 * - system_config: updateMany({ where: {}, data: {...} }) — updates the single row
 * - hotel_photos: only insert if table is empty (count check)
 * - room_types: no action needed — isPublished defaults to true via migration
 *
 * Values taken verbatim from:
 *   apps/web/src/features/public-portal/data/hotel.ts    (tagline, description, tags)
 *   apps/web/src/features/public-portal/data/photos.ts   (photo URLs + alts)
 *   plan 12-01 (phone — not present in hotel.ts)
 *
 * Run: pnpm --filter api seed:phase12
 */
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function buildPrisma(): PrismaClient {
  const dbUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL or DIRECT_DATABASE_URL must be set');
  }
  const u = new URL(dbUrl);
    const ssl = dbUrl.includes('sslmode=require') || dbUrl.includes('sslmode=prefer')
      ? { rejectUnauthorized: false }
      : undefined;
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

const HOTEL_INFO = {
  // hotelName already seeded by Phase 1 — only set the NEW Phase 12 fields here.
  tagline: 'Boutique en el corazón histórico de Bogotá',
  description:
    'Edificio colonial restaurado a cuatro cuadras de la Plaza de Bolívar, con vista directa a los cerros orientales. Cocina bogotana de autor liderada por la chef Catalina Vélez, terraza con tinto recién pasado y guía personal con IA para descubrir la ciudad como un local.',
  phone: '+57 (1) 555-0100',
  tags: ['Hotel boutique', '42 habitaciones', '4 pisos', 'Desayuno incluido'],
};

// Verbatim from apps/web/src/features/public-portal/data/photos.ts
// (no displayOrder in original — assigned 0..4 in insertion order)
const HOTEL_PHOTOS = [
  {
    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&q=80&auto=format&fit=crop',
    alt: 'Fachada colonial del hotel',
    displayOrder: 0,
  },
  {
    url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600&q=80&auto=format&fit=crop',
    alt: 'Lobby con decoración colonial restaurada',
    displayOrder: 1,
  },
  {
    url: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1600&q=80&auto=format&fit=crop',
    alt: 'Suite Andina con vista a los cerros',
    displayOrder: 2,
  },
  {
    url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80&auto=format&fit=crop',
    alt: 'Restaurante de cocina bogotana de autor',
    displayOrder: 3,
  },
  {
    url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600&q=80&auto=format&fit=crop',
    alt: 'Terraza con vista a Monserrate',
    displayOrder: 4,
  },
];

async function main() {
  // === system_config ===
  // Single-row table invariant — updateMany updates whichever row exists.
  const updated = await prisma.systemConfig.updateMany({
    where: {},
    data: HOTEL_INFO,
  });
  console.log(`[seed-phase12] system_config rows updated: ${updated.count}`);

  // === hotel_photos ===
  // Idempotent: only insert if table is empty to avoid duplicates on re-run.
  const photoCount = await prisma.hotelPhoto.count();
  if (photoCount === 0) {
    await prisma.hotelPhoto.createMany({ data: HOTEL_PHOTOS });
    console.log(`[seed-phase12] hotel_photos seeded: ${HOTEL_PHOTOS.length} rows`);
  } else {
    console.log(
      `[seed-phase12] hotel_photos already populated (${photoCount} rows) — skipping`,
    );
  }

  // === room_types ===
  // No-op: isPublished defaults to true via migration.
  // All existing rows are automatically published — no explicit seed action needed.
  console.log(
    '[seed-phase12] room_types: isPublished defaulted to true by migration — no action required',
  );
}

main()
  .catch((e) => {
    console.error('[seed-phase12] FAILED', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
