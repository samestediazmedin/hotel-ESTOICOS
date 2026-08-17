# Pitfalls Research

**Domain:** Hotel PMS + Public Booking Engine + AI Assistant (Single-tenant, NestJS/Prisma/PostgreSQL/Railway)
**Researched:** 2026-05-13
**Confidence:** HIGH (overbooking, DB, Railway, AI safety) / MEDIUM (night audit, folio, PII)

---

## Critical Pitfalls

### Pitfall 1: Overbooking Race Condition

**What goes wrong:**
Two guests submit simultaneous booking requests for the same room on the same dates. Both read availability as "free", both pass the validation check, and both write to the database — resulting in two confirmed reservations for one room. This is the single most commonly underestimated concurrency bug in booking systems.

**Why it happens:**
Developers implement availability checks as a read-then-write pattern at the application layer without a database-level guard. In NestJS with Prisma, the naive flow is:
1. `prisma.reservation.count({ where: { roomId, dateRange } })` → returns 0
2. `prisma.reservation.create(...)` → both requests reach this step concurrently

Prisma does not have native `SELECT FOR UPDATE` support in its standard query API. Issue #17136 and #1918 on the Prisma GitHub tracker (open since 2021) confirm this limitation. Using `prisma.$executeRaw` with explicit SQL locks or a version-column-based optimistic check are the available workarounds.

**How to avoid:**
Use a **database-level uniqueness constraint** as the last line of defense — no application code can bypass it.

Option A (recommended for this project — single-tenant, low concurrency):
```sql
-- Unique partial index: no two CONFIRMED reservations for same room overlap
CREATE UNIQUE INDEX reservation_no_overlap
ON reservations (room_id, check_in_date, check_out_date)
WHERE status NOT IN ('cancelled', 'no_show');
```
This alone is insufficient for range overlaps. Combine with a PostgreSQL **exclusion constraint** using `btree_gist`:
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE reservations
  ADD CONSTRAINT no_overlapping_reservations
  EXCLUDE USING GIST (
    room_id WITH =,
    daterange(check_in_date, check_out_date, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'no_show'));
