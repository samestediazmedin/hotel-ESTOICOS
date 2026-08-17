# Phase 16: Guest Detail + Deep Links + Contact Events — Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Source:** REQUIREMENTS.md (GCC-06..12) + user explicit ask: "asi mismo se comunican con el cliente" + "dejar uno tificacion de inmediato a la persona que se comunica con el huesped"

<domain>
## Phase Boundary

Cerrar el círculo de v1.3 — construir la **interfaz operacional staff** que consume los datos capturados en Phase 15. Staff abre detalle del huésped, ve toda la información, hace click en un botón (Llamar / WhatsApp / Email), y:
1. Se persiste el evento en `guest_contact_events` (audit + analytics)
2. Se abre el deep link nativo (`tel:`, `wa.me`, `mailto:`)
3. El staff que clickeó ve toast confirmando
4. Otras sesiones staff reciben push Socket.io informando quién acaba de iniciar contacto

**What this phase delivers:**
- Tabla `guest_contact_events` con migration
- 2 endpoints REST nuevos (POST evento + GET historial)
- Socket.io room `guest:{guestId}` con event `contact-event.created`
- Nueva ruta staff `/guests/:id` con detail completo + edit inline
- Componente `<ContactButtons />` reusable (header + reservation rows)
- Hook `useGuestContactEvents(guestId)` combinando TanStack Query + Socket.io subscription
- Toast notifications (local + remote)
- Extension de `GuestsPage.tsx` (existente) con columna "Último contacto"

**Out of scope:**
- WhatsApp Business API real (deep links son suficientes — manual contact, tracked)
- Email templates library expandida (`mailto:` con subject prefilled es suficiente)
- Backend cron automatizado (pre-arrival reminder, etc.) — v1.4+
- Anonimización GDPR del log de contactos — v2 si requerido por compliance
- Photo upload en guest detail (v2)

</domain>

<decisions>
## Implementation Decisions (locked)

### Prisma schema

```prisma
enum ContactMethod {
  CALL
  WHATSAPP
  EMAIL
}

model GuestContactEvent {
  id          String        @id @default(cuid())
  guestId     String
  guest       Guest         @relation(fields: [guestId], references: [id], onDelete: Cascade)
  staffUserId String
  staffUser   User          @relation(fields: [staffUserId], references: [id])
  method      ContactMethod
  notes       String?       @db.VarChar(500)
  createdAt   DateTime      @default(now())

  @@index([guestId, createdAt(sort: Desc)])
  @@index([staffUserId, createdAt(sort: Desc)])
  @@map("guest_contact_events")
}

// Update Guest model to add the relation
model Guest {
  // ... existing fields
  contactEvents GuestContactEvent[]
}

// Update User model to add the relation
model User {
  // ... existing fields
  guestContactEvents GuestContactEvent[]
}
```

- **Migration name**: `20260519010000_phase16_guest_contact_events`
- **Cascade on Guest delete**: Cascade — if guest is hard-deleted, drop their events (GDPR compliance)
- **No cascade on User**: SetDefault would orphan; keep FK strict so deleted staff retains event history (audit trail integrity). If we need to soft-delete staff later, that's a separate concern.

### Backend endpoints

**Module placement**: NEW `apps/api/src/modules/guest-contact/` (clean separation from `guests/` which already handles CRUD).

| Method | Path | Auth | Body / Query | Response |
|--------|------|------|--------------|----------|
| `POST` | `/api/guests/:id/contact-events` | Auth + any staff role | `{method: 'CALL'\|'WHATSAPP'\|'EMAIL', notes?: string}` | 201 + event row with `staffUser.name` joined |
| `GET` | `/api/guests/:id/contact-events?limit=5` | Auth + any staff role | — | `[{id, method, notes, createdAt, staffUserId, staffUser: {name, email}}]` |

- **No PATCH/DELETE** — events are append-only audit trail (v1.3 design)
- **Zod DTOs** in `dto/` subfolder
- **Limit clamping**: default 5, max 50 to prevent abuse

### Socket.io gateway

