# Architecture Research

**Domain:** Hotel PMS + Booking Engine + AI Assistant (Single-Tenant)
**Researched:** 2026-05-13
**Confidence:** HIGH (NestJS/DDD patterns) | MEDIUM (overbooking strategy, AI integration) | HIGH (frontend patterns)

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                  │
│  ┌────────────────────────┐   ┌───────────────────────────────────┐  │
│  │   PMS (Staff SPA)      │   │   Booking Engine (Public SPA)     │  │
│  │   React 18 + Vite      │   │   React 18 + Vite                 │  │
│  │   Zustand + TanStack Q │   │   TanStack Query only             │  │
│  └──────────┬─────────────┘   └──────────────┬────────────────────┘  │
│             │ HTTP + WS                        │ HTTP only             │
└─────────────┼──────────────────────────────────┼──────────────────────┘
              │                                  │
┌─────────────┼──────────────────────────────────┼──────────────────────┐
│             │         API GATEWAY LAYER         │                      │
│      ┌──────▼──────────────────────────────────▼──────┐               │
│      │            NestJS Monolith (Railway)             │               │
│      │  JWT Guard  |  RBAC Guard  |  WS Gateway        │               │
│      └───────────────────────────┬─────────────────────┘               │
│                                  │                                      │
│  ┌───────────────────────────────▼──────────────────────────────────┐  │
│  │                    BOUNDED CONTEXT MODULES                        │  │
│  │                                                                   │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │  │
│  │  │   auth   │ │ inventory│ │  pricing │ │  guests  │            │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │  │
│  │  │reservat. │ │operations│ │housekeep.│ │reporting │            │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │  │
│  │  ┌──────────┐ ┌──────────┐                                       │  │
│  │  │ai-assist.│ │ channels │                                       │  │
│  │  └──────────┘ └──────────┘                                       │  │
│  │                                                                   │  │
│  │  ┌───────────────────────────────────────────────────────────┐   │  │
│  │  │                   shared-kernel (lib)                     │   │  │
│  │  │  Money | DateRange | GuestId | RoomId | ReservationId     │   │  │
│  │  └───────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
              ┌────────────────▼────────────────┐
              │         DATA LAYER               │
              │   PostgreSQL (Railway add-on)     │
              │   Single schema with pg-schemas  │
              │   Prisma ORM (type-safe)         │
              └──────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Owns |
|-----------|---------------|------|
| `auth` | Login, JWT issue/refresh, RBAC role resolution | `User`, `Role`, `Permission` |
| `inventory` | Room CRUD, room type definitions, physical room state | `Room`, `RoomType` |
| `pricing` | Rate plans, seasons, multipliers, min-night rules | `RatePlan`, `Season`, `PricingRule` |
| `guests` | Guest profile, document data, stay history | `Guest` |
| `reservations` | Booking lifecycle, availability query, overbooking guard | `Reservation`, `AvailabilitySlot` |
| `operations` | Check-in/out workflow, folio, charges | `Folio`, `FolioItem`, `Stay` |
| `housekeeping` | Room cleaning state machine, assignments | `HousekeepingTask`, `CleaningStatus` |
| `reporting` | KPI aggregation, exportable reports | read-only projections only |
| `ai-assistant` | LLM conversation, tool dispatch, PMS read access | `Conversation`, `Message` |
| `channels` | Reservation source metadata (data model only, v1) | `Channel`, `source` field on `Reservation` |
| `shared-kernel` | Value objects, IDs, Money, DateRange, domain events | no DB tables — pure TypeScript |

---

## NestJS Module Organization

### One module per bounded context. No exceptions.

Each module is a NestJS `@Module()` with its own:
- `*.module.ts` — wires providers, imports, exports
- `*.controller.ts` — HTTP REST handlers (interface layer)
- `*.service.ts` — application service / use case orchestrator
- `*.repository.ts` — Prisma-backed data access (infrastructure)
- `domain/` — entities, value objects, domain services
- `dto/` — request/response shapes (never leak Prisma types)
- `*.gateway.ts` — Socket.io gateway (only in modules that push realtime events)

### Recommended Backend Structure

