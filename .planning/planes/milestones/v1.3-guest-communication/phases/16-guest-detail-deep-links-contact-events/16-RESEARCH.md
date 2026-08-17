# Phase 16: Guest Detail + Deep Links + Contact Events — Research

**Researched:** 2026-05-19
**Domain:** NestJS Socket.io gateway + Prisma schema extension + React deep-link UX + TanStack Query + sonner toasts
**Confidence:** HIGH (all findings from direct codebase inspection — zero speculation)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Prisma schema:**
- New model `GuestContactEvent` with: id (cuid), guestId (FK → Guest, onDelete: Cascade), staffUserId (FK → User, no cascade), method (enum ContactMethod: CALL | WHATSAPP | EMAIL), notes (String?, VarChar 500), createdAt (now())
- Indexes: `@@index([guestId, createdAt(sort: Desc)])` + `@@index([staffUserId, createdAt(sort: Desc)])`
- Migration name: `20260519010000_phase16_guest_contact_events`
- Guest model gets `contactEvents GuestContactEvent[]` relation
- User model gets `guestContactEvents GuestContactEvent[]` relation

**Backend endpoints:**
- NEW module `apps/api/src/modules/guest-contact/` (separate from `guests/`)
- POST `/api/guests/:id/contact-events` → 201 + event row with staffUser.name joined
- GET `/api/guests/:id/contact-events?limit=5` → recent events array
- No PATCH/DELETE — append-only audit trail

**Socket.io gateway:**
- New: `apps/api/src/modules/guest-contact/guest-contact.gateway.ts`
- Namespace: default `/` (same as housekeeping — single Socket.io server)
- Room: `guest:{guestId}` — client joins on GuestDetailPage mount, leaves on unmount
- Event emitted: `contact-event.created`
- Auth: JWT-in-handshake, same pattern as HousekeepingGateway

**Frontend new route:**
- `/guests/:id` — staff-protected, any role
- New file: `apps/web/src/features/guests/GuestDetailPage.tsx`
- Sections: header + contact info (+ inline edit) + reservations list + "Últimos contactos"

**ContactButtons component:**
- File: `apps/web/src/features/guests/components/ContactButtons.tsx`
- Props: `{ guestId, email?, phone?, whatsappNumber?, size?: 'sm'|'md' }`
- On click: POST contact-event → open deep link → show toast → invalidate query
- Deep links: `tel:`, `wa.me/{e164}?text={encodeURIComponent(...)}`, `mailto:{email}?subject=...`
- Disabled when corresponding field is null

**Hook `useGuestContactEvents(guestId)`:**
- File: `apps/web/src/features/guests/hooks/useGuestContactEvents.ts`
- TanStack Query (`['guest', guestId, 'contact-events']`) + Socket.io subscription
- On remote event: if `staffUserId !== currentUser.id` → show toast + invalidate

**Toast system:**
- Install `sonner` (new dep — not yet in package.json)
- Mount `<Toaster richColors position="top-right" />` in App.tsx root
- Toast wording: "✓ Llamada registrada" / "✓ WhatsApp registrado" / "✓ Email registrado" (local), "{staffName} inició contacto por {método} con este huésped" (remote)

**GuestsPage.tsx extension:**
- Add "Último contacto" column via `include` in `GET /api/guests` (no N+1)
- Click on row → navigate `/guests/:id`
- Relative time format via `date-fns/formatDistanceToNow` with `es` locale

### Claude's Discretion
- Whether Socket.io room namespace stays default `/` or uses `/guests` (recommend default)
- Exact toast wording — proposed text is final but minor tweaks OK
- Whether to show `notes` field on contact-events UI (recommended NO for v1.3)
- WhatsApp default message prefill

### Deferred Ideas (OUT OF SCOPE)
- WhatsApp Business API real
- Email templates library expanded
- Pre-arrival reminder cron
- Contact log filters/search in guest detail
- Soft delete on contact events
- Notes field on contact events (v1.4)
- Bulk contact action
- Contact event analytics dashboard
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GCC-06 | Nueva tabla `guest_contact_events` con migration | Schema exact DDL defined; migration timestamp `20260519010000` confirmed valid (last migration is `20260526000000`) |
| GCC-07 | POST + GET endpoints `/api/guests/:id/contact-events` | Controller pattern from GuestsController; new module in `guest-contact/` |
| GCC-08 | Socket.io room `guest:{guestId}` emite `contact-event.created` | HousekeepingGateway exact pattern confirmed + adapted for per-guest rooms with join-room/leave-room handlers |
| GCC-09 | Ruta `/guests/:id` con 4 secciones | GET `/api/guests/:id` ya existe; reservations via `useGuestHistory`; new route slot confirmed in router.tsx |
| GCC-10 | `<ContactButtons />` con POST + deep link + toast | sonner not yet installed; deep link patterns confirmed; mutation pattern from useUpdateGuest |
| GCC-11 | `useGuestContactEvents` hook con TanStack Query + Socket.io | useHousekeepingSocket exact pattern confirmed; auth store exposes `user.id` and `user.name` |
| GCC-12 | GuestsPage columna "Último contacto" + row click navega a `/guests/:id` | GuestsPage.tsx confirmed 191L; findAll needs Prisma include; date-fns NOT in apps/web (must add) |
</phase_requirements>

---

## Summary

