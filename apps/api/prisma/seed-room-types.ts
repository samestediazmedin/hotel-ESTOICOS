/**
 * Fix-seed for v1.2 launch: populate 4 default room types if DB is empty.
 * Idempotent — checks existing rows by name before insert.
 */
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function buildPrisma(): PrismaClient {
  const dbUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL or DIRECT_DATABASE_URL must be set');
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

const ROOM_TYPES = [
  {
    name: 'Doble Estándar',
    maxOccupancy: 2,
    description: 'Habitación cómoda para dos huéspedes, 22m², con vista interior. Incluye desayuno continental.',
    basePrice: 280000,
    amenities: ['WiFi', 'TV', 'Desayuno', 'Aire acondicionado'],
    isPublished: true,
    isActive: true,
  },
  {
    name: 'Doble Deluxe',
    maxOccupancy: 2,
    description: 'Habitación amplia con balcón privado, 28m², vista a los cerros orientales. Cama king-size.',
    basePrice: 290000,
    amenities: ['WiFi', 'TV', 'Desayuno', 'Balcón', 'Aire acondicionado', 'Caja fuerte'],
    isPublished: true,
    isActive: true,
  },
  {
    name: 'Familiar',
    maxOccupancy: 4,
    description: 'Habitación familiar con dos camas dobles, 38m². Ideal para familias hasta 4 personas.',
    basePrice: 440000,
    amenities: ['WiFi', 'TV', 'Desayuno', 'Aire acondicionado', 'Mini bar'],
    isPublished: true,
    isActive: true,
  },
  {
    name: 'Suite Sumapaz',
    maxOccupancy: 2,
    description: 'Suite premium con sala separada, jacuzzi y terraza privada, 55m². La experiencia más exclusiva del hotel.',
    basePrice: 720000,
    amenities: ['WiFi', 'TV', 'Desayuno', 'Jacuzzi', 'Terraza', 'Mini bar', 'Servicio a la habitación 24h'],
    isPublished: true,
    isActive: true,
  },
];

async function main() {
  const existing = await prisma.roomType.count();
  console.log(`[seed-room-types] Existing room types: ${existing}`);

  for (const rt of ROOM_TYPES) {
    const found = await prisma.roomType.findFirst({ where: { name: rt.name } });
    if (found) {
      const updated = await prisma.roomType.update({
        where: { id: found.id },
        data: { isPublished: rt.isPublished, basePrice: rt.basePrice, description: rt.description },
      });
      console.log(`[seed-room-types] UPDATED ${updated.name} | $${updated.basePrice} | isPublished=${updated.isPublished}`);
    } else {
      const created = await prisma.roomType.create({ data: rt });
      console.log(`[seed-room-types] CREATED ${created.name} | $${created.basePrice} | isPublished=${created.isPublished}`);
    }
  }

  const finalCount = await prisma.roomType.count();
  console.log(`[seed-room-types] Total room types in DB: ${finalCount}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