```
apps/
  api/
    src/
      modules/
        auth/
          auth.module.ts
          auth.controller.ts
          auth.service.ts
          strategies/           # JWT, local
          guards/               # JwtGuard, RolesGuard
          dto/
        inventory/
          inventory.module.ts
          inventory.controller.ts
          inventory.service.ts
          inventory.repository.ts
          domain/
            room.entity.ts
            room-type.entity.ts
            room-status.enum.ts  # state machine values
          dto/
        pricing/
          pricing.module.ts
          pricing.service.ts
          pricing.repository.ts
          domain/
            rate-plan.entity.ts
            season.entity.ts
          dto/
        guests/
          ...
        reservations/
          reservations.module.ts
          reservations.controller.ts
          reservations.service.ts
          reservations.repository.ts
          availability.service.ts   # availability calculation lives HERE
          domain/
            reservation.entity.ts
            reservation-status.enum.ts
          dto/
        operations/
          operations.module.ts
          operations.controller.ts
          checkin.service.ts
          checkout.service.ts
          folio.service.ts
          folio.repository.ts
          domain/
            folio.entity.ts
            folio-item.entity.ts
          dto/
        housekeeping/
          housekeeping.module.ts
          housekeeping.controller.ts
          housekeeping.service.ts
          housekeeping.gateway.ts   # Socket.io gateway for realtime push
          domain/
            cleaning-status.enum.ts  # state machine
          dto/
        reporting/
          reporting.module.ts
          reporting.controller.ts
          reporting.service.ts     # read-only queries, no domain logic
          dto/
        ai-assistant/
          ai-assistant.module.ts
          ai-assistant.controller.ts
          ai-assistant.service.ts
          tools/                   # one file per LLM tool definition
            availability-tool.ts
            occupancy-tool.ts
            guest-lookup-tool.ts
            folio-summary-tool.ts
          dto/
        channels/
          channels.module.ts       # data model only in v1
      shared-kernel/
        value-objects/
          money.vo.ts
          date-range.vo.ts
        ids/
          typed-ids.ts             # branded types: RoomId, GuestId, etc.
        events/
          domain-event.ts          # base class for domain events
          reservation-created.event.ts
          room-status-changed.event.ts
          checkin-completed.event.ts
        guards/
          roles.guard.ts
        decorators/
          roles.decorator.ts
      prisma/
        schema.prisma
        migrations/
      main.ts
      app.module.ts
```

### Module Dependency Rules (IMPORTANT)

Dependency direction is strict. Lower modules do not import higher ones.

```
auth          → (no module dependencies — only shared-kernel)
inventory     → auth (for guards)
pricing       → inventory (needs RoomType references)
guests        → auth
reservations  → inventory, pricing, guests, shared-kernel
operations    → reservations, inventory, guests, shared-kernel
housekeeping  → inventory, shared-kernel
reporting     → reservations, operations, inventory (read-only)
ai-assistant  → reservations, operations, inventory, guests (read-only service injection)
channels      → reservations (source field population)
```

Cross-module communication uses injected Services, never direct repository access across boundaries.

---

## Critical Invariants and Where They Live

### 1. Overbooking Prevention

**Strategy: defense in depth — domain service + database constraint.**

Layer 1 — Domain service check (optimistic, fast path):
```typescript
// reservations/availability.service.ts
async checkAvailability(roomId: RoomId, range: DateRange): Promise<boolean> {
  const count = await this.prisma.reservation.count({
    where: {
      roomId: roomId.value,
      status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      checkIn: { lt: range.checkOut },
      checkOut: { gt: range.checkIn },
    }
  });
  return count === 0;
}
```

Layer 2 — Database unique constraint (hard guard against race conditions):
```sql
-- In Prisma schema (enforced by PostgreSQL)
-- Partial unique index — no two active reservations for same room overlap
CREATE UNIQUE INDEX reservation_no_overlap
  ON "Reservation" ("roomId", "checkIn", "checkOut")
  WHERE status IN ('CONFIRMED', 'CHECKED_IN');
```

