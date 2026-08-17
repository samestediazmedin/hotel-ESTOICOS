/**
 * Demo data seed for HotelOS AI v1.2
 * Populates ~120 realistic records across all core modules for demos/testing.
 * Idempotent — skips insertion if target tables already have demo data.
 *
 * Run: npx ts-node -r tsconfig-paths/register prisma/seed-demo-data.ts
 */
import 'dotenv/config';
import { PrismaClient, ReservationStatus, PhysicalStatus, CleaningStatus, FolioEntryType, HousekeepingTaskStatus, HousekeepingPriority, VenueType, ContactMethod, UserRole, ContactPreference } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

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

// ── Helpers ────────────────────────────────────────────────────────────────
const date = (offsetDays = 0, base = new Date()) => {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d;
};

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[rand(0, arr.length - 1)];
const money = (value: number) => value.toFixed(2);

// ── Data: Additional staff users ───────────────────────────────────────────
const DEMO_USERS = [
  { name: 'Mariana López', email: 'mariana.lopez@hotel.com', role: UserRole.MANAGER },
  { name: 'Carlos Ruiz', email: 'carlos.ruiz@hotel.com', role: UserRole.RECEPTION },
  { name: 'Sandra Pérez', email: 'sandra.perez@hotel.com', role: UserRole.HOUSEKEEPING },
  { name: 'Andrés Gómez', email: 'andres.gomez@hotel.com', role: UserRole.RECEPTION },
  { name: 'Diana Torres', email: 'diana.torres@hotel.com', role: UserRole.HOUSEKEEPING },
];