Phase 16 cerrada la v1.3 construyendo la interfaz operacional que consume los datos de Phase 15. El dominio combina tres responsabilidades ortogonales: (1) un nuevo módulo NestJS con endpoints REST + Socket.io gateway, (2) una migración Prisma con dos nuevas FK relations, y (3) cuatro nuevas piezas frontend que se integran con el socket singleton existente.

La investigación confirma que el patrón técnico central — `HousekeepingGateway` — es exactamente reutilizable para este caso. La única diferencia estructural es que Housekeeping usa un único room estático `'housekeeping'` que todos los clientes joinean en `handleConnection`, mientras Phase 16 requiere rooms dinámicos `guest:{guestId}` que los clientes joinean/dejan vía mensajes `join-room`/`leave-room` (el backend los procesa con `@SubscribeMessage`). Esto requiere un `@SubscribeMessage('join-room')` handler adicional que no existe en el gateway de Housekeeping.

**Primary recommendation:** Copiar `housekeeping.gateway.ts` como base, modificar `handleConnection` para NO auto-joinear room (solo validar JWT), agregar handlers `join-room` / `leave-room`, y seguir el patrón de `useHousekeepingSocket.ts` para el cliente con la adición de join/leave explícitos.

Un hallazgo crítico de dependencias: `date-fns` está instalado en `apps/api` (v4.1.0) pero **NO en `apps/web`**. El planner debe incluir `pnpm add date-fns --filter web` en Wave 0. De igual modo, `sonner` no está instalado en ningún workspace — se confirma que `apps/web/package.json` no lo tiene.

---

## Standard Stack

### Core (already installed — verified in package.json)

| Library | Version (installed) | Purpose | Notes |
|---------|--------------------|---------|----- |
| `@nestjs/websockets` | `^11.1.21` | Gateway decorators | Already in apps/api |
| `@nestjs/platform-socket.io` | `^11.1.21` | Socket.io adapter | Already in apps/api |
| `socket.io` | `^4.8.3` | Backend WebSocket server | Already in apps/api |
| `socket.io-client` | `^4.8.3` | Frontend socket client | Already in apps/web |
| `@tanstack/react-query` | `^5.100.0` | Server state + cache invalidation | Already in apps/web |
| `zustand` | `^5.0.0` | Auth store (user.id, user.name) | Already in apps/web |
| `zod` | `^4.0.0` | DTO validation (both workspaces) | Already in both |

### New Dependencies (must install in Wave 0)

| Library | Purpose | Install command |
|---------|---------|----------------|
| `sonner` | Toast notifications (3KB, shadcn ecosystem) | `pnpm add sonner --filter web` |
| `date-fns` | `formatDistanceToNow` + `es` locale for "hace 2h" | `pnpm add date-fns --filter web` |

**Critical:** `date-fns` is installed in `apps/api` at version `^4.1.0` but is **absent from `apps/web/package.json`**. Must be added. The `es` locale import for date-fns v4 is `import { es } from 'date-fns/locale'` (same as v2/v3 — no breaking change on this import path).

---

## Architecture Patterns

### Pattern 1: HousekeepingGateway — Exact Verbatim Pattern (CRITICAL)

The complete, verified implementation to mirror:

```typescript
// apps/api/src/modules/housekeeping/housekeeping.gateway.ts — VERBATIM
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/',
})
export class HousekeepingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) { client.disconnect(true); return; }
      await this.jwtService.verifyAsync(token);
      await client.join('housekeeping'); // ← Phase 16 removes this auto-join
      this.logger.log(`Client connected: ${client.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Socket.io auto-removes client from all rooms on disconnect
  }

  emitStatusUpdate(payload: RoomStatusUpdatePayload): void {
    this.server.to('housekeeping').emit('room:statusUpdate', payload);
  }
}
```

**Phase 16 delta from this pattern:**
1. Remove `client.join('housekeeping')` from `handleConnection` — auth only, no auto-room
2. Add `@SubscribeMessage('join-room')` and `@SubscribeMessage('leave-room')` handlers
3. Expose `emitContactEvent(guestId, payload)` that calls `this.server.to(`guest:${guestId}`).emit('contact-event.created', payload)`

**GuestContactGateway complete structure:**
```typescript
import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection,
  OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