Layer 3 — Pessimistic lock at reservation creation:
```typescript
// Use Prisma transaction with SELECT FOR UPDATE on the room row
await this.prisma.$transaction(async (tx) => {
  // Lock the room row to prevent concurrent booking
  await tx.$executeRaw`SELECT id FROM "Room" WHERE id = ${roomId} FOR UPDATE`;
  const available = await this.checkAvailabilityInTx(tx, roomId, range);
  if (!available) throw new ConflictException('Room not available');
  return tx.reservation.create({ data: { ... } });
});
```

**Ownership: `reservations` module owns all availability logic.** The `operations` module consults it but never calculates availability independently.

### 2. Room State Machine

**Owner: `inventory` module (physical state) + `housekeeping` module (cleaning state).**

These are two orthogonal state dimensions on a room:

```
PHYSICAL STATE (inventory)           CLEANING STATE (housekeeping)
──────────────────────────           ────────────────────────────
AVAILABLE                            CLEAN
OCCUPIED                             DIRTY
OUT_OF_SERVICE                       IN_PROGRESS
ON_HOLD                              INSPECTION
                                     OUT_OF_ORDER

Valid transitions (physical):        Valid transitions (cleaning):
AVAILABLE → OCCUPIED (check-in)      DIRTY → IN_PROGRESS (assign)
OCCUPIED → AVAILABLE (check-out)     IN_PROGRESS → INSPECTION (done)
AVAILABLE → OUT_OF_SERVICE (maint.)  INSPECTION → CLEAN (approved)
OUT_OF_SERVICE → AVAILABLE (fixed)   CLEAN → DIRTY (check-out trigger)
```

Domain rules enforced in service layer:
- Cannot check-in to OCCUPIED or OUT_OF_SERVICE room
- Check-out triggers DIRTY event in housekeeping module
- OUT_OF_SERVICE room is excluded from availability queries

```typescript
// inventory/domain/room-status.enum.ts
export enum PhysicalStatus { AVAILABLE = 'AVAILABLE', OCCUPIED = 'OCCUPIED', OUT_OF_SERVICE = 'OUT_OF_SERVICE', ON_HOLD = 'ON_HOLD' }

// inventory/domain/room.entity.ts
transitionTo(next: PhysicalStatus): void {
  const allowed: Record<PhysicalStatus, PhysicalStatus[]> = {
    [PhysicalStatus.AVAILABLE]: [PhysicalStatus.OCCUPIED, PhysicalStatus.OUT_OF_SERVICE, PhysicalStatus.ON_HOLD],
    [PhysicalStatus.OCCUPIED]: [PhysicalStatus.AVAILABLE],
    [PhysicalStatus.OUT_OF_SERVICE]: [PhysicalStatus.AVAILABLE],
    [PhysicalStatus.ON_HOLD]: [PhysicalStatus.AVAILABLE, PhysicalStatus.OUT_OF_SERVICE],
  };
  if (!allowed[this.status].includes(next)) throw new DomainException(`Invalid transition ${this.status} → ${next}`);
  this.status = next;
}
```

### 3. Folio Integrity

**Owner: `operations` module.**

A folio is the running bill for a stay. Rules:
- Only one open folio per active stay (enforced by DB unique constraint on `stayId` where `status = 'OPEN'`)
- Charges can be added to an OPEN folio only
- Check-out closes the folio and generates a snapshot; closed folios are immutable
- No folio line item can be deleted — only voided (soft-delete with `voidedAt` timestamp and reason)

---

## Prisma Schema Strategy

**Single `schema.prisma` file, single PostgreSQL database, logical separation via model naming prefixes and Prisma's `@@map` annotation.**

Do NOT use PostgreSQL schemas (namespaces) in v1 — they add complexity with minimal benefit at single-tenant scale and Prisma's multi-schema support is still experimental as of 2025.

Logical separation approach:
```prisma
// All models in one schema.prisma
// Naming convention makes context ownership visible

model Room {           // inventory context
  id          String   @id @default(cuid())
  number      String   @unique
  typeId      String
  type        RoomType @relation(...)
  physStatus  PhysicalStatus @default(AVAILABLE)
  @@map("rooms")
}

model Reservation {   // reservations context
  id          String   @id @default(cuid())
  roomId      String
  guestId     String
  checkIn     DateTime
  checkOut    DateTime
  status      ReservationStatus
  source      String   @default("DIRECT") // channels context hook
  @@map("reservations")
}

model Folio {         // operations context
  id          String   @id @default(cuid())
  stayId      String   @unique  // DB-enforced: one open folio per stay
  status      FolioStatus
  items       FolioItem[]
  @@map("folios")
}
```

