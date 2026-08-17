/**
 * seed-e2e.ts — Seed room types + physical rooms for E2E tests.
 *
 * Idempotent: checks by name/number before insert, safe to re-run.
 * Creates the 4 default room types and one physical room per type
 * (rooms 101-104, floor 1). Rooms default to AVAILABLE + CLEAN
 * per the Prisma schema, so they are immediately bookable.
 *
 * Run: npx ts-node prisma/seed-e2e.ts
 * Requires: DATABASE_URL or DIRECT_DATABASE_URL in env.
 */
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function buildPrisma(): PrismaClient {
  const dbUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL or DIRECT_DATABASE_URL must be set');
  const u = new URL(dbUrl);
  const adapter = new PrismaPg({
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 5432,
    database: u.pathname.replace(/^\//, ''),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 10000,
  });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

const prisma = buildPrisma();

// ─── Room Types ──────────────────────────────────────────────────────────────
const ROOM_TYPES = [
  {
    name: 'Doble Estándar',
    maxOccupancy: 2,
    description: 'Habitación cómoda para dos huéspedes, 22m², con vista interior.',
    basePrice: 280000,
    amenities: ['WiFi', 'TV', 'Desayuno', 'Aire acondicionado'],
    isPublished: true,
    isActive: true,
  },
  {
    name: 'Doble Deluxe',
    maxOccupancy: 2,
    description: 'Habitación amplia con balcón privado, 28m², vista a los cerros.',
    basePrice: 290000,
    amenities: ['WiFi', 'TV', 'Desayuno', 'Balcón', 'Aire acondicionado', 'Caja fuerte'],
    isPublished: true,
    isActive: true,
  },
  {
    name: 'Familiar',
    maxOccupancy: 4,
    description: 'Habitación familiar con dos camas dobles, 38m².',
    basePrice: 440000,
    amenities: ['WiFi', 'TV', 'Desayuno', 'Aire acondicionado', 'Mini bar'],
    isPublished: true,
    isActive: true,
  },
  {
    name: 'Suite Sumapaz',
    maxOccupancy: 2,
    description: 'Suite premium con sala separada, jacuzzi y terraza privada, 55m².',
    basePrice: 720000,
    amenities: ['WiFi', 'TV', 'Desayuno', 'Jacuzzi', 'Terraza', 'Mini bar'],
    isPublished: true,
    isActive: true,
  },
];

// One room per type — enough for E2E flows (availability, reservation, check-in/out).
const ROOMS = [
  { number: '101', floor: 1, roomTypeName: 'Doble Estándar' },
  { number: '102', floor: 1, roomTypeName: 'Doble Deluxe' },
  { number: '103', floor: 1, roomTypeName: 'Familiar' },
  { number: '104', floor: 1, roomTypeName: 'Suite Sumapaz' },
];

async function main() {
  // ── 1. Seed room types (idempotent by name) ────────────────────────────────
  const typeIdByName = new Map<string, string>();

  for (const rt of ROOM_TYPES) {
    const existing = await prisma.roomType.findFirst({ where: { name: rt.name } });
    if (existing) {
      console.log(`[seed-e2e] Room type EXISTS: ${existing.name} (${existing.id})`);
      typeIdByName.set(existing.name, existing.id);
    } else {
      const created = await prisma.roomType.create({ data: rt });
      console.log(`[seed-e2e] Room type CREATED: ${created.name} (${created.id})`);
      typeIdByName.set(created.name, created.id);
    }
  }

  // ── 2. Seed physical rooms (idempotent by number) ──────────────────────────
  for (const room of ROOMS) {
    const roomTypeId = typeIdByName.get(room.roomTypeName);
    if (!roomTypeId) {
      console.error(`[seed-e2e] Room type "${room.roomTypeName}" not found — skipping room ${room.number}`);
      continue;
    }

    const existing = await prisma.room.findUnique({ where: { number: room.number } });
    if (existing) {
      console.log(`[seed-e2e] Room EXISTS: ${existing.number} (${existing.id})`);
    } else {
      const created = await prisma.room.create({
        data: {
          number: room.number,
          floor: room.floor,
          roomTypeId,
        },
      });
      console.log(`[seed-e2e] Room CREATED: ${created.number} (${created.id})`);
    }
  }

  console.log('[seed-e2e] Done.');
}

main()
  .catch((e) => {
    console.error('[seed-e2e] FAILED', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