export interface ContactEventPayload {
  eventId: string;
  guestId: string;
  method: 'CALL' | 'WHATSAPP' | 'EMAIL';
  staffUserId: string;
  staffUserName: string;
  createdAt: string; // ISO string
}

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true },
  namespace: '/',
})
export class GuestContactGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private server!: Server;
  private readonly logger = new Logger(GuestContactGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) { client.disconnect(true); return; }
      await this.jwtService.verifyAsync(token);
      this.logger.log(`GuestContact client connected: ${client.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`GuestContact client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    // Validate room name format: must be 'guest:{cuid}'
    if (!room.startsWith('guest:')) return;
    await client.join(room);
    this.logger.log(`Client ${client.id} joined ${room}`);
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @MessageBody() room: string,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    await client.leave(room);
    this.logger.log(`Client ${client.id} left ${room}`);
  }

  emitContactEvent(guestId: string, payload: ContactEventPayload): void {
    this.server.to(`guest:${guestId}`).emit('contact-event.created', payload);
  }
}
```

### Pattern 2: HousekeepingModule — Module Registration Pattern

```typescript
// apps/api/src/modules/housekeeping/housekeeping.module.ts — VERBATIM (key sections)
@Module({
  imports: [
    JwtModule.register({}),  // REQUIRED: gateway needs JwtService for handshake auth
  ],
  controllers: [HousekeepingController],
  providers: [
    HousekeepingService,
    HousekeepingRepository,
    HousekeepingGateway,  // Gateway MUST be in providers[], not a separate module
    CheckoutListener,
    { provide: APP_FILTER, useClass: CleaningDomainExceptionFilter },
  ],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
```

**GuestContactModule must follow the same pattern:**
- `JwtModule.register({})` in imports — JwtService for handshake
- `GuestContactGateway` in providers
- Gateway NEVER imports GuestContactService (one-way DI: service → gateway)

### Pattern 3: Frontend Socket Singleton (useHousekeepingSocket)

```typescript
// apps/web/src/features/housekeeping/useHousekeepingSocket.ts — VERBATIM key parts
let socket: Socket | null = null; // module-level singleton

export function useHousekeepingSocket(): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) return;
    const apiUrl = import.meta.env.VITE_API_URL ?? '';
    socket = io(apiUrl, {
      auth: { token: accessToken },    // JWT in handshake.auth.token — NOT URL param
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    // event listeners...
    return () => { socket?.disconnect(); socket = null; };
  }, [accessToken, queryClient]);
}
```

**Phase 16 delta:** The `useGuestContactEvents` hook reuses a shared socket singleton (same module-level pattern) but additionally emits `join-room` / `leave-room` events and listens for `contact-event.created` per guestId.

**Critical design decision for Phase 16:** Should there be a SHARED socket instance between `useHousekeepingSocket` and `useGuestContactEvents`? They both connect to the default `/` namespace on the same server. Connecting twice to the same URL/namespace creates duplicate socket instances. The recommended approach: create a **shared socket module** (`apps/web/src/lib/socket.ts`) that exports a singleton socket and is used by both hooks. This avoids the duplicate-connection issue.

```typescript
// apps/web/src/lib/socket.ts (NEW — shared singleton)
import { io, Socket } from 'socket.io-client';

let sharedSocket: Socket | null = null;
let currentToken: string | null = null;

export function getOrCreateSocket(accessToken: string): Socket {
  if (sharedSocket && currentToken === accessToken) return sharedSocket;
  if (sharedSocket) { sharedSocket.disconnect(); sharedSocket = null; }
  const apiUrl = import.meta.env.VITE_API_URL ?? '';
  sharedSocket = io(apiUrl, {
    auth: { token: accessToken },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });
  currentToken = accessToken;
  return sharedSocket;
}

export function disconnectSocket(): void {
  sharedSocket?.disconnect();
  sharedSocket = null;
  currentToken = null;
}
```

Alternatively (simpler, acceptable for v1.3): keep per-feature singletons as Housekeeping does (two separate socket connections). Socket.io server handles multiple connections from same client gracefully. Choose based on planner preference — both work correctly.

### Pattern 4: GuestsController Existing Routes (verified)

All 6 routes in `GuestsController` confirmed:
- `GET /api/guests` — list (all roles)
- `GET /api/guests/:id` — single (all roles, already exists — Phase 16 DOES NOT need to create this)
- `POST /api/guests` — create (ADMIN/MANAGER/RECEPTION)
- `PATCH /api/guests/:id` — update (ADMIN/MANAGER/RECEPTION, Phase 15 extended)
- `GET /api/guests/:id/history` — history (ADMIN/MANAGER/RECEPTION)
- `POST /api/guests/:id/anonymize` — anonymize (ADMIN)

**Phase 16 adds to `guest-contact/` module (separate controller):**
- `POST /api/guests/:id/contact-events`
- `GET /api/guests/:id/contact-events`

### Pattern 5: Router — Dynamic Route Insertion

```typescript
// apps/web/src/router.tsx — existing pattern
{
  path: 'guests',
  element: <GuestsPage />,
},
// ADD after:
{
  path: 'guests/:id',
  element: <GuestDetailPage />,
},
```

Import goes at the bottom with other lazy imports:
```typescript
import { GuestDetailPage } from '@/features/guests/GuestDetailPage';
```

### Pattern 6: N+1 Prevention — GuestsRepository.findAll Extension

Current `GuestsRepository.findAll`:
```typescript
findAll(skip = 0, take = 50, search?: string) {
  return this.prisma.guest.findMany({
    where: search ? { fullName: { contains: search, mode: 'insensitive' } } : undefined,
    skip,
    take,
    orderBy: { createdAt: 'desc' },
  });
}
```

Phase 16 extension (single query, no N+1):
```typescript
// Add include to existing findAll
findAll(skip = 0, take = 50, search?: string) {
  return this.prisma.guest.findMany({
    where: search ? { fullName: { contains: search, mode: 'insensitive' } } : undefined,
    skip,
    take,
    orderBy: { createdAt: 'desc' },
    include: {
      contactEvents: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          method: true,
          createdAt: true,
          staffUser: { select: { name: true } },
        },
      },
    },
  });
}
```

This is a lateral join (correlated subquery per guest). With 50 guests + pagination it is not a performance concern.

**Breaking change risk:** `GuestsService.findAll()` → `GuestsService.toResponseDto()` / `toPublicDto()` currently use a `GuestLike` type that does NOT include `contactEvents`. The return type of `findAll` will now include `contactEvents: [...]`. The `toResponseDto` and `toPublicDto` transformers must be updated to pass through `lastContactEvent` (the first element of `contactEvents` array, or null), OR the list endpoint can strip it before calling the DTO transformers. Recommendation: add `lastContactEvent` to both DTO types and both transformer methods.

### Pattern 7: Authentication Store — currentUser.id and currentUser.name

```typescript
// apps/web/src/features/auth/auth.store.ts — VERIFIED
interface AuthUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'RECEPTION' | 'HOUSEKEEPING';
  name?: string;  // NOTE: name is optional (may be undefined)
}
```

Access in hooks:
```typescript
const user = useAuthStore((s) => s.user);
// user?.id — for filtering toast (don't show to self)
// user?.name — note: may be undefined if login didn't set name
```

**Pitfall:** `user.name` may be `undefined` if the auth store was populated before `name` was added to the store. Verify that `login` and `restoreSession` correctly populate `name`. If not, `staffUserName` from the Socket.io event payload is the authoritative name for toast display — use that, not `user.name`.

### Pattern 8: Sonner Toast Integration

`sonner` is NOT installed. App.tsx is minimal (no providers, just `RouterProvider`). The `<Toaster />` mount must go in App.tsx:

```tsx
// apps/web/src/App.tsx — after install
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </>
  );
}
```

Usage anywhere:
```typescript
import { toast } from 'sonner';
toast.success('✓ WhatsApp registrado');
toast.info(`${staffName} inició contacto por WhatsApp con este huésped`);
toast.error('No se pudo registrar el contacto. Intentar de nuevo.');
```

No conflict with existing Sidebar — Sidebar is rendered inside `StaffLayout` inside the router tree. `<Toaster>` at App root renders in a portal above all content.

### Pattern 9: date-fns v4 — Relative Time Formatting

`date-fns` v4 is installed in `apps/api` at `^4.1.0`. The `apps/web` workspace must install the same major version.

```typescript
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';  // same import path in v2/v3/v4