---

## Shared Kernel

Shared types that cross context boundaries. These are pure TypeScript — no Prisma models, no NestJS decorators.

| Type | Kind | Used By |
|------|------|---------|
| `Money` | Value Object | pricing, operations, reporting |
| `DateRange` | Value Object | reservations, pricing, reporting, ai-assistant |
| `RoomId` | Branded type (`string & { _brand: 'RoomId' }`) | inventory, reservations, operations, housekeeping |
| `GuestId` | Branded type | guests, reservations, operations |
| `ReservationId` | Branded type | reservations, operations, channels |
| `DomainEvent` | Base class | all modules that emit events |
| `ReservationCreatedEvent` | Domain event | reservations → housekeeping, channels |
| `RoomStatusChangedEvent` | Domain event | inventory/housekeeping → WS gateway |
| `CheckinCompletedEvent` | Domain event | operations → housekeeping, reporting |

```typescript
// shared-kernel/value-objects/money.vo.ts
export class Money {
  private constructor(readonly amount: number, readonly currency: string) {
    if (amount < 0) throw new Error('Money cannot be negative');
  }
  static of(amount: number, currency = 'COP'): Money {
    return new Money(Math.round(amount * 100) / 100, currency);
  }
  add(other: Money): Money {
    if (other.currency !== this.currency) throw new Error('Currency mismatch');
    return Money.of(this.amount + other.amount, this.currency);
  }
}

// shared-kernel/value-objects/date-range.vo.ts
export class DateRange {
  private constructor(readonly checkIn: Date, readonly checkOut: Date) {
    if (checkOut <= checkIn) throw new Error('checkOut must be after checkIn');
  }
  static of(checkIn: Date, checkOut: Date): DateRange {
    return new DateRange(checkIn, checkOut);
  }
  get nights(): number {
    return Math.round((this.checkOut.getTime() - this.checkIn.getTime()) / 86_400_000);
  }
  overlaps(other: DateRange): boolean {
    return this.checkIn < other.checkOut && this.checkOut > other.checkIn;
  }
}
```

---

## AI Assistant Integration Pattern

**Pattern: Explicit Tool Calling with read-only service facade.**

The AI assistant must not have direct database access. It calls named tools that are thin wrappers around existing read-only service methods.

```
Staff user
    │ POST /api/ai/chat { message }
    ▼
AiAssistantController
    │
    ▼
AiAssistantService
    │  Builds messages array + tools array
    │  Calls Anthropic SDK client.messages.create(...)
    ▼
Claude (Anthropic API)
    │  Returns tool_use blocks
    ▼
AiAssistantService.dispatchTool(toolName, toolInput)
    │  Routes to injected read-only service methods
    │  NEVER writes to DB
    │  NEVER accepts raw SQL from LLM
    ▼
PmsReadFacade (injected from reservations, inventory, guests, operations)
    │
    ▼
Returns structured data → appended to messages as tool_result
    │
    ▼
Claude generates final text response
    │
    ▼
AiAssistantController returns { reply: string, conversationId }
```

**Defined tools (v1):**

| Tool Name | Service Method | Description |
|-----------|---------------|-------------|
| `get_availability` | `ReservationsService.getAvailability(dateRange)` | Available rooms for a date range |
| `get_occupancy_kpi` | `ReportingService.getOccupancy(dateRange)` | Occupancy % for a period |
| `find_guest` | `GuestsService.findByName(name)` | Guest lookup by name |
| `get_reservation` | `ReservationsService.findById(id)` | Single reservation detail |
| `get_checkins_today` | `OperationsService.getTodayCheckins()` | Expected arrivals for today |
| `get_checkouts_today` | `OperationsService.getTodayCheckouts()` | Expected departures for today |
| `get_folio_summary` | `OperationsService.getFolioSummary(reservationId)` | Folio totals for a stay |