**New gateway**: `apps/api/src/modules/guest-contact/guest-contact.gateway.ts` (follow pattern from `housekeeping.gateway.ts`)

- **Namespace**: same as housekeeping (default `/`) — single Socket.io server
- **Room name**: `guest:{guestId}` — clients join when they open guest detail page, leave on unmount
- **Event emitted**: `contact-event.created` with payload `{eventId, guestId, method, staffUserId, staffUserName, createdAt}`
- **Emit point**: inside `GuestContactService.createEvent()` after Prisma insert succeeds (before response returns)
- **Authentication**: same JWT-in-handshake pattern as housekeeping gateway (Phase 5)

### Frontend — new route + page

**Route**: `/guests/:id` — staff-protected (any role)
**File**: `apps/web/src/features/guests/GuestDetailPage.tsx` (NEW)
**Layout**:

```
┌─────────────────────────────────────────────────────────┐
│  ← Volver a Huéspedes                                   │
│                                                          │
│  Juan Pérez García                            [Editar]  │
│  CC 1234567890 · Colombia · 32 años                     │
│  [📞 Llamar] [💬 WhatsApp] [✉ Email]                    │
├─────────────────────────────────────────────────────────┤
│  Información de contacto                                │
│  • Email: juan@example.com                              │
│  • Teléfono: +57 300 555 1234                           │
│  • WhatsApp: +57 300 555 1234                           │
│  • Prefiere: WhatsApp                                   │
│  • Idioma: Español                                      │
│  • Marketing: Aceptado                                  │
│  • Restricciones: vegetariano, sin gluten               │
│  • Solicitudes: cama extra, vista cerros                │
├─────────────────────────────────────────────────────────┤
│  Reservaciones (3)                                      │
│  • #abc123 · 14-18 may 2026 · CHECKED_OUT · Doble Dlx  │
│    [📞] [💬] [✉]                                       │
│  • #def456 · 1-3 jun 2026 · CONFIRMED · Familiar       │
│    [📞] [💬] [✉]                                       │
│  ...                                                    │
├─────────────────────────────────────────────────────────┤
│  Últimos contactos (5)                                  │
│  • María Pérez · WhatsApp · hace 12 min                 │
│  • Juan Recepcionista · Email · hace 2h                 │
│  • ...                                                  │
└─────────────────────────────────────────────────────────┘
```

**Edit inline**: click "Editar" → form replaces info section → save calls PATCH `/api/guests/:id` (Phase 3+15 endpoint) → invalidates query.

### Component `<ContactButtons />`

**File**: `apps/web/src/features/guests/components/ContactButtons.tsx`

```tsx
interface Props {
  guestId: string;
  email?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  size?: 'sm' | 'md';
}
```

**Behavior** (each button):
1. Click → triggers async sequence:
   - `await mutation.mutateAsync({method})` (POST to `/contact-events`)
   - On success: `window.location.href = deepLink` (or `window.open(deepLink, '_blank')` for WhatsApp)
   - Show toast "✓ Contacto registrado por {método}"
   - Invalidate `['guest', id, 'contact-events']`
2. Disabled if corresponding data is null (phone null → Llamar disabled; email null → Email disabled; whatsappNumber null → WhatsApp disabled)
3. Tokens: terracotta variant for primary (matches the preferred contact method), outline for others

**Deep link templates** (Spanish defaults):
- `tel:` → just the phone number, no message
- `wa.me/{e164-stripped}?text={encodeURIComponent('Hola {firstName}, le escribo desde el Hotel Sumapaz. ')}` 
- `mailto:{email}?subject={encodeURIComponent('Hotel Sumapaz')}&body={encodeURIComponent('Estimado/a {fullName},')}`

### Hook `useGuestContactEvents(guestId)`

**File**: `apps/web/src/features/guests/hooks/useGuestContactEvents.ts`

**Logic**:
1. TanStack Query GET `/api/guests/:id/contact-events?limit=5`
   - queryKey: `['guest', guestId, 'contact-events']`
   - staleTime: 0 (always considered stale; refetched on focus + via Socket.io invalidation)