```

Option B (application layer, wraps the above):
Use `prisma.$transaction` with `prisma.$executeRaw('SELECT ... FOR UPDATE')` to pessimistically lock the room row before the availability check.

The **two-step soft-hold** pattern (Redis TTL for hold + DB confirm on checkout) is appropriate if you later add a payment step — defer it until v2 payments.

**Warning signs:**
- Availability check and reservation creation are not wrapped in a single atomic transaction
- No exclusion constraint or equivalent DB-level guard exists on the reservations table
- Load testing shows duplicate bookings under concurrent requests

**Phase to address:** Reservations core (Phase implementing `POST /reservations`). Must be present before any public booking endpoint is live.

---

### Pitfall 2: Date/Timezone Mismatch — "The Night That Never Was"

**What goes wrong:**
A hotel operates in local time (e.g., UTC-5). A guest books "check-in June 1, check-out June 3" — meaning 2 nights. The database stores `TIMESTAMPTZ` values in UTC. The night audit runs at midnight UTC (7 PM local). Reports show 3 nights charged instead of 2. Check-in for June 1 guests is blocked because the system thinks it is already June 2.

This is a **two-layer problem**: the date-vs-datetime confusion, and the business-day rollover concept.

**Why it happens:**
1. **TIMESTAMP vs TIMESTAMPTZ**: Using `TIMESTAMP WITHOUT TIME ZONE` means PostgreSQL stores whatever string you send — no conversion, no consistency across DST changes.
2. **Date fields stored as datetime**: `check_in_date DATE` is correct. `check_in_at TIMESTAMPTZ` (actual physical arrival) is different. Mixing them causes off-by-one night bugs.
3. **Business day vs calendar day**: Hotels define their "day" as running from approximately 3:00 AM to 3:00 AM (after the night audit rollover). A guest arriving at 2:00 AM belongs to the *previous* business day. Without a `business_date` concept distinct from `NOW()`, all post-midnight operations miscategorize.

**How to avoid:**
- Store **check-in and check-out as `DATE` columns** (not datetime). Example: `check_in_date DATE NOT NULL`, `check_out_date DATE NOT NULL`. These are hotel-local calendar dates, timezone-agnostic.
- Store **actual physical arrival/departure** as `TIMESTAMPTZ` in separate columns (`arrived_at`, `departed_at`) for audit purposes.
- Implement a `hotel_business_date` configuration value (the PMS "current date", set by night audit). Night audit advances this date, not `NOW()::date`. All nightly posting logic reads `hotel_business_date`, not the system clock.
- Store the hotel's **IANA timezone** (e.g., `America/Bogota`) in config and convert only at the presentation/reporting layer — never in business logic.
- On the NestJS side: use `date-fns-tz` or `luxon` for any timezone-aware display conversion; never use `new Date().toLocaleDateString()` directly.

**Warning signs:**
- Reservations table has `check_in TIMESTAMPTZ` instead of `check_in_date DATE`
- No `hotel_business_date` concept in the system
- Nightly room charge logic uses `new Date()` or `NOW()` directly
- Reports run at midnight show different totals than reports run at 1 AM

**Phase to address:** Database schema design (Phase 1). This cannot be retrofitted — fixing date column types after production data exists requires a full migration with data transformation.

---

### Pitfall 3: Rate Calculation Underestimated as "Just Price × Nights"

**What goes wrong:**
The rate engine is implemented as `room_type.base_price * nights`. The hotel then adds season multipliers, minimum-night requirements, and a long-stay discount. Each rule is bolted on as an `if` statement. After 3 months, the pricing code is an unmaintainable tangle of conditionals that no one can reason about, and generating a folio itemization for audit purposes is impossible.

**Why it happens:**
Rate calculation in hotels has 5+ overlapping rule types:
1. **Base rate** per room type
2. **Season multipliers** (high/mid/low season date ranges)
3. **Minimum nights** (e.g., minimum 2 nights on weekends; minimum 3 nights on holidays)
4. **Stay-through rules** (you may not check in on Saturday if minimum nights for that arrival date is 3, even if Sunday-Tuesday is available)
5. **Long-stay discounts** (7+ nights: -10%)
6. **Promo codes / override rates** (flat or percentage)
7. **Derived rates** (BAR, non-refundable at -15%, etc.)

Rules 3 and 4 interact: a guest searching "Saturday only" must be blocked, but "Saturday + Sunday" must be allowed — this is a **date-range availability intersection problem**, not just a price problem.

**How to avoid:**
Design a `pricing` bounded context with explicit rule types from the start. Do not put pricing logic in the reservation handler. In v1, implement only what is in scope (base rate + season multipliers + minimum nights), but structure it so rules are **composable and stored as data**, not hard-coded as `if` statements.

Recommended data model:
```
RatePlan { id, name, type: BAR|PROMO|PACKAGE }
RateRule  { rate_plan_id, type: SEASON|MIN_NIGHTS|DISCOUNT, priority, conditions: JSON, value }
```

Price calculation becomes: collect applicable rules ordered by priority, apply in sequence, return line-item breakdown (not just a total). The breakdown is mandatory for folio audit.

**Warning signs:**
- Pricing logic lives in the reservation creation service
- `calculateTotal(roomId, checkIn, checkOut)` returns a single number with no breakdown
- No minimum-nights validation at availability search time (only at booking time)

**Phase to address:** Pricing module (implement before booking engine goes live). Minimum viable: base rate + season. Do not skip the rule structure even in MVP.

---

### Pitfall 4: Folio Without an Immutable Ledger

**What goes wrong:**
The folio (guest bill) is implemented as a mutable `charges` array on the reservation. Staff can edit or delete line items. At check-out, the total does not reconcile with what was posted. There is no audit trail. For tax purposes, you cannot prove what was charged and when. The number one financial mistake in PMS implementations is that sub-ledgers do not reconcile to the general ledger.

**Why it happens:**
Developers model the folio as a mutable list for convenience. Deleting a wrong charge is easier than voiding it. No one thinks about auditability until the hotel's accountant asks for a monthly reconciliation report.

**How to avoid:**
Model the folio as an **append-only ledger**. Charges are never deleted — they are **voided** (a new negative entry is posted). This is standard double-entry bookkeeping applied to hotel operations.

```
FolioEntry {
  id, reservation_id, posted_at TIMESTAMPTZ,
  type: ROOM_CHARGE | MANUAL_CHARGE | VOID | ADJUSTMENT | TAX,
  description, quantity, unit_price, amount, posted_by_user_id,
  voided_by_entry_id  -- null unless this entry voids another
}
```

Every check-out generates a **folio snapshot** (sum of all non-voided entries) stored as an immutable record. Even without real payments, this pattern is required for:
- Tax reporting (IVA, impuesto de alojamiento in Colombia)
- Night audit reconciliation
- Dispute resolution ("what did I actually charge room 201 on Tuesday?")

Tax note: Colombia charges IVA (19%) on accommodation services for business travelers; leisure travelers may be exempt. The rate engine must output tax-inclusive and tax-exclusive amounts per line item.

**Warning signs:**
- Charges table has `UPDATE` or `DELETE` operations anywhere in the codebase
- No `posted_by_user_id` on charge entries (not auditable)
- Total is computed as `SUM(charges.amount)` with no concept of voids
- No folio snapshot at check-out

**Phase to address:** Operations module (check-in/check-out/charges). Must be done before any billing report is built.

---

### Pitfall 5: Room State Machine With Missing Transition Guards

**What goes wrong:**
A room is marked "Available" in the availability calendar while simultaneously being in "Out of Order" status in housekeeping. A reservation is created for that room. On arrival day, reception tries to check the guest in — and discovers the room has a broken AC. The root cause: two independent status fields with no enforced relationship.

**Why it happens:**
The room state is modeled as a single `status` enum, but hotels have **two orthogonal dimensions**:
1. **Occupancy axis**: Vacant / Occupied / Reserved
2. **Housekeeping axis**: Dirty / Clean / Inspected / In-Progress
3. **Exception states**: Out of Order (OOO) / Out of Service (OOS)

And the valid states are:
```
Vacant + Dirty    (VC→VD after checkout, before cleaning)
Vacant + Clean    (after cleaning, before inspection)
Vacant + Inspected → this is the ONLY state where a room can be sold
Occupied + Dirty  (overnight, before morning service)
Occupied + Clean  (after room attendant visit)
Out of Order      (removed from inventory entirely — cannot be sold regardless of occupancy)
Out of Service    (temporary, still shows in inventory but blocked)
```

OOO and OOS are critically different: OOO rooms must be excluded from availability queries. OOS rooms may still be "available" in the inventory count depending on hotel policy.

**How to avoid:**
Model as two separate fields with a transition validation layer:
```typescript
type HousekeepingStatus = 'dirty' | 'in_progress' | 'clean' | 'inspected'
type AvailabilityStatus = 'vacant' | 'occupied' | 'out_of_order' | 'out_of_service'
```

Enforce transitions via a domain service (not just Prisma enum validation). Availability queries must filter `WHERE availability_status = 'vacant' AND housekeeping_status = 'inspected'` (or 'clean', per hotel policy).

A WebSocket event (`room.status_changed`) must fire on every transition so the front-end calendar updates in real time.

**Warning signs:**
- Single `status` field on the Room model
- Availability query does not check housekeeping status
- No transition validation (any status → any status is allowed)
- OOO and OOS are treated identically

**Phase to address:** Inventory + Housekeeping modules. The schema must be correct from the start; the transition guards can be added in the Housekeeping phase.

---

### Pitfall 6: AI Assistant Data Leakage and Prompt Injection

**What goes wrong:**
The AI assistant is given read access to PMS data via tool calls. A guest (or a staff member with malicious intent) sends a message that causes the assistant to return another guest's personal data, fabricates a reservation, or leaks system prompt contents including internal API structure. Prompt injection is ranked #1 in OWASP Top 10 for LLMs 2025, appearing in over 73% of assessed production deployments.

**Why it happens:**
LLMs are designed to follow instructions — including instructions embedded in the data they process (indirect prompt injection). The hotel AI assistant processes guest-provided content (names, messages, special requests) that could contain injected instructions. Tool results returned from the PMS API can also carry injected content if they include free-text fields.

**How to avoid:**

1. **Scope tool access strictly**: Each tool available to the AI should return only what is needed for that specific query. Do not give the assistant a "get all guests" tool — give it "get guest by current reservation ID" scoped to the authenticated staff session.

2. **Input/output validation layer**: Wrap every AI tool call result in a sanitization pass before returning to the LLM context. Strip or escape freeform text fields that could contain injection attempts (guest special requests, notes).

3. **System prompt integrity**: Never include actual PMS data in the system prompt. System prompt leakage (OWASP LLM07:2025) is a known attack vector. The system prompt should define capability and constraints, not data.

4. **No write operations in v1**: The AI assistant has read-only PMS access. This is stated in PROJECT.md and must be enforced at the tool definition level — not just in the system prompt (which can be overridden).

5. **Rate limiting on AI endpoint**: Prevent enumeration attacks where an attacker iterates through guest IDs via the assistant.

6. **Audit log all AI tool calls**: Log which tools were called, with what parameters, and what was returned. This is the only way to detect data exfiltration after the fact.

**Warning signs:**
- AI tools accept arbitrary IDs without verifying the requester has permission to access that resource
- Guest free-text fields are injected directly into the LLM context without sanitization
- No audit log for AI tool usage
- System prompt contains data (reservation IDs, guest names, room numbers)

**Phase to address:** AI Assistant module. The read-only constraint must be enforced at the tool layer, not the prompt layer.

---

### Pitfall 7: Night Audit Skipped in MVP, Impossible to Retrofit

**What goes wrong:**
The MVP launches without a night audit / end-of-day process. The hotel runs for 2 months. Reports show correct-looking numbers. Then someone notices that rooms checked out at 11 PM are charged for that night but the date shows as the next day in reports. Reservations spanning midnight are double-counted in daily occupancy reports. The `hotel_business_date` is the system clock, which rolls over at midnight while guests are still active. Retrofitting the night audit requires reprocessing 60 days of historical data.

**Why it happens:**
Night audit feels like a "nice to have" bookkeeping step. Developers think "we can add it later." In reality, it is the **architectural seam** that separates business days. Without it:
- Daily room charges cannot be reliably posted (which day does a 3-night stay's middle night belong to?)
- Occupancy reports have off-by-one errors at midnight
- The `hotel_business_date` concept is undefined, so all date-dependent calculations are ambiguous

**What night audit actually does:**
1. Posts automated room charges for all in-house guests (today's night rate → their folio)
2. Advances the `hotel_business_date` from today to tomorrow
3. Generates daily summary reports (occupancy, revenue by department)
4. Marks no-shows (reservations with `check_in_date = today` and `status = 'confirmed'` but no check-in)
5. Rolls pending housekeeping assignments to the new day

**How to avoid:**
Implement a minimal night audit in the same phase as the folio/charges system. It does not need a manual trigger or a dedicated UI in v1 — a scheduled job (`@Cron` in NestJS) running at 3:00 AM hotel-local-time is sufficient. The key is that `hotel_business_date` exists as a system setting and is the single source of truth for "what day is it in the hotel."

```typescript
// NestJS CronJob — runs at 03:00 hotel local time
@Cron('0 3 * * *', { timeZone: 'America/Bogota' })
async runNightAudit() {
  await this.folioService.postNightlyRoomCharges(this.systemConfig.hotelBusinessDate);
  await this.reservationService.markNoShows(this.systemConfig.hotelBusinessDate);
  await this.systemConfig.advanceBusinessDate();
  await this.reportingService.generateDailySummary(this.systemConfig.hotelBusinessDate);
}
```

**Warning signs:**
- No `hotel_business_date` field in system configuration table
- Room charges are posted manually only
- Daily occupancy is calculated from `NOW()::date` directly
- No-show logic does not exist

**Phase to address:** Operations module (same phase as check-in/check-out and folio). Cannot be deferred.

---

### Pitfall 8: PII / Guest Data Without a Retention and Deletion Strategy

**What goes wrong:**
Guest passport numbers, national IDs, email addresses, and phone numbers accumulate indefinitely in the database. A data subject request arrives ("delete all my data"). There is no mechanism to comply. If the hotel operates in Colombia and serves EU nationals, GDPR applies. Colombian Ley 1581 (Habeas Data) applies regardless. Fines up to 4% of annual revenue or €20M for GDPR violations.

**Why it happens:**
Data protection is treated as a legal problem, not a technical one. No one designs the schema with deletion in mind. Soft-delete patterns (`deleted_at`) are insufficient — they keep PII in the database. Anonymization and deletion are different operations.

**How to avoid:**

1. **Classify PII at schema design time**: Mark which fields are PII in the schema comments/documentation. For HotelOS: `Guest.full_name`, `Guest.email`, `Guest.phone`, `Guest.document_type`, `Guest.document_number`, `Guest.nationality` are all PII.

2. **Implement guest anonymization** (not deletion): When a guest requests erasure, replace PII fields with anonymized values (`"DELETED_USER_${hash}"`) and set a `anonymized_at` timestamp. Historical reservation records (dates, room, total) can be retained for financial/tax compliance — only the identifying information is removed. Colombia's tax retention requirement is 5 years (Estatuto Tributario Art. 632).

3. **Encryption at rest for document numbers**: Passport/ID numbers are sensitive. Encrypt them in the database (PostgreSQL `pgcrypto` or application-level encryption). Store only what is legally required by the hotel's jurisdiction.

4. **Data minimization**: In v1, collect only what is operationally required (name, contact, document for police registry). Do not collect date of birth, nationality, or address unless required by local regulation.

5. **Role-based PII access**: `housekeeping` role must not see guest document numbers. RBAC must be enforced at the API layer, not just the UI.

**Warning signs:**
- No `anonymized_at` field on Guest model
- Document numbers stored as plain text
- No data retention policy documented
- RBAC does not filter PII fields by role in API responses

**Phase to address:** Guest module (schema phase). Encryption and anonymization logic must be in place before any guest data is written to production.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Checking availability at app layer only (no DB constraint) | Faster to write | Overbooking in production under concurrent load | Never — add the exclusion constraint even in MVP |
| `TIMESTAMP` instead of `DATE` for check-in/check-out | Slightly more flexible | Date arithmetic bugs, off-by-one nights, timezone corruption | Never for hotel dates |
| Single `status` field on Room | Simpler model | Cannot represent housekeeping + availability independently | Never — use two fields from the start |
| Mutable charges (allow DELETE on folio entries) | Easier to "fix" mistakes | No audit trail, tax non-compliance | Never — use void entries instead |
| Skip night audit, use `NOW()::date` for business date | Saves 1-2 days of dev | Daily reports break, no-shows undetected, room charges misposted | Never — implement minimal version in same phase as folio |
| In-line pricing logic in reservation handler | Fast to ship | Untestable, impossible to extend, no rate breakdown for folio | Acceptable only for a 48h prototype; never in production code |
| AI assistant writes to PMS via tools | More powerful feature | Data integrity risk, hallucinated mutations, prompt injection | Never in v1 — read-only is the constraint |
| Store all guest fields unencrypted | Simpler queries | GDPR/Ley 1581 non-compliance, data breach liability | Never for document numbers and passport data |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Railway PostgreSQL | Prisma opens connection pool per process; default `connection_limit` of 5–10 × CPU can exhaust Railway's 100-connection cap if multiple dynos run | Set `connection_limit` explicitly in `DATABASE_URL`: `?connection_limit=5`. Use Railway's PgBouncer (Transaction mode) for multi-process. Keep Prisma `$connect()` as singleton — never instantiate PrismaClient per request. |
| Railway PostgreSQL + Prisma Migrate | Running `prisma migrate deploy` through PgBouncer fails (prepared statements not compatible with Transaction mode) | Use a separate `DIRECT_DATABASE_URL` without PgBouncer for migrations only. Set `directUrl` in Prisma schema datasource. |
| Anthropic SDK (Claude) | Sending full PMS context in every message inflates token cost and increases latency per turn | Use Claude's tool-use pattern: the assistant calls scoped tools to fetch only the data it needs, rather than pre-loading all reservations into the context. |
| Socket.io on Railway | Railway containers do not support sticky sessions by default; Socket.io's in-memory adapter fails when multiple instances run | Use `@socket.io/redis-adapter` with Railway Redis add-on, OR configure Railway to always run a single instance of the backend (sufficient for single-tenant hotel). |
| Socket.io reconnection | Client reconnects after server restart and requests all missed events; server has no state → silent data loss | Enable Socket.io v4.6+ connection state recovery (`connectionStateRecovery`) with a 2-minute buffer. For events older than 2 minutes, implement a "fetch current state on reconnect" call from the client. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Availability query scanning all reservations without index | Calendar page loads slowly; `EXPLAIN` shows sequential scan | Index on `(room_id, check_in_date, check_out_date)` plus a partial index on `status != 'cancelled'` | Above ~10,000 reservations (roughly 3 years of operation for a 30-room hotel) |
| Emitting WebSocket events inside database transaction | Room status updates trigger WS events before the transaction commits; clients receive events for data that may roll back | Emit WebSocket events only after the database transaction commits successfully (use `afterCommit` hooks or post-transaction callbacks) | Any time there is a rollback under load |
| N+1 on reservation list with guest + room data | Slow PMS dashboard; each reservation triggers 2 extra queries | Use Prisma `include: { guest: true, room: { include: { roomType: true } } }` on list queries | Above ~50 reservations on a single page |
| Nightly room charge job running in HTTP request context | Night audit times out at the HTTP gateway (Railway's default 60s timeout) | Run night audit as a `@Cron` job in NestJS (not an HTTP endpoint). Ensure Railway does not sleep the process during the cron window. | First time a guest has a long stay with many charge lines |
| Generating reports by re-querying raw reservation data | RevPAR/ADR reports rebuild from scratch every request, slow at month-end | Add a `daily_snapshot` table populated by night audit — reports read from snapshots, not raw reservations | Month-end reports with 30+ days of data |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Housekeeping role can read guest PII (document numbers, email) | Internal data exposure; GDPR violation | RBAC at the API serialization layer — roles get different DTO shapes, not just different routes |
| AI tool calls not scoped to authenticated user's hotel context | In multi-tenant future, data leakage across hotels | Scope all AI tool queries with `hotelId` from the JWT; never accept resource IDs from the AI response without re-validating ownership |
| Booking engine allows enumeration of guest profiles | Attacker can harvest guest data by guessing reservation IDs | Reservation confirmation numbers should be opaque slugs (e.g., UUID or base62), not sequential integers |
| JWT refresh tokens stored in `localStorage` | XSS attack steals refresh token, permanent session hijack | Store refresh tokens in `httpOnly; Secure; SameSite=Strict` cookies; access tokens in memory only |
| Night audit endpoint exposed without auth (for "easy cron triggers") | Anyone can trigger billing charges externally | Night audit must be a scheduled internal job (`@nestjs/schedule`), never an unauthenticated HTTP endpoint |
| System prompt includes `DATABASE_URL` or internal URLs | System prompt leakage exposes connection strings | System prompt contains no secrets — only capability description and constraints. All config comes from `process.env` on the server, never in the prompt. |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Date picker does not enforce check-out > check-in | Guest selects same-day or reversed dates; booking fails cryptically at submission | Disable past dates and enforce `check_out > check_in` in the date picker component, not just at form validation |
| "Number of nights" shown instead of explicit dates on confirmation | Guest miscounts, expects different dates at arrival | Always display both check-in date AND check-out date explicitly on confirmation — never only "2 nights" |
| Calendar shows room count (e.g., "3 available") not room-level blocks | Staff cannot see which specific rooms are occupied on a given date | Occupancy calendar must show individual room rows (standard Gantt layout), not aggregate counts |
| Currency formatted as plain number (150000 instead of $150.000) | Colombian peso amounts look like European euros; staff misreads rates | Use `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })` everywhere money is displayed |
| Mobile booking: two-month calendar requires horizontal scroll | On mobile, guests give up before selecting dates | Show single-month view on mobile (`< 768px`), two-month on desktop; use swipe navigation |
| Booking engine shows "No availability" without suggesting alternatives | Guest abandons; direct booking lost | When no availability exists for selected dates, show nearest available dates or suggest similar room types |
| Room status board not auto-updating | Housekeeping staff refresh manually; decisions based on stale data | All housekeeping and reception views must subscribe to `room.status_changed` WebSocket events with visual change indicators |

---

## "Looks Done But Isn't" Checklist

- [ ] **Overbooking prevention**: Availability check exists at app layer — verify the PostgreSQL exclusion constraint (`btree_gist`) also exists in the migration
- [ ] **Night audit**: Room charge posting exists — verify `hotel_business_date` is advanced, no-shows are marked, and daily snapshot is written
- [ ] **Folio audit trail**: Charges can be added — verify that DELETE is not used anywhere on folio entries (only void entries exist)
- [ ] **Room state machine**: Check-in sets room to "occupied" — verify that rooms in OOO status are excluded from the availability query, not just hidden in the UI
- [ ] **AI assistant scope**: Assistant returns reservation data — verify that tool definitions enforce `hotelId` scoping and no write operations exist in any tool
- [ ] **Date consistency**: Reservation is created — verify `check_in_date` is stored as PostgreSQL `DATE` not `TIMESTAMP`, and test what happens when the API receives a datetime string
- [ ] **RBAC on PII**: Staff can view guest profile — verify a housekeeping-role JWT cannot retrieve `document_number` from the API (not just the UI)
- [ ] **Socket.io on Railway**: Real-time updates work locally — verify they still work after a Railway deployment (in-memory adapter breaks with multiple instances)
- [ ] **Prisma connection limit**: App works locally — verify `DATABASE_URL` has `?connection_limit=N` set and Railway's connection dashboard shows it below the 100-connection ceiling
- [ ] **Check-out folio snapshot**: Check-out action exists — verify an immutable folio record is written at the moment of check-out and cannot be modified afterward

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Overbooking in production (no DB constraint) | HIGH | Emergency: manually resolve duplicate, compensate guest. Technical: add exclusion constraint migration (downtime required). Audit all bookings for the affected period. |
| Wrong date type (TIMESTAMP instead of DATE) | HIGH | Data migration required: extract UTC date, convert to hotel-local date, rewrite column. All historical reports must be rerun. High risk of introducing new errors. |
| Mutable folio (DELETE used for charges) | HIGH | Cannot recover deleted audit history. Going forward: disable DELETE, implement void entries. Consider this a financial integrity incident. |
| Night audit not run for N days | MEDIUM | Backfill: run night audit idempotently for each missed business date. Room charges must be reposted. No-show marking must be backfilled. Requires careful transaction ordering. |
| AI assistant leaked guest data | HIGH | Rotate any API keys. Audit all AI tool call logs for the incident window. Notify affected guests per GDPR Art. 33 (72-hour notification window). Review and tighten tool scope. |
| Railway connection limit exhausted | LOW | Immediate: set `connection_limit` in DATABASE_URL and redeploy (< 5 min). Long-term: add PgBouncer in Transaction mode. |
| Socket.io state lost after deploy | LOW | Implement "fetch current state on reconnect" client-side. Users see a brief inconsistency resolved within 1-2 seconds of reconnect. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Overbooking race condition | Reservations core (earliest booking phase) | Load test with concurrent booking requests; verify DB exclusion constraint exists in migration |
| Date/timezone mismatch | Database schema design (Phase 1) | Schema review: `check_in_date` must be `DATE` type; `hotel_business_date` must exist in config table |
| Rate calculation complexity | Pricing module (before booking engine) | Rate calculation returns itemized breakdown, not a single total |
| Folio without immutable ledger | Operations module (check-in/check-out phase) | Verify no DELETE exists on folio_entries; verify void pattern is used in tests |
| Room state machine gaps | Inventory + Housekeeping modules | OOO rooms must not appear in availability query results; test this with a direct DB query |
| AI assistant safety | AI Assistant module | Tool definitions reviewed for write operations; input sanitization tests; audit log verified |
| Night audit skipped | Operations module (same phase as folio) | `hotel_business_date` advances at 3 AM; room charges post automatically; verify with Cron test |
| PII without retention strategy | Guest module (guest registration phase) | `anonymized_at` field exists; anonymization endpoint tested; document numbers encrypted at rest |
| Railway connection exhaustion | Infrastructure setup (first deploy phase) | `connection_limit` parameter in DATABASE_URL; connection count monitored post-deploy |
| Socket.io message storm on reconnect | Housekeeping realtime phase | Simulate server restart while client is connected; verify client re-syncs current state without duplicate events |

---

## Sources

- [How to Solve Race Conditions in a Booking System — HackerNoon](https://hackernoon.com/how-to-solve-race-conditions-in-a-booking-system)
- [Double Booking Problem: System Design Solutions — ITNEXT](https://itnext.io/solving-double-booking-at-scale-system-design-patterns-from-top-tech-companies-4c5a3311d8ea)
- [Prisma SELECT FOR UPDATE — Issue #17136](https://github.com/prisma/prisma/issues/17136)
- [Configure Prisma Client with PgBouncer — Prisma Docs](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer)
- [PostgreSQL Date/Time Types Documentation](https://www.postgresql.org/docs/current/datatype-datetime.html)
- [Understanding Time in Postgres — Towards Data Engineering](https://medium.com/towards-data-engineering/understanding-time-in-postgres-6724d439ede0)
- [Hotel Night Audit Process — Mews](https://www.mews.com/en/blog/hotel-night-audit-automation)
- [Night Audit: End of Day Process — SetupMyHotel](https://setupmyhotel.com/hotel-staff-training/front-office-training/hotel-night-audit-end-of-day-process-hotels-resorts/)
- [Hotel Folio Guide — Prostay](https://www.prostay.com/blog/hotel-folio-guide-for-guest-billing/)
- [The Number 1 Financial Mistake Hoteliers Make — HFTP](https://www.hftp.org/news/4123251/the-number-1-financial-mistake-hoteliers-make)
- [Room Status Abbreviations — Soraso](https://soraso.net/blog/room-status-abbreviation)
- [OOO vs OOS vs OOI Rooms — StayNTouch](https://stayntouch.freshdesk.com/support/solutions/articles/24000016624-a-guide-to-out-of-order-ooo-out-of-service-oos-out-of-inventory-ooi-rooms)
- [OWASP Top 10 for LLMs 2025 — Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [GDPR Compliance for Hotels 2025 — Preno](https://prenohq.com/blog/gdpr-what-hoteliers-need-to-know/)
- [GDPR & GoBD for Hotels — HotelFriend](https://hotelfriend.com/blogpost/gdpr-gobd-hotels-pms-checklist)
- [Railway PostgreSQL Max Connections](https://station.railway.com/questions/postgre-sql-max-connections-limit-76df3d31)
- [Socket.IO Troubleshooting — Official Docs](https://socket.io/docs/v4/troubleshooting-connection-issues/)
- [Hotel Booking Mistakes to Fix — Hotelogix](https://blog.hotelogix.com/hotel-booking-mistakes/)
- [Rate Management Mistakes — Axisrooms](https://blog.axisrooms.com/hotel-rate-management-mistakes/)

---
*Pitfalls research for: Hotel PMS + Booking Engine + AI Assistant (HotelOS AI)*
*Researched: 2026-05-13*