**Security rules:**
1. All tools are read-only — no create/update/delete in tool handlers, ever.
2. Tool input is validated with class-validator DTOs before calling any service.
3. The LLM never receives raw database rows — service methods return sanitized DTOs.
4. Conversation history is stored server-side (DB); the client only receives the assistant's latest reply.
5. AI assistant routes require `JwtGuard` + `RolesGuard` (staff only, not exposed to booking engine public routes).

```typescript
// ai-assistant/ai-assistant.service.ts (simplified)
async chat(userId: string, message: string, conversationId?: string): Promise<string> {
  const history = await this.loadHistory(conversationId);
  const response = await this.anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT, // strict: "you are a read-only PMS assistant"
    messages: [...history, { role: 'user', content: message }],
    tools: PMS_TOOLS,      // static array of tool definitions
  });

  if (response.stop_reason === 'tool_use') {
    const results = await Promise.all(
      response.content
        .filter(b => b.type === 'tool_use')
        .map(b => this.dispatchTool(b.name, b.input))
    );
    // append tool results and recurse once
    return this.continueWithToolResults(history, message, response, results, conversationId);
  }

  await this.saveHistory(conversationId, message, response);
  return extractText(response);
}
```

---

## Frontend Architecture

### Feature Folder Structure (aligned to bounded contexts)

```
apps/
  pms/               # Staff application
    src/
      features/
        auth/
          components/    LoginForm, ProtectedRoute
          hooks/         useAuth, useCurrentUser
          store/         authStore.ts (Zustand — persisted token/user)
        reservations/
          components/    ReservationCalendar, ReservationForm, ReservationCard
          hooks/         useReservations, useAvailability
          queries/       reservation.queries.ts   (TanStack Query queryOptions)
        inventory/
          components/    RoomGrid, RoomCard, RoomForm
          hooks/         useRooms
          queries/       room.queries.ts
        pricing/
          components/    RatePlanTable, SeasonForm
          queries/       pricing.queries.ts
        guests/
          components/    GuestForm, GuestHistory
          queries/       guest.queries.ts
        operations/
          components/    CheckinWizard, CheckoutFlow, FolioView
          hooks/         useCheckin, useCheckout, useFolio
          queries/       operations.queries.ts
        housekeeping/
          components/    HousekeepingBoard, TaskCard
          hooks/         useHousekeepingSocket  (Socket.io subscription)
          queries/       housekeeping.queries.ts
        reporting/
          components/    KpiDashboard, ReportFilter, ExportButton
          queries/       reporting.queries.ts
        ai-assistant/
          components/    ChatPanel, MessageBubble, ToolResultDisplay
          hooks/         useChat
          queries/       ai.queries.ts
      shared/
        components/      Button, Modal, Table, Badge, Spinner (atomic UI)
        hooks/           useToast, useConfirm
        lib/             apiClient.ts (Axios instance with JWT interceptor)
        types/           shared DTOs mirroring backend shared-kernel
      app/
        router.tsx       React Router v6 with lazy-loaded feature routes
        providers.tsx    QueryClient, SocketProvider, AuthProvider
  booking-engine/    # Public booking application (lean — no Zustand needed)
    src/
      features/
        search/          Availability search form
        results/         Room listing
        booking/         Guest form + booking confirmation
```

**State management split:**
- TanStack Query: ALL server state (reservations, rooms, guests, KPIs). Never duplicated in Zustand.
- Zustand: ONLY pure UI/client state — auth token/user session, open modals, sidebar collapsed state, AI chat panel open state.
- Socket.io: housekeeping board live updates, reservation calendar refresh events.

### Container-Presentational remains valid for this stack:
- Containers = feature hooks that call TanStack Query + dispatch mutations
- Presentational = pure components receiving props, no direct query calls inside them
- This keeps components testable and reusable across contexts

---

## Realtime Architecture

**Rule: WebSocket for push (server-initiated). HTTP for pull (client-initiated).**

| Event | Transport | Direction | Module |
|-------|-----------|-----------|--------|
| Room cleaning status changed | WebSocket | server → client | housekeeping |
| Reservation created/cancelled | WebSocket | server → client | reservations |
| Check-in completed | WebSocket | server → client | operations |
| Check-out completed | WebSocket | server → client | operations |
| New charge added to folio | WebSocket | server → client | operations |
| AI assistant reply | HTTP (polling not needed — response awaited) | request/response | ai-assistant |
| Availability query (booking engine) | HTTP REST | request/response | reservations |
| Report export | HTTP REST (streaming/presigned URL) | request/response | reporting |
| CRUD operations | HTTP REST | request/response | all modules |