2. Socket.io subscription:
   - On mount: join room `guest:{guestId}` via existing socket client
   - On `contact-event.created` event: 
     - If `event.staffUserId !== currentUser.id` → show toast `"{staffUserName} inició contacto por {método} con este huésped"`
     - Always invalidate the query (refetch list)
   - On unmount: leave room

### Toast system

**Existing**: Phase 14+15 used inline alerts (no toast library). For real-time UX of Phase 16, a toast library is needed.

**Decision**: install minimal `sonner` (~3KB, used by shadcn ecosystem). 
- Single dep, well-maintained
- Drop-in usage: `toast.success("...")`, `toast.info("...")`
- Mount once in `App.tsx` or `StaffLayout.tsx` with `<Toaster richColors position="top-right" />`

Alternative: hand-roll a tiny toast component. Rejected — `sonner` is the right tool for the job, single dep, used by every shadcn template.

### GuestsPage.tsx extension

**Existing file** (191L) — already lists all guests in a table.

**Add column** "Último contacto" between existing columns:
- Query GET `/api/guests/:id/contact-events?limit=1` per row would be N+1 (bad)
- **Better**: extend `GET /api/guests` (list endpoint, Phase 3) to include `lastContactEvent` field via Prisma `include` with `take: 1, orderBy: createdAt desc`
- Display: relative time ("hace 2h" / "ayer" / "hace 3 días") via `date-fns/formatDistance` (already installed since Phase 3) with locale `es`
- If null: "—" or "Nunca"
- Click on row navigates to `/guests/:id`

### Verification commands

1. `cd apps/api && npx prisma migrate status` → phase16 migration applied
2. `cd apps/api && npx tsc --noEmit` → 0 errors
3. `cd apps/web && npx tsc --noEmit` → 0 errors
4. `cd apps/api && npx vitest run src/modules/{guest-contact,guests}/` → all pass
5. `cd apps/web && npx vitest run src/features/guests/` → all pass
6. Manual: open 2 browser tabs as different staff; tab A opens `/guests/:id`, tab B clicks "WhatsApp" → tab A sees toast within 1s
7. Manual: click "Llamar" with phone=null → button disabled (UX validation)
8. Manual: click "Email" with valid email → mailto opens + toast + event in list

### Claude's Discretion
- Whether Socket.io room namespace stays default `/` or uses a dedicated `/guests` namespace (recommend default — keeps client simple, single connection)
- Exact toast wording (Spanish) — proposed text is final but minor tweaks OK
- Whether to show `notes` field on contact-events UI (research recommends NO for v1.3 — keep button-click simple; notes field is for future "manual log" feature in v1.4)
- WhatsApp default message prefill — propose "Hola {firstName}, le escribo desde el Hotel Sumapaz." (firstName extracted from fullName by split on first space)

</decisions>

<canonical_refs>
## Canonical References

### Existing backend code (reuse patterns)
- `apps/api/src/modules/housekeeping/housekeeping.gateway.ts` — Socket.io gateway pattern (rooms, JWT handshake)
- `apps/api/src/modules/housekeeping/housekeeping.gateway.spec.ts` — gateway test pattern
- `apps/api/src/modules/guests/guests.controller.ts` — GET list endpoint to extend with lastContactEvent
- `apps/api/src/modules/guests/guests.service.ts` — service pattern (Phase 15 already extended)
- `apps/api/src/auth/jwt.strategy.ts` — JWT decoding for Socket.io handshake
- `apps/api/src/shared/guards/roles.guard.ts` — for staff endpoints
- `apps/api/prisma/schema.prisma` — Guest + User models, add relation + new model + enum

### Existing frontend code (reuse / extend)
- `apps/web/src/features/housekeeping/useHousekeepingSocket.ts` — Socket.io client pattern (existing); will mirror for guest-contact
- `apps/web/src/features/guests/GuestsPage.tsx` (191L) — extend with "Último contacto" column
- `apps/web/src/router.tsx` — add new route `/guests/:id` inside ProtectedRoute > StaffLayout
- `apps/web/src/components/ui/{button,card,badge,input,textarea,alert-dialog}.tsx` — Phase 9 + 13 primitives
- `apps/web/src/lib/api.ts` — existing axios client
- Phase 15 extended Guest types (preferredLanguage, contactPreference, etc.) — consume in detail view