const label = lastContactEvent
  ? formatDistanceToNow(new Date(lastContactEvent.createdAt), {
      locale: es,
      addSuffix: true,  // produces "hace 2 horas" not "2 horas"
    })
  : 'Nunca';
```

### Recommended Project Structure (new files only)

```
apps/api/src/modules/guest-contact/
├── guest-contact.module.ts          NEW
├── guest-contact.controller.ts      NEW (POST + GET endpoints)
├── guest-contact.service.ts         NEW (createEvent + findEvents)
├── guest-contact.gateway.ts         NEW (Socket.io room gateway)
├── guest-contact.repository.ts      NEW (thin Prisma wrapper)
└── dto/
    ├── create-contact-event.dto.ts  NEW (Zod schema)
    └── contact-event-response.dto.ts NEW (response type)

apps/api/prisma/
└── migrations/20260519010000_phase16_guest_contact_events/
    └── migration.sql                NEW

apps/web/src/features/guests/
├── GuestDetailPage.tsx              NEW
├── components/
│   └── ContactButtons.tsx           NEW
└── hooks/
    └── useGuestContactEvents.ts     NEW

apps/web/src/lib/
└── socket.ts                        NEW (shared socket singleton — optional)
```

### Anti-Patterns to Avoid

- **Gateway imports Service for DI:** Gateway MUST NOT import GuestContactService. Service imports Gateway (one-way: service → gateway). The gateway is just a broadcaster.
- **Two Socket.io connections to same namespace:** If both `useHousekeepingSocket` and `useGuestContactEvents` create their own `io()` connections, the client has two WebSocket connections. Use shared singleton or accept two connections (both work, shared is cleaner).
- **Auto-join room in handleConnection:** Unlike Housekeeping which joins a single static room for all clients, Phase 16 rooms are dynamic per guest. Do NOT auto-join in handleConnection.
- **N+1 on GuestsPage "Último contacto":** Never call `GET /api/guests/:id/contact-events` per-row. The include in `findAll` is the correct single-query approach.
- **window.location.href for WhatsApp:** This causes SPA navigation to break on some mobile browsers when opening external URLs. Use `window.open(deepLink, '_blank')` for WhatsApp (separate tab). For `tel:` and `mailto:`, `window.location.href` is acceptable (standard behavior).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast component + animation + portal | `sonner` | Edge cases with z-index, screen reader announcements, auto-dismiss timers, queue management |
| Relative time formatting | Manual "hace X horas" logic | `date-fns/formatDistanceToNow` + `es` locale | Edge cases: 59 sec → "hace menos de un minuto", 1 day → "ayer", Spanish gender agreement |
| Socket.io JWT auth | Custom middleware | Copy HousekeepingGateway pattern exactly | NestJS guards don't run at connection level — only `handleConnection` works |
| Deep link URL encoding | Manual string concat | `encodeURIComponent()` | WhatsApp message can contain accented chars and special chars that break URLs |

**Key insight:** The housekeeping gateway is a fully proven, tested pattern for this exact domain. Phase 16 is a parameterized extension of it — copy first, then delta.

---

## Common Pitfalls

### Pitfall 1: Two Gateways on Same Namespace
**What goes wrong:** Both `HousekeepingGateway` and `GuestContactGateway` declare `namespace: '/'`. NestJS Socket.io supports multiple gateways on the same namespace — they share the same underlying `Server` instance but each has its own `@WebSocketServer()` reference. This WORKS correctly in NestJS.
**Why it happens:** Fear that namespaces conflict.
**How to avoid:** Both gateways use `namespace: '/'` as confirmed by HousekeepingGateway. NestJS handles this via the adapter pattern — both gateways receive the same server instance injected into their `@WebSocketServer()` field.
**Verification:** Existing HousekeepingGateway runs on `/` — Phase 16 gateway must also use `/` or there will be CORS issues and a second WebSocket port.

### Pitfall 2: JwtService.verifyAsync Needs No Secret Arg in Gateway
**What goes wrong:** Calling `jwtService.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET })` vs just `jwtService.verifyAsync(token)`.
**Root cause:** `JwtModule.register({})` registers JwtService without a default secret. The HousekeepingGateway calls `jwtService.verifyAsync(token)` without passing a secret — this works because `JWT_ACCESS_SECRET` is the default key used by NestJS's JwtService when registered in `AuthModule`.
**Verified behavior:** HousekeepingGateway at line 78: `await this.jwtService.verifyAsync(token)` — no explicit secret. This is the confirmed working pattern. Replicate exactly.
**Warning sign:** If handshake always rejects valid tokens, the secret arg may need to be passed explicitly.

### Pitfall 3: `GuestLike` Type in GuestsService.toResponseDto / toPublicDto
**What goes wrong:** After adding `contactEvents` include to `findAll`, TypeScript will fail because `GuestLike` type does not include `contactEvents`. The list endpoint calls `guestsService.toResponseDto(g as any)` — the `as any` cast bypasses this but the DTO shape returned to frontend won't include `lastContactEvent`.
**How to avoid:** 
1. Update `GuestLike` type to include `contactEvents?: Array<{method: string, createdAt: Date, staffUser: {name: string}}>|undefined`
2. Update `toResponseDto` to extract `lastContactEvent` from `raw.contactEvents?.[0]`
3. Update `GuestResponseDto` class to include optional `lastContactEvent` field
4. Frontend `GuestResponseDto` interface in `guests.api.ts` also needs update

### Pitfall 4: `date-fns` Not in apps/web
**What goes wrong:** `import { formatDistanceToNow } from 'date-fns'` fails at build time with "Cannot find module 'date-fns'".
**Root cause:** `date-fns` is in `apps/api/package.json` at `^4.1.0` but absent from `apps/web/package.json` (confirmed by inspection — no match for `"date-fns"` in web package.json).
**How to avoid:** Wave 0 must install `pnpm add date-fns --filter web`.

### Pitfall 5: `sonner` Not in apps/web
**What goes wrong:** `import { toast } from 'sonner'` fails.
**Root cause:** `sonner` not in `apps/web/package.json` (confirmed — grepped for "sonner" in web deps, zero matches). The only toast-like pattern in the frontend is inline `role="alert"` banners (confirmed: `HotelInfoForm.tsx` comment says "No toast library — uses inline role=alert banners").
**How to avoid:** Wave 0 must install `pnpm add sonner --filter web`.

### Pitfall 6: WhatsApp Deep Link E.164 Stripping
**What goes wrong:** `wa.me/+573005551234?text=...` — the `+` sign in E.164 format breaks `wa.me` URL. WhatsApp's `wa.me` scheme expects the number WITHOUT the `+` prefix.
**How to avoid:** Strip the `+` before constructing the URL:
```typescript
const e164Stripped = whatsappNumber.replace(/^\+/, '');
const url = `https://wa.me/${e164Stripped}?text=${encodeURIComponent(msg)}`;
window.open(url, '_blank');
```

### Pitfall 7: Socket.io Room Persistence on Disconnect
**What happens:** When a client disconnects (page close, navigation), Socket.io server automatically removes the client from all rooms. No manual cleanup needed server-side.
**Confirmed by:** HousekeepingGateway `handleDisconnect` comment: "Socket.io removes the client from all rooms automatically on disconnect."
**Frontend cleanup still needed:** `socket.emit('leave-room', room)` + `socket.off('contact-event.created', handler)` in the useEffect cleanup to avoid duplicate listeners on re-mount (React StrictMode double-mount issue, as documented in useHousekeepingSocket P7 comment).

### Pitfall 8: Migration Timestamp Ordering
**What goes wrong:** Using a timestamp earlier than the last migration causes Prisma to refuse to apply it.
**Last migration verified:** `20260526000000_phase15_extended_guest_contact` (confirmed from migrations directory listing).
**Correct next timestamp:** `20260527000000_phase16_guest_contact_events` (CONTEXT.md says `20260519010000` but that is BEFORE Phase 15's `20260526000000` — this will cause a migration ordering conflict).
**Recommendation:** Use `20260527000000_phase16_guest_contact_events` as the migration folder name. The CONTEXT.md timestamp was set before Phase 15 ran — update it.

### Pitfall 9: GuestContactService → Gateway Circular DI
**What goes wrong:** If `GuestContactGateway` is injected into `GuestContactService` AND `GuestContactService` is injected into `GuestContactGateway`, NestJS throws a circular dependency error.
**How to avoid:** One-way only — `GuestContactService` injects `GuestContactGateway` (service calls `gateway.emitContactEvent()`). Gateway NEVER injects service. This matches the HousekeepingGateway pattern documented in the gateway's JSDoc comment: "P5 — Gateway NEVER imports HousekeepingService (one-way DI: service → gateway)."

### Pitfall 10: Cascade on Guest Delete vs. Reservation FK
**What happens:** `GuestContactEvent.guestId` has `onDelete: Cascade`. Does this conflict with `Reservation.guestId` which references Guest without cascade?
**Verified:** No conflict. Each model independently defines its own `onDelete` behavior for its own FK. `Reservation` has no `onDelete` on its `guestId` FK (confirmed in schema.prisma line 235: `guest Guest @relation(fields: [guestId], references: [id])` — no onDelete clause = Restrict by default). The cascade on `GuestContactEvent` only applies to `guest_contact_events` rows, not to reservations.

---

## Code Examples

Verified patterns from direct codebase inspection:

### GuestContactService.createEvent (complete implementation)
```typescript
// apps/api/src/modules/guest-contact/guest-contact.service.ts
async createEvent(
  guestId: string,
  dto: CreateContactEventDto,
  staffUserId: string,
): Promise<ContactEventResponseDto> {
  // Verify guest exists (throws 404 if not)
  const guest = await this.prisma.guest.findUnique({ where: { id: guestId } });
  if (!guest) throw new NotFoundException(`Guest ${guestId} not found`);

  const event = await this.prisma.guestContactEvent.create({
    data: {
      guestId,
      staffUserId,
      method: dto.method,
      notes: dto.notes ?? null,
    },
    include: {
      staffUser: { select: { id: true, name: true } },
    },
  });

  // Emit to all subscribers of this guest's room (fire-and-forget)
  this.gateway.emitContactEvent(guestId, {
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

### useGuestContactEvents hook (complete implementation)
```typescript
// apps/web/src/features/guests/hooks/useGuestContactEvents.ts
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/features/auth/auth.store';
import { api } from '@/lib/api';
// Socket: either import shared singleton or create per-hook (see architecture pattern 3)

export interface GuestContactEventDto {
  id: string;
  method: 'CALL' | 'WHATSAPP' | 'EMAIL';
  notes: string | null;
  createdAt: string;
  staffUserId: string;
  staffUser: { name: string; email: string };
}

const METHOD_LABEL: Record<string, string> = {
  CALL: 'llamada',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'email',
};

export function useGuestContactEvents(guestId: string) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  const query = useQuery<GuestContactEventDto[]>({
    queryKey: ['guest', guestId, 'contact-events'],
    queryFn: () =>
      api
        .get<GuestContactEventDto[]>(`/guests/${guestId}/contact-events?limit=5`)
        .then((r) => r.data),
    staleTime: 0,
    enabled: !!guestId,
  });

  useEffect(() => {
    if (!accessToken || !guestId) return;
    // get or create socket (use shared singleton pattern)
    const socket = getOrCreateSocket(accessToken);
    const room = `guest:${guestId}`;

    socket.emit('join-room', room);

    const handleEvent = (event: {
      eventId: string; guestId: string; method: string;
      staffUserId: string; staffUserName: string; createdAt: string;
    }) => {
      // Always invalidate (update the list for current user too)
      void queryClient.invalidateQueries({ queryKey: ['guest', guestId, 'contact-events'] });
      // Only show remote toast if another staff member triggered it
      if (event.staffUserId !== user?.id) {
        toast.info(
          `${event.staffUserName} inició contacto por ${METHOD_LABEL[event.method] ?? event.method} con este huésped`,
        );
      }
    };

    socket.on('contact-event.created', handleEvent);

    return () => {
      socket.emit('leave-room', room);
      socket.off('contact-event.created', handleEvent);
    };
  }, [guestId, accessToken, queryClient, user?.id]);

  return query;
}
```

### ContactButtons — deep link construction
```typescript
// apps/web/src/features/guests/components/ContactButtons.tsx
function buildDeepLink(
  method: 'CALL' | 'WHATSAPP' | 'EMAIL',
  guest: { phone?: string|null; whatsappNumber?: string|null; email?: string|null; fullName: string },
): string {
  const firstName = guest.fullName.split(' ')[0];
  switch (method) {
    case 'CALL':
      return `tel:${guest.phone}`;
    case 'WHATSAPP': {
      const stripped = (guest.whatsappNumber ?? '').replace(/^\+/, '');
      const text = encodeURIComponent(`Hola ${firstName}, le escribo desde el Hotel Sumapaz. `);
      return `https://wa.me/${stripped}?text=${text}`;
    }
    case 'EMAIL': {
      const subject = encodeURIComponent('Hotel Sumapaz');
      const body = encodeURIComponent(`Estimado/a ${guest.fullName},`);
      return `mailto:${guest.email}?subject=${subject}&body=${body}`;
    }
  }
}