**Socket.io room strategy:**
```
socket.join(`hotel:staff`)            // all authenticated staff
socket.join(`housekeeping:floor:${n}`) // floor-specific housekeepers
socket.join(`room:${roomId}`)          // room-specific updates
```

Events are emitted from NestJS services using the injected `EventEmitter2` (or via the housekeeping gateway directly). The Socket.io gateway subscribes to domain events via NestJS's `@OnEvent()` decorator.

```typescript
// housekeeping/housekeeping.gateway.ts
@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL } })
export class HousekeepingGateway {
  @WebSocketServer() server: Server;

  @OnEvent('room.status.changed')
  handleRoomStatusChanged(event: RoomStatusChangedEvent) {
    this.server.to('hotel:staff').emit('room:statusUpdate', {
      roomId: event.roomId,
      status: event.newStatus,
      updatedAt: event.occurredAt,
    });
  }
}
```

---

## Data Flow: Key Scenarios

### 1. Booking Flow (public booking engine)

```
Guest selects dates + room type
    │ GET /api/bookings/availability?checkIn=&checkOut=&type=
    ▼
ReservationsController
    ▼
AvailabilityService.query(dateRange, roomType)
    → queries reservations (status IN ['CONFIRMED','CHECKED_IN'])
    → queries inventory (physStatus != OUT_OF_SERVICE)
    → queries pricing for rate
    → returns available rooms with price
    │
    ▼ Guest submits form
    │ POST /api/bookings { guestData, roomId, dates }
    ▼
ReservationsController (public, no JWT)
    ▼
ReservationsService.create()
    → validate DateRange VO
    → GuestsService.findOrCreate(guestData)
    → AvailabilityService.checkAvailability() [DB lock]
    → PricingService.calculateTotal(roomId, dateRange)
    → prisma.$transaction: lock room row → insert Reservation
    → emit ReservationCreatedEvent
    → return ReservationConfirmation DTO
```

### 2. Check-In Flow (PMS staff)

```
Receptionist clicks "Check In" on reservation
    │ POST /api/operations/checkin { reservationId }
    ▼
OperationsController (JWT + RBAC: recepcion | admin)
    ▼
CheckinService.execute(reservationId, staffId)
    → ReservationsService.findAndValidate(id)   // status = CONFIRMED?
    → InventoryService.validateRoom(roomId)     // physStatus = AVAILABLE?
    → prisma.$transaction:
        update Reservation status → CHECKED_IN
        update Room physStatus → OCCUPIED
        create Folio (open)
        create Stay record
    → emit CheckinCompletedEvent
    │
    ▼ Event bus
    ├→ HousekeepingGateway: broadcast room:statusUpdate to staff WS
    └→ ReportingService: invalidate today's KPI cache
```

### 3. Housekeeping Update Flow

```
Housekeeper marks room as clean (via PMS mobile-responsive UI)
    │ PATCH /api/housekeeping/tasks/:taskId { status: 'CLEAN' }
    ▼
HousekeepingController (JWT + RBAC: housekeeping | admin)
    ▼
HousekeepingService.updateStatus(taskId, CLEAN)
    → validate state machine transition
    → prisma: update HousekeepingTask.cleaningStatus
    → emit RoomStatusChangedEvent
    │
    ▼ Event bus
    └→ HousekeepingGateway: server.to('hotel:staff').emit('room:statusUpdate')
        → All staff SPAs receive live update
        → ReservationCalendar and HousekeepingBoard re-render immediately
```

### 4. AI Assistant Query Flow