### Project requirements + roadmap
- `.planning/REQUIREMENTS.md` — GCC-06..12
- `.planning/ROADMAP.md` — Phase 16 section: 7 success criteria
- `.planning/PROJECT.md` — v1.3 milestone scope

### Dependencies
- Already installed: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io-client`, `date-fns`
- **NEW dependency**: `sonner` (~3KB) for toast notifications

</canonical_refs>

<specifics>
## Specific Ideas

### Socket.io room lifecycle (frontend)

```ts
// useGuestContactEvents.ts
useEffect(() => {
  if (!guestId) return;
  socket.emit('join-room', `guest:${guestId}`);
  socket.on('contact-event.created', handleEvent);
  return () => {
    socket.emit('leave-room', `guest:${guestId}`);
    socket.off('contact-event.created', handleEvent);
  };
}, [guestId, socket]);
```

The backend gateway listens for `join-room` / `leave-room` (NestJS pattern):
```ts
@SubscribeMessage('join-room')
handleJoin(@MessageBody() room: string, @ConnectedSocket() client: Socket) {
  // Validate user can access this guest (any staff = OK in v1.3)
  client.join(room);
}
```

### Backend emit pattern

```ts
// guest-contact.service.ts
async createEvent(guestId: string, dto: CreateEventDto, userId: string) {
  const event = await this.prisma.guestContactEvent.create({
    data: { guestId, staffUserId: userId, method: dto.method, notes: dto.notes },
    include: { staffUser: { select: { id: true, name: true } } },
  });
  
  this.gateway.server.to(`guest:${guestId}`).emit('contact-event.created', {
    eventId: event.id,
    guestId,
    method: event.method,
    staffUserId: event.staffUserId,
    staffUserName: event.staffUser.name,
    createdAt: event.createdAt.toISOString(),
  });
  
  return event;
}
```

### Toast wording (Spanish — locked)

| Trigger | Toast text |
|---------|-----------|
| Self click "Llamar" success | "✓ Llamada registrada" |
| Self click "WhatsApp" success | "✓ WhatsApp registrado" |
| Self click "Email" success | "✓ Email registrado" |
| Remote staff initiates contact (other tab) | `"{staffName} inició contacto por {method} con este huésped"` |
| API error (POST fails) | "No se pudo registrar el contacto. Intentar de nuevo." |

### Last contact relative time formatting

```ts
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const label = lastContactEvent
  ? formatDistanceToNow(new Date(lastContactEvent.createdAt), { locale: es, addSuffix: true })
  : 'Nunca';
// e.g., "hace 2 horas", "hace 5 días", "Nunca"
```

### N+1 prevention on /api/guests list

Extend Phase 3's `guestsService.findAll()` Prisma call:
```ts
const guests = await this.prisma.guest.findMany({
  // ... existing where + orderBy
  include: {
    contactEvents: {
      take: 1,
      orderBy: { createdAt: 'desc' },
      select: { method: true, createdAt: true, staffUser: { select: { name: true } } },
    },
  },
});
```

Single query, lateral join — no N+1.

</specifics>

<deferred>
## Deferred Ideas

- **Email templates library expanded** (welcome, pre-arrival reminder, thank-you) — v1.4 if needed
- **WhatsApp Business API real** (templated outbound, not just deep links) — v1.4+
- **Pre-arrival reminder cron** (1 day before check-in) — v1.4
- **Contact log filters / search** in guest detail (by method, by date range) — v2
- **Soft delete on contact events** for GDPR — v2 if Colombian Habeas Data requires
- **Notes field on contact events** (post-call summary) — v1.4 (button + dialog flow)
- **Bulk contact action** (send template to N guests) — v2
- **Contact event analytics dashboard** (most-contacted guests, response rates) — v2

</deferred>

---

*Phase: 16-guest-detail-deep-links-contact-events*
*Context gathered: 2026-05-19 — milestone v1.3 closing phase*