// ── Data: Guests ───────────────────────────────────────────────────────────
const GUEST_FIRST_NAMES = ['Juan', 'María', 'Carlos', 'Ana', 'Luis', 'Sofía', 'Pedro', 'Laura', 'Diego', 'Valentina', 'José', 'Camila', 'Miguel', 'Isabella', 'Andrés', 'Luciana'];
const GUEST_LAST_NAMES = ['García', 'Rodríguez', 'Martínez', 'Hernández', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Vargas', 'Castro', 'Morales', 'Ortega'];
const NATIONALITIES = ['Colombiana', 'Mexicana', 'Argentina', 'Española', 'Chilena', 'Peruana', 'Venezolana', 'Ecuatoriana', 'Brasileña', 'Estadounidense'];
const DOC_TYPES = ['CC', 'CE', 'PASAPORTE'];

function buildGuests(count = 18) {
  return Array.from({ length: count }, (_, i) => {
    const firstName = pick(GUEST_FIRST_NAMES);
    const lastName = pick(GUEST_LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;
    const docType = pick(DOC_TYPES);
    const docNumber = `${rand(10000000, 99999999)}${String.fromCharCode(65 + rand(0, 25))}`;
    const year = rand(1965, 2000);
    const month = rand(1, 12);
    const day = rand(1, 28);
    const contactPreference = pick<ContactPreference | null>([null, ContactPreference.EMAIL, ContactPreference.PHONE, ContactPreference.WHATSAPP]);
    return {
      fullName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com`,
      phone: `+57 3${rand(10, 50)} ${rand(1000000, 9999999)}`,
      documentType: docType,
      documentNumber: docNumber,
      nationality: pick(NATIONALITIES),
      dateOfBirth: new Date(year, month - 1, day),
      preferredLanguage: 'es',
      contactPreference,
      whatsappNumber: rand(0, 1) ? `+57 3${rand(10, 50)} ${rand(1000000, 9999999)}` : null,
      marketingConsent: Math.random() > 0.7,
      dietaryRestrictions: Math.random() > 0.8 ? 'Sin gluten' : null,
      specialRequests: Math.random() > 0.8 ? 'Cama adicional' : null,
    };
  });
}

// ── Data: Offers ───────────────────────────────────────────────────────────
const DEMO_OFFERS = [
  { title: 'Escapada Romántica', description: 'Noche en Suite Sumapaz con cena privada y jacuzzi.', badge: 'ROMÁNTICO', ctaText: 'Reservar' },
  { title: 'Fin de Semana Familiar', description: '2 noches en habitación Familiar con desayuno incluido para 4.', badge: 'FAMILIAR', ctaText: 'Ver disponibilidad' },
  { title: 'Descuento de Última Hora', description: '15% de descuento en habitaciones Deluxe para estancias de esta semana.', badge: '-15%', ctaText: 'Aprovechar' },
  { title: 'Workation Bogotá', description: '3 noches con late checkout y café ilimitado en terraza.', badge: 'WORKATION', ctaText: 'Reservar' },
  { title: 'Aniversario Sumapaz', description: 'Upgrade gratis a Deluxe + botella de vino.', badge: 'ESPECIAL', ctaText: 'Celebrar' },
  { title: 'Larga Estancia', description: '7 noches por el precio de 6 en cualquier habitación.', badge: '7x6', ctaText: 'Reservar' },
  { title: 'Tour Candelaria', description: '2 noches + tour guiado por el centro histórico.', badge: 'CULTURA', ctaText: 'Reservar' },
  { title: 'Gastronomía Bogotana', description: '1 noche + menú degustación de la chef Catalina Vélez.', badge: 'GASTRONOMÍA', ctaText: 'Reservar' },
  { title: 'Early Bird', description: '20% de descuento reservando con 30 días de anticipación.', badge: '-20%', ctaText: 'Reservar' },
  { title: 'Reserva Directa', description: 'Beneficios exclusivos reservando directamente en nuestra web.', badge: 'DIRECTO', ctaText: 'Reservar' },
];

// ── Data: Bogotá Venues ────────────────────────────────────────────────────
const DEMO_VENUES = [
  { name: 'Andrés Carne de Res', type: VenueType.RESTAURANT, lat: 4.6097, lng: -74.0817, address: 'Calle 3 #11-34, Usaquén', description: 'Restaurante icónico de comida colombiana con ambiente festivo.' },
  { name: 'Museo del Oro', type: VenueType.MUSEUM, lat: 4.6016, lng: -74.0720, address: 'Carrera 6 #15-88', description: 'Museo arqueológico con la mayor colección de oro prehispánico.' },
  { name: 'Monserrate', type: VenueType.PARK, lat: 4.6057, lng: -74.0563, address: 'Cerro de Monserrate', description: 'Vista panorámica de Bogotá desde 3,152 msnm.' },
  { name: 'Plaza de Bolívar', type: VenueType.PARK, lat: 4.5981, lng: -74.0761, address: 'Centro histórico', description: 'Plaza principal rodeada de edificios históricos.' },
  { name: 'Café Pasaje', type: VenueType.CAFE, lat: 4.5969, lng: -74.0739, address: 'Calle 11 #4-16', description: 'Café de especialidad en La Candelaria.' },
  { name: 'El Bandido Bistro', type: VenueType.RESTAURANT, lat: 4.6789, lng: -74.0482, address: 'Calle 79 #7-12', description: 'Bistró francés con toque colombiano.' },
  { name: 'Zona T', type: VenueType.NIGHTLIFE, lat: 4.6696, lng: -74.0536, address: 'Calle 82 con Carrera 13', description: 'Zona de restaurantes, bares y vida nocturna.' },
  { name: 'Centro Comercial Andino', type: VenueType.SHOPPING, lat: 4.6666, lng: -74.0524, address: 'Carrera 11 #82-71', description: 'Centro comercial de lujo en el norte.' },
  { name: 'Jardín Botánico', type: VenueType.PARK, lat: 4.6676, lng: -74.0987, address: 'Calle 63 #68-95', description: 'Jardín botánico con orquideario y mariposario.' },
  { name: 'Maloka', type: VenueType.EVENT_VENUE, lat: 4.6556, lng: -74.1099, address: 'Carrera 68D #24A-51', description: 'Museo interactivo de ciencia y tecnología.' },
  { name: 'La Puerta Falsa', type: VenueType.RESTAURANT, lat: 4.5975, lng: -74.0758, address: 'Calle 11 #6-50', description: 'Restaurante histórico desde 1816, famoso por chocolate completo.' },
  { name: 'Usaquén Flea Market', type: VenueType.SHOPPING, lat: 4.6952, lng: -74.0308, address: 'Usaquén', description: 'Mercado de artesanías los domingos.' },
  { name: 'Teatro Colón', type: VenueType.EVENT_VENUE, lat: 4.5965, lng: -74.0745, address: 'Calle 10 #5-32', description: 'Teatro histórico con programación de ópera y ballet.' },
  { name: 'Cervecería BBC', type: VenueType.BAR, lat: 4.6532, lng: -74.0558, address: 'Carrera 11 #83-76', description: 'Cerveza artesanal colombiana.' },
  { name: 'Parque de la 93', type: VenueType.PARK, lat: 4.6768, lng: -74.0483, address: 'Calle 93B con Carrera 13', description: 'Parque rodeado de restaurantes y cafés.' },
];

// ── Data: Reviews comments ─────────────────────────────────────────────────
const REVIEW_COMMENTS = [
  'Excelente experiencia. El personal fue muy atento y la habitación impecable.',
  'Muy buena ubicación en el centro histórico. El desayuno es delicioso.',
  'La Suite Sumapaz vale cada peso. El jacuzzi privado es espectacular.',
  'Buen hotel, aunque el ruido de la calle se escucha un poco.',
  'Increíble atención del concierge virtual. Nos recomendó lugares maravillosos.',
  'Habitación limpia y cómoda. Ideal para viajes de trabajo.',
  'El restaurante del hotel es excelente. La chef Catalina es un tesoro.',
  'Buena relación calidad-precio. Volveremos pronto.',
  'El proceso de check-in fue muy rápido gracias al sistema digital.',
  'Hermoso edificio colonial restaurado. La terraza es el lugar perfecto para el tinto.',
  'La habitación familiar fue perfecta para nosotros cuatro.',
  'Servicio impecable. Nos ayudaron con una reserva de último momento.',
  'El WiFi funcionó perfecto para mi workation.',
  'Desayuno variado y fresco todos los días.',
  'Ubicación perfecta para explorar La Candelaria.',
  'La atención de Sandra del housekeeping fue excepcional.',
  'Hotel boutique con mucho encanto. Recomendado.',
  'Nos encantó la decoración colonial y el ambiente acogedor.',
  'El concierge nos organizó un tour privado. Inolvidable.',
  'Perfecto para una escapada romántica.',
];

// ── Main seeding ───────────────────────────────────────────────────────────
async function main() {
  console.log('[seed-demo-data] Starting demo data seed...');

  // Idempotency guards per entity
  const existingReservations = await prisma.reservation.count();
  if (existingReservations > 0) {
    console.log(`[seed-demo-data] Found ${existingReservations} existing reservations. Skipping demo seed.`);
    return;
  }

  // ── 0. Ensure enough physical rooms to avoid overlap ─────────────────────
  console.log('[seed-demo-data] Ensuring enough physical rooms...');
  const targetRooms = 30;
  let roomTypes = await prisma.roomType.findMany({ include: { rooms: true } });
  let rooms = roomTypes.flatMap((rt) => rt.rooms);
  const existingRoomCount = rooms.length;

  if (existingRoomCount < targetRooms) {
    const roomsToCreate = targetRooms - existingRoomCount;
    const floors = [1, 2, 3, 4, 5];
    let nextNumber = 100 + existingRoomCount + 1;
    for (let i = 0; i < roomsToCreate; i++) {
      const roomType = roomTypes[i % roomTypes.length];
      const floor = floors[i % floors.length];
      const number = `${floor}${String(i % 20).padStart(2, '0')}`;
      try {
        await prisma.room.create({
          data: {
            number,
            floor,
            roomTypeId: roomType.id,
            physicalStatus: PhysicalStatus.AVAILABLE,
            cleaningStatus: CleaningStatus.CLEAN,
            notes: 'Habitación demo generada automáticamente.',
          },
        });
      } catch (e) {
        // Number may collide; skip and continue
      }
    }
    roomTypes = await prisma.roomType.findMany({ include: { rooms: true } });
    rooms = roomTypes.flatMap((rt) => rt.rooms);
  }
  console.log(`[seed-demo-data] Room pool: ${rooms.length} rooms.`);

  // ── 1. Users ─────────────────────────────────────────────────────────────
  console.log('[seed-demo-data] Creating staff users...');
  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@hotel.com' } });
  if (!adminUser) throw new Error('Admin user not found. Run seed-admin first.');

  const userPasswordHash = await bcrypt.hash('Password1', 10);
  const createdUsers: Record<string, string> = { admin: adminUser.id };

  for (const u of DEMO_USERS) {
    const existing = await prisma.user.findFirst({ where: { email: u.email } });
    if (existing) {
      createdUsers[u.email] = existing.id;
      continue;
    }
    const created = await prisma.user.create({
      data: { ...u, passwordHash: userPasswordHash, isActive: true },
    });
    createdUsers[u.email] = created.id;
  }
  console.log(`[seed-demo-data] Staff users ready (${Object.keys(createdUsers).length} total).`);

  // ── 2. Room types and rooms (already loaded above) ───────────────────────
  console.log(`[seed-demo-data] Found ${roomTypes.length} room types, ${rooms.length} rooms.`);

  // ── 3. Guests ────────────────────────────────────────────────────────────
  console.log('[seed-demo-data] Creating guests...');
  const guestData = buildGuests(18);
  const createdGuests = await Promise.all(
    guestData.map((g) => prisma.guest.create({ data: g })),
  );
  console.log(`[seed-demo-data] Created ${createdGuests.length} guests.`);

  // ── 4. Offers ────────────────────────────────────────────────────────────
  console.log('[seed-demo-data] Creating offers...');
  const createdOffers = await Promise.all(
    DEMO_OFFERS.map((o, i) =>
      prisma.offer.create({
        data: {
          ...o,
          imageKey: `offers/demo-offer-${i + 1}.svg`,
          validFrom: date(rand(-30, -5)),
          validTo: date(rand(30, 90)),
          displayOrder: i,
          isActive: true,
          roomTypeId: i % 2 === 0 ? roomTypes[i % roomTypes.length].id : null,
        },
      }),
    ),
  );
  console.log(`[seed-demo-data] Created ${createdOffers.length} offers.`);

  // ── 5. Bogotá Venues ─────────────────────────────────────────────────────
  console.log('[seed-demo-data] Creating Bogotá venues...');
  const createdVenues = await Promise.all(
    DEMO_VENUES.map((v) =>
      prisma.bogotaVenue.create({
        data: {
          ...v,
          rating: rand(35, 50) / 10,
          phone: `+57 1 ${rand(1000000, 9999999)}`,
          website: `https://example.com/${v.name.toLowerCase().replace(/\s+/g, '-')}`,
          photoUrl: `https://images.unsplash.com/photo-${rand(1000000, 9999999)}`,
          mapsUrl: `https://maps.google.com/?q=${v.lat},${v.lng}`,
          isActive: true,
        },
      }),
    ),
  );
  console.log(`[seed-demo-data] Created ${createdVenues.length} venues.`);

  // ── 6. Reservations + Folios + Folio Items + Stays ───────────────────────
  console.log('[seed-demo-data] Creating reservations, folios and stays...');
  const today = new Date();
  const reservationCount = 30;
  const statuses: ReservationStatus[] = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW', 'PENDING'];
  const statusWeights = [25, 15, 35, 8, 2, 5]; // CHECKED_OUT most common for demo data

  function weightedStatus(): ReservationStatus {
    const total = statusWeights.reduce((a, b) => a + b, 0);
    let r = rand(1, total);
    for (let i = 0; i < statuses.length; i++) {
      r -= statusWeights[i];
      if (r <= 0) return statuses[i];
    }
    return 'CONFIRMED';
  }

  let reservationsCreated = 0;
  let foliosCreated = 0;
  let folioItemsCreated = 0;
  let staysCreated = 0;

  for (let i = 0; i < reservationCount; i++) {
    const guest = createdGuests[i % createdGuests.length];
    const status = weightedStatus();
    // Use a unique room for the first N reservations to avoid overlap constraint.
    // For CANCELLED/NO_SHOW/PENDING leave roomId null.
    const needsRoom = status !== 'CANCELLED' && status !== 'NO_SHOW' && status !== 'PENDING';
    const room = needsRoom && i < rooms.length ? rooms[i] : null;
    const roomType = room
      ? roomTypes.find((rt) => rt.id === room.roomTypeId)!
      : roomTypes[i % roomTypes.length];
    const basePrice = Number(roomType.basePrice);
    const nights = rand(1, 7);
    const checkInOffset = rand(-45, 30);
    const checkIn = date(checkInOffset, today);
    const checkOut = date(checkInOffset + nights, today);
    const adults = rand(1, Math.min(roomType.maxOccupancy, 3));
    const children = rand(0, Math.max(0, roomType.maxOccupancy - adults));
    const totalNights = nights;
    const nightlyRate = Math.round(basePrice * (0.9 + Math.random() * 0.3));
    const ivaRate = 0.19;

    const reservation = await prisma.reservation.create({
      data: {
        guestId: guest.id,
        roomId: status === 'CANCELLED' || status === 'NO_SHOW' || status === 'PENDING' ? null : room?.id ?? null,
        roomTypeId: roomType.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        status,
        source: pick(['DIRECT', 'WALK_IN', 'OTA_FUTURE']),
        adults,
        children,
        notes: Math.random() > 0.7 ? 'Reserva demo generada automáticamente.' : null,
        totalNights,
        sourceOfferId: Math.random() > 0.8 ? createdOffers[i % createdOffers.length].id : null,
      },
    });
    reservationsCreated++;

    // Folio + items for non-cancelled/non-no-show reservations
    if (status !== 'CANCELLED' && status !== 'NO_SHOW') {
      const folio = await prisma.folio.create({
        data: {
          reservationId: reservation.id,
          isOpen: status === 'CHECKED_IN' || status === 'PENDING',
          closedAt: status === 'CHECKED_OUT' ? checkOut : null,
        },
      });
      foliosCreated++;

      // Room charges
      for (let n = 0; n < nights; n++) {
        const businessDate = date(checkInOffset + n, today);
        const subtotal = nightlyRate;
        const taxAmount = Math.round(subtotal * ivaRate);
        const amount = subtotal + taxAmount;
        await prisma.folioItem.create({
          data: {
            folioId: folio.id,
            type: FolioEntryType.ROOM_CHARGE,
            description: `Noche ${n + 1} - ${room ? 'Habitación ' + room.number : roomType.name}`,
            quantity: 1,
            unitPrice: money(nightlyRate),
            amount: money(amount),
            taxRate: money(ivaRate),
            taxAmount: money(taxAmount),
            postedByUserId: adminUser.id,
            businessDate,
          },
        });
        folioItemsCreated++;
      }

      // Extra charges (30% chance)
      if (Math.random() > 0.7) {
        const extraAmount = rand(25000, 120000);
        const taxAmount = Math.round(extraAmount * ivaRate);
        await prisma.folioItem.create({
          data: {
            folioId: folio.id,
            type: FolioEntryType.MANUAL_CHARGE,
            description: pick(['Minibar', 'Lavandería', 'Transporte aeropuerto', 'Cena restaurante', 'Room service']),
            quantity: 1,
            unitPrice: money(extraAmount),
            amount: money(extraAmount + taxAmount),
            taxRate: money(ivaRate),
            taxAmount: money(taxAmount),
            postedByUserId: adminUser.id,
            businessDate: checkIn,
          },
        });
        folioItemsCreated++;
      }

      // Stays for checked-in/checked-out (only when a room was assigned)
      if ((status === 'CHECKED_IN' || status === 'CHECKED_OUT') && room) {
        await prisma.stay.create({
          data: {
            reservationId: reservation.id,
            roomId: room.id,
            arrivedAt: new Date(checkIn.getTime() + 15 * 60 * 60 * 1000), // 3 PM
            departedAt: status === 'CHECKED_OUT' ? new Date(checkOut.getTime() + 12 * 60 * 60 * 1000) : null,
          },
        });
        staysCreated++;

        // Update room status for checked-in
        if (status === 'CHECKED_IN') {
          await prisma.room.update({
            where: { id: room.id },
            data: { physicalStatus: PhysicalStatus.OCCUPIED, cleaningStatus: CleaningStatus.CLEAN },
          });
        } else if (status === 'CHECKED_OUT') {
          await prisma.room.update({
            where: { id: room.id },
            data: { physicalStatus: PhysicalStatus.AVAILABLE, cleaningStatus: CleaningStatus.DIRTY },
          });
        }
      }
    }
  }
  console.log(`[seed-demo-data] Created ${reservationsCreated} reservations, ${foliosCreated} folios, ${folioItemsCreated} folio items, ${staysCreated} stays.`);

  // ── 7. Reviews ───────────────────────────────────────────────────────────
  console.log('[seed-demo-data] Creating reviews...');
  const checkedOutReservations = await prisma.reservation.findMany({
    where: { status: 'CHECKED_OUT' },
    take: 20,
  });
  let reviewsCreated = 0;
  for (let i = 0; i < Math.min(20, checkedOutReservations.length); i++) {
    const res = checkedOutReservations[i];
    const rating = rand(3, 5);
    const moderated = Math.random() > 0.2;
    await prisma.review.create({
      data: {
        guestName: createdGuests.find((g) => g.id === res.guestId)?.fullName ?? 'Huésped',
        rating,
        comment: REVIEW_COMMENTS[i % REVIEW_COMMENTS.length],
        stayDate: res.checkOutDate,
        reservationId: res.id,
        moderated,
        publishedAt: moderated ? new Date() : null,
      },
    });
    reviewsCreated++;
  }
  console.log(`[seed-demo-data] Created ${reviewsCreated} reviews.`);

  // ── 8. Housekeeping Tasks ────────────────────────────────────────────────
  console.log('[seed-demo-data] Creating housekeeping tasks...');
  const dirtyRooms = await prisma.room.findMany({
    where: { cleaningStatus: CleaningStatus.DIRTY },
    take: 10,
  });
  const housekeepingStaff = await prisma.user.findMany({
    where: { role: UserRole.HOUSEKEEPING },
  });
  let tasksCreated = 0;
  for (let i = 0; i < Math.min(10, dirtyRooms.length); i++) {
    const room = dirtyRooms[i];
    const assignedTo = housekeepingStaff.length > 0 ? housekeepingStaff[i % housekeepingStaff.length].id : null;
    await prisma.housekeepingTask.create({
      data: {
        roomId: room.id,
        assignedToId: assignedTo,
        priority: pick(['HIGH', 'MEDIUM', 'LOW']),
        notes: `Limpieza post-checkout habitación ${room.number}`,
        businessDate: date(0, today),
        status: pick(['OPEN', 'IN_PROGRESS', 'DONE']),
        createdById: adminUser.id,
      },
    });
    tasksCreated++;
  }
  console.log(`[seed-demo-data] Created ${tasksCreated} housekeeping tasks.`);

  // ── 9. Guest Contact Events ──────────────────────────────────────────────
  console.log('[seed-demo-data] Creating guest contact events...');
  let contactEventsCreated = 0;
  for (let i = 0; i < 12; i++) {
    const guest = createdGuests[i % createdGuests.length];
    await prisma.guestContactEvent.create({
      data: {
        guestId: guest.id,
        staffUserId: adminUser.id,
        method: pick(['CALL', 'WHATSAPP', 'EMAIL']),
        notes: pick([
          'Confirmación de reserva vía WhatsApp.',
          'Huésped solicitó late checkout.',
          'Información sobre servicio de transporte.',
          'Seguimiento post-estadía.',
          'Confirmación de requisitos dietéticos.',
        ]),
      },
    });
    contactEventsCreated++;
  }
  console.log(`[seed-demo-data] Created ${contactEventsCreated} contact events.`);

  // ── 10. Daily Snapshots (last 30 days) ───────────────────────────────────
  console.log('[seed-demo-data] Creating daily snapshots...');
  let snapshotsCreated = 0;
  for (let i = -30; i <= 0; i++) {
    const businessDate = date(i, today);
    const totalRooms = rooms.length;
    const occupiedRooms = rand(2, totalRooms);
    const occupancyPct = occupiedRooms / totalRooms;
    const adr = rand(250000, 500000);
    const revpar = Math.round(adr * occupancyPct);
    const totalRevenue = revpar * totalRooms;
    await prisma.dailySnapshot.create({
      data: {
        businessDate,
        totalRooms,
        occupiedRooms,
        occupancyPct: money(occupancyPct),
        adr: money(adr),
        revpar: money(revpar),
        totalRevenue: money(totalRevenue),
        arrivalsCount: rand(0, occupiedRooms),
        departuresCount: rand(0, occupiedRooms),
        noShowCount: rand(0, 1),
      },
    });
    snapshotsCreated++;
  }
  console.log(`[seed-demo-data] Created ${snapshotsCreated} daily snapshots.`);

  // ── Summary ──────────────────────────────────────────────────────────────
  const totalRecords =
    Object.keys(createdUsers).length +
    createdGuests.length +
    createdOffers.length +
    createdVenues.length +
    reservationsCreated +
    foliosCreated +
    folioItemsCreated +
    staysCreated +
    reviewsCreated +
    tasksCreated +
    contactEventsCreated +
    snapshotsCreated;

  console.log('\n✅ [seed-demo-data] Demo data created successfully!');
  console.log(`Total records created: ~${totalRecords}`);
  console.table({
    users: Object.keys(createdUsers).length,
    guests: createdGuests.length,
    offers: createdOffers.length,
    venues: createdVenues.length,
    reservations: reservationsCreated,
    folios: foliosCreated,
    folioItems: folioItemsCreated,
    stays: staysCreated,
    reviews: reviewsCreated,
    housekeepingTasks: tasksCreated,
    contactEvents: contactEventsCreated,
    dailySnapshots: snapshotsCreated,
  });
}

main()
  .catch((e) => {
    console.error('[seed-demo-data] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