```
Staff types: "How many rooms are occupied tonight?"
    │ POST /api/ai/chat { message, conversationId? }
    ▼
AiAssistantController (JWT + RBAC: all staff roles)
    ▼
AiAssistantService.chat(userId, message)
    → load conversation history from DB
    → call Anthropic SDK with messages + PMS_TOOLS definitions
    │
    ▼ Claude decides to call get_occupancy_kpi tool
    │
    ▼ dispatchTool('get_occupancy_kpi', { date: 'tonight' })
    → ReportingService.getOccupancy(DateRange.tonight())
    → returns { total: 32, occupied: 24, pct: 75.0 }
    │
    ▼ Append tool_result to messages, call Claude again
    │
    ▼ Claude generates: "Tonight 24 of 32 rooms are occupied (75%)"
    │
    ▼ Save assistant reply to Conversation
    → return { reply: "Tonight 24 of 32...", conversationId }
```

---

## Build Order (Foundation First)

Dependencies cascade upward. Lower items must exist before higher items.

```
Phase 1 — Foundation (no inter-module deps)
  ├─ shared-kernel (value objects, branded IDs, base domain event)
  ├─ Prisma schema (all models, migrations)
  └─ auth module (JWT, guards, RBAC — everything else depends on this)

Phase 2 — Core Inventory + Pricing
  ├─ inventory module (rooms, types — other modules need room references)
  └─ pricing module (depends on inventory for room type)

Phase 3 — Reservations (depends on inventory + pricing + guests)
  ├─ guests module (simple CRUD, no complex deps)
  └─ reservations module (availability logic, booking flow — the core invariant)

Phase 4 — Operations (depends on reservations + inventory)
  └─ operations module (check-in/out, folio — needs active reservation + room)

Phase 5 — Housekeeping (depends on inventory, triggered by operations)
  └─ housekeeping module + Socket.io gateway

Phase 6 — Reporting (depends on all above — read-only aggregations)
  └─ reporting module

Phase 7 — AI Assistant (depends on reporting + reservations + operations + guests)
  └─ ai-assistant module + tool definitions

Phase 8 — Channels (data model already in schema from Phase 1)
  └─ channels module (just populates source field, no complex logic)
```

---

## Architectural Patterns

### Pattern 1: Domain Event Bus for Cross-Module Coordination

**What:** Modules emit domain events via NestJS `EventEmitter2`. Other modules react via `@OnEvent()` handlers. No direct module-to-module method calls for side effects.

**When to use:** Whenever an action in module A should trigger a side effect in module B (check-out → housekeeping dirty, check-in → folio creation).

**Trade-offs:** Decouples modules cleanly. Harder to trace flow; use structured logging with correlation IDs.

```typescript
// operations/checkin.service.ts
this.eventEmitter.emit('checkin.completed', new CheckinCompletedEvent(reservationId, roomId));

// housekeeping/housekeeping.service.ts
@OnEvent('checkin.completed')
async handleCheckin(event: CheckinCompletedEvent) {
  await this.createCleaningTask(event.roomId);
}
```

### Pattern 2: Read-Only Facade for Cross-Module Reads

**What:** When module A needs to READ data from module B, B exports a read-only facade service that exposes minimal methods. A imports B's facade, not B's full service or repository.

**When to use:** reporting, ai-assistant reading from other modules.

**Trade-offs:** Slightly more boilerplate. Prevents "reporting" from accidentally triggering business logic.

```typescript
// reservations/reservations-read.facade.ts — exported by reservations.module.ts
@Injectable()
export class ReservationsReadFacade {
  constructor(private readonly prisma: PrismaService) {}
  async getOccupiedRooms(date: Date): Promise<RoomOccupancyDto[]> { ... }
}
```

### Pattern 3: DTO Boundary at Every Layer

**What:** Never let Prisma model types leak out of the repository layer. Services return domain entities or DTOs. Controllers return response DTOs.

**When to use:** Always.

**Trade-offs:** More mapping code. Prevents schema changes from breaking API contracts.

---

## Anti-Patterns

### Anti-Pattern 1: Availability Calculation in Multiple Places

**What people do:** Calculate availability in reservations module AND in ai-assistant AND in booking engine controller.

**Why it's wrong:** Three places = three chances for overbooking bugs when logic diverges.

**Do this instead:** Single `AvailabilityService` in `reservations` module. Everything else calls it.

### Anti-Pattern 2: Storing Server State in Zustand

**What people do:** Fetch reservations, store them in a Zustand store, keep them in sync with the server manually.