// On button click:
async function handleContactClick(method: 'CALL' | 'WHATSAPP' | 'EMAIL') {
  try {
    await mutation.mutateAsync({ method });
    const link = buildDeepLink(method, guest);
    // WhatsApp: new tab to avoid SPA navigation issues on mobile
    if (method === 'WHATSAPP') {
      window.open(link, '_blank');
    } else {
      window.location.href = link;
    }
    toast.success(TOAST_TEXT[method]);
    void queryClient.invalidateQueries({ queryKey: ['guest', guestId, 'contact-events'] });
  } catch {
    toast.error('No se pudo registrar el contacto. Intentar de nuevo.');
  }
}
```

### Zod DTO for GuestContactEvent
```typescript
// apps/api/src/modules/guest-contact/dto/create-contact-event.dto.ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod'; // or manual pipe

export const CreateContactEventSchema = z.object({
  method: z.enum(['CALL', 'WHATSAPP', 'EMAIL']),
  notes: z.string().max(500).optional(),
});

export type CreateContactEventDto = z.infer<typeof CreateContactEventSchema>;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate notification per guest (polling) | Socket.io room `guest:{id}` (push) | Phase 5 established pattern | Zero polling — events arrive in <100ms |
| Manual toast components | `sonner` | Phase 16 (first real-time UX needing toasts) | No custom animation/portal code needed |
| `date-fns` only on backend | `date-fns` on both workspaces | Phase 16 | Consistent relative time formatting, Spanish locale |