**Why it's wrong:** Creates cache invalidation bugs, stale data, duplicate state. TanStack Query already does this correctly.

**Do this instead:** Zustand = auth session + UI state only. All reservation/room/guest data lives in TanStack Query cache.

### Anti-Pattern 3: Direct Cross-Module Repository Access

**What people do:** Import `ReservationsRepository` into `HousekeepingService` to query reservations.

**Why it's wrong:** Bypasses domain logic, creates invisible coupling, makes module isolation impossible.

**Do this instead:** Import and call the exported service facade from the reservations module.

### Anti-Pattern 4: Raw SQL Through the AI

**What people do:** Give the LLM a `run_sql` tool with direct DB access.

**Why it's wrong:** Prompt injection can exfiltrate any data in the schema. No audit trail. Zero constraint on what gets queried.

**Do this instead:** Named, scoped tools with typed inputs calling specific service methods. LLM never sees SQL.

---

## Scalability Considerations

| Scale | Architecture Notes |
|-------|-------------------|
| Single hotel (1 property, ~50 rooms, 10 staff) | Current design is correct. Monolith on Railway. No adjustments needed. |
| 10 hotels (multi-tenant v2) | Add `hotelId` tenant discriminator to all models. Move JWT to include `hotelId` claim. Consider connection pooling (PgBouncer). |
| 100+ hotels | Split into microservices along bounded contexts. `reservations` and `operations` are the hot paths. Add Redis for availability cache. |

**First bottleneck for this single hotel:** Real-time dashboard during high-occupancy periods (e.g., 50 staff all connected). Socket.io on a single Railway instance handles this trivially — no concern for v1.

---

## Integration Points

### External Services

| Service | Integration | Module | Notes |
|---------|-------------|--------|-------|
| Anthropic API | SDK (`@anthropic-ai/sdk`) | ai-assistant | API key in env var, never in code |
| Railway PostgreSQL | Prisma `DATABASE_URL` env | prisma (global) | Connection pooling via `connection_limit` in URL |
| SMTP (future) | Nodemailer | operations | Not in v1; hook point in `CheckinCompletedEvent` handler |

### Internal Module Boundaries

| Boundary | Communication | Direction |
|----------|---------------|-----------|
| operations → reservations | Service injection (read + status update) | operations reads reservation, updates status |
| operations → inventory | Service injection (room status update) | operations updates room physStatus on checkin/out |
| housekeeping → inventory | Service injection (read room data) | housekeeping reads room, emits events on clean |
| operations → housekeeping | Domain event `CheckoutCompletedEvent` | operations triggers dirty status via event |
| ai-assistant → all | Read-only facade injection | ai-assistant reads, never writes |
| reporting → all | Read-only facade injection | reporting reads, never writes |

---

## Sources

- [Structuring Your Project with Bounded Contexts in NestJS](https://codanyks.hashnode.dev/structuring-your-project-with-bounded-contexts-in-nestjs) — HIGH confidence
- [NestJS Official WebSockets Docs](https://docs.nestjs.com/websockets/gateways) — HIGH confidence
- [Hotel Booking Schema Design Comparison](https://dev.to/sumedhbala/hotel-booking-schema-design-comparison-g3h) — MEDIUM confidence
- [Solving Double Booking at Scale](https://itnext.io/solving-double-booking-at-scale-system-design-patterns-from-top-tech-companies-4c5a3311d8ea) — MEDIUM confidence
- [PostgreSQL Explicit Locking Docs](https://www.postgresql.org/docs/current/explicit-locking.html) — HIGH confidence
- [Federated State: Zustand + TanStack Query](https://dev.to/martinrojas/federated-state-done-right-zustand-tanstack-query-and-the-patterns-that-actually-work-27c0) — HIGH confidence
- [Prisma Multi-Schema Docs](https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema) — HIGH confidence
- [Container/Presentational Pattern](https://www.patterns.dev/react/presentational-container-pattern/) — HIGH confidence
- [PostgreSQL MCP Security Patterns](https://blog.dreamfactory.com/postgresql-mcp-server) — MEDIUM confidence (AI data access pattern reference)

---
*Architecture research for: Hotel PMS + Booking Engine + AI Assistant*
*Researched: 2026-05-13*