**Deprecated/outdated:**
- `HotelInfoForm` inline banners (`role="alert"`): acceptable for form feedback, but NOT sufficient for real-time push notifications from other users — hence the `sonner` introduction in Phase 16.

---

## Open Questions

1. **Shared Socket Singleton vs. Per-Feature Sockets**
   - What we know: Both `useHousekeepingSocket` and `useGuestContactEvents` connect to the same `/` namespace on the same backend. Creating two separate `io()` instances results in two WebSocket connections.
   - What's unclear: Whether the product's scale (single hotel, ~5 concurrent staff) makes this a real concern.
   - Recommendation: For v1.3, create `apps/web/src/lib/socket.ts` as a shared singleton (pattern documented above). Migrate `useHousekeepingSocket` to use it in the same plan to avoid the dual-connection situation.

2. **Migration Timestamp Conflict**
   - What we know: CONTEXT.md specifies `20260519010000_phase16_guest_contact_events`. The last Phase 15 migration is `20260526000000_phase15_extended_guest_contact`. The Phase 16 timestamp is EARLIER (May 19 < May 26).
   - What's unclear: Whether Prisma will reject or just warn.
   - Recommendation: Use `20260527000000_phase16_guest_contact_events`. Planner should update CONTEXT.md locked decision accordingly.

3. **`user.name` Population in Auth Store**
   - What we know: `AuthUser.name?: string` (optional). The auth store was introduced in Phase 1; `name` may not have been populated by `setUser()` in early login flows.
   - Recommendation: In `useGuestContactEvents`, always use `staffUserName` from the Socket.io event payload for toast display (it comes from the DB join) rather than `user?.name` from the store.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (both workspaces) |
| Config file | `vitest.config.ts` (or `vite.config.ts` with test config) |
| Quick run command (api) | `cd apps/api && npx vitest run src/modules/guest-contact/` |
| Quick run command (web) | `cd apps/web && npx vitest run src/features/guests/` |
| Full suite command (api) | `cd apps/api && npx vitest run` |
| Full suite command (web) | `cd apps/web && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| GCC-06 | Migration schema correct | schema check | `cd apps/api && npx prisma validate` | ✅ Wave 0 migration |
| GCC-07 | POST creates event, GET returns list | unit (service + controller) | `npx vitest run src/modules/guest-contact/guest-contact.service.spec.ts` | ❌ Wave 0 creates |
| GCC-08 | Gateway join-room/leave-room + emit | unit (gateway) | `npx vitest run src/modules/guest-contact/guest-contact.gateway.spec.ts` | ❌ Wave 0 creates |
| GCC-09 | GuestDetailPage renders sections | component | `npx vitest run src/features/guests/GuestDetailPage.spec.tsx` | ❌ Wave 0 creates |
| GCC-10 | ContactButtons POST then deep link | component + integration | `npx vitest run src/features/guests/components/ContactButtons.spec.tsx` | ❌ Wave 0 creates |
| GCC-11 | useGuestContactEvents invalidates + shows toast | hook unit | `npx vitest run src/features/guests/hooks/useGuestContactEvents.spec.ts` | ❌ Wave 0 creates |
| GCC-12 | GuestsPage row click navigates to /guests/:id | component | existing `GuestsPage.spec.tsx` extended | ❌ extend existing |

### Gateway Test Pattern (copy from housekeeping.gateway.spec.ts)
The gateway spec uses a `makeClient()` / `makeServer()` helper pattern with `vi.fn()` mocks. The `(gateway as any).server = server` injection replaces `@WebSocketServer()`. This pattern is fully verified and must be copied for `GuestContactGateway` spec.

### Sampling Rate
- **Per task commit:** `cd apps/api && npx vitest run src/modules/guest-contact/ && cd apps/web && npx vitest run src/features/guests/`
- **Per wave merge:** Full suite: `cd apps/api && npx vitest run && cd apps/web && npx vitest run`
- **Phase gate:** Both full suites green + `tsc --noEmit` zero errors in both workspaces

### Wave 0 Gaps
- [ ] `apps/api/src/modules/guest-contact/guest-contact.service.spec.ts` — covers GCC-07
- [ ] `apps/api/src/modules/guest-contact/guest-contact.gateway.spec.ts` — covers GCC-08
- [ ] `apps/web/src/features/guests/GuestDetailPage.spec.tsx` — covers GCC-09
- [ ] `apps/web/src/features/guests/components/ContactButtons.spec.tsx` — covers GCC-10
- [ ] `apps/web/src/features/guests/hooks/useGuestContactEvents.spec.ts` — covers GCC-11
- [ ] Wave 0 deps: `pnpm add sonner date-fns --filter web`
- [ ] Wave 0 migration: `20260527000000_phase16_guest_contact_events`

---

## Files Inventory (complete — all files created or modified)

### Backend — NEW files
1. `apps/api/src/modules/guest-contact/guest-contact.module.ts`
2. `apps/api/src/modules/guest-contact/guest-contact.controller.ts`
3. `apps/api/src/modules/guest-contact/guest-contact.service.ts`
4. `apps/api/src/modules/guest-contact/guest-contact.service.spec.ts`
5. `apps/api/src/modules/guest-contact/guest-contact.gateway.ts`
6. `apps/api/src/modules/guest-contact/guest-contact.gateway.spec.ts`
7. `apps/api/src/modules/guest-contact/guest-contact.repository.ts`
8. `apps/api/src/modules/guest-contact/dto/create-contact-event.dto.ts`
9. `apps/api/src/modules/guest-contact/dto/contact-event-response.dto.ts`
10. `apps/api/prisma/migrations/20260527000000_phase16_guest_contact_events/migration.sql`

### Backend — MODIFIED files
11. `apps/api/prisma/schema.prisma` — add `ContactMethod` enum + `GuestContactEvent` model + relations on `Guest` + `User`
12. `apps/api/src/app.module.ts` — import `GuestContactModule`
13. `apps/api/src/modules/guests/guests.repository.ts` — add `contactEvents` include to `findAll`
14. `apps/api/src/modules/guests/guests.service.ts` — update `GuestLike` type + `toResponseDto` + `toPublicDto` to include `lastContactEvent`
15. `apps/api/src/modules/guests/dto/guest-response.dto.ts` — add optional `lastContactEvent` field

### Frontend — NEW files
16. `apps/web/src/features/guests/GuestDetailPage.tsx`
17. `apps/web/src/features/guests/components/ContactButtons.tsx`
18. `apps/web/src/features/guests/hooks/useGuestContactEvents.ts`
19. `apps/web/src/lib/socket.ts` (shared singleton — recommended)

### Frontend — MODIFIED files
20. `apps/web/src/router.tsx` — add `guests/:id` route + import
21. `apps/web/src/App.tsx` — add `<Toaster>` from sonner
22. `apps/web/src/features/guests/GuestsPage.tsx` — add "Último contacto" column + row click → navigate
23. `apps/web/src/features/guests/guests.api.ts` — extend `GuestResponseDto` / `GuestPublicDto` with `lastContactEvent?`, add contact-events query/mutation
24. `apps/web/src/features/housekeeping/useHousekeepingSocket.ts` — migrate to shared socket singleton (if Pattern 3 shared approach chosen)

**Total: 10 new backend + 5 modified backend + 4 new frontend + 6 modified frontend = 25 files**

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `apps/api/src/modules/housekeeping/housekeeping.gateway.ts` — exact Socket.io gateway pattern
- `apps/api/src/modules/housekeeping/housekeeping.gateway.spec.ts` — exact gateway test pattern
- `apps/api/src/modules/housekeeping/housekeeping.module.ts` — exact module registration pattern
- `apps/api/src/modules/guests/guests.controller.ts` — confirmed existing routes
- `apps/api/src/modules/guests/guests.service.ts` — confirmed GuestLike type + transformer methods
- `apps/api/src/modules/guests/guests.repository.ts` — confirmed findAll shape
- `apps/api/prisma/schema.prisma` — confirmed Guest/User models + existing enums
- `apps/web/src/features/housekeeping/useHousekeepingSocket.ts` — exact frontend socket pattern
- `apps/web/src/features/guests/GuestsPage.tsx` — confirmed 191L + current columns
- `apps/web/src/features/guests/guests.api.ts` — confirmed query key pattern + existing queries
- `apps/web/src/features/auth/auth.store.ts` — confirmed user.id + user.name fields
- `apps/web/src/router.tsx` — confirmed route registration pattern
- `apps/web/src/App.tsx` — confirmed minimal wrapper (safe to add Toaster)
- `apps/web/package.json` — confirmed sonner ABSENT, date-fns ABSENT
- `apps/api/package.json` — confirmed @nestjs/websockets, socket.io, date-fns ^4.1.0 present
- `apps/api/prisma/migrations/` listing — confirmed last migration timestamp
- `.planning/phases/16-guest-detail-deep-links-contact-events/16-CONTEXT.md` — locked decisions
- `.planning/phases/15-extended-contact-capture/15-CLOSEOUT.md` — Phase 15 deliverables

### Secondary (MEDIUM confidence)
- `apps/api/src/auth/strategies/jwt.strategy.ts` — JWT_ACCESS_SECRET pattern (informed Gateway auth)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json files
- Architecture: HIGH — patterns copied verbatim from existing, working code
- Pitfalls: HIGH — identified from direct code inspection (types, missing deps, migration timestamps)
- Socket.io multi-gateway: HIGH — confirmed NestJS supports multiple gateways on same namespace

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (stable stack — NestJS 11.x, Socket.io 4.x, Vitest 4.x)

---

## RESEARCH COMPLETE
