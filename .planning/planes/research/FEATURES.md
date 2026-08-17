# Feature Research

**Domain:** Hotel Property Management System (single-tenant) + Public Booking Engine + AI Staff Assistant
**Researched:** 2026-05-13
**Confidence:** HIGH (multiple authoritative sources, cross-validated)

---

## Validation Against Team v1 List

The team's v1 list is solid. This section identifies gaps, additions, and explicit trims before the full feature breakdown.

### Covered by v1 — Confirmed

| Feature | Status |
|---------|--------|
| Reservations CRUD + calendar | Confirmed table stakes |
| Check-in / Check-out | Confirmed table stakes |
| Rooms inventory | Confirmed table stakes |
| Rates and seasons | Confirmed table stakes |
| Housekeeping board | Confirmed table stakes |
| Reports / Dashboard (occupancy, ADR, RevPAR) | Confirmed table stakes |
| AI assistant (chat + PMS read access) | Confirmed differentiator |
| Auth + RBAC (4 roles) | Confirmed table stakes |
| Guest basic data | Confirmed table stakes (minimal) |
| Charges to room (no full POS) | Confirmed table stakes (minimal) |
| Channel manager data model only | Confirmed — right call to defer real integrations |

### Gaps Found — Missing from v1 List

| Gap | Severity | Complexity | Notes |
|-----|----------|------------|-------|
| **Guest folio (itemized bill)** | CRITICAL | MEDIUM | Without this, check-out has no billing output. Staff need a printable/emailable itemized statement. |
| **Night audit (automated daily close)** | HIGH | MEDIUM | Every hotel needs a daily financial close: post room charges, reconcile, advance the business date. Skipping this breaks accounting. |
| **Room rack / tape chart grid** | HIGH | MEDIUM | The calendar view must be a multi-room timeline grid (rooms on Y, dates on X), not just a list. This IS the core front-desk UI. |
| **TRA compliance (Colombia)** | HIGH | LOW-MEDIUM | Colombia law requires all guests reported to the Ministry of Commerce via Tarjeta de Registro de Alojamiento. Must be captured at check-in and exportable. |
| **Guest registration card with ID field** | MEDIUM | LOW | Linked to TRA: document type + number is required by Colombian law, not just "nice to have". Already in guest data but must be enforced. |
| **Folio tax line items** | MEDIUM | MEDIUM | Taxes (IVA, tourism tax if applicable) must appear as separate line items on the folio. Country-specific logic needed. |
| **Booking confirmation email** | MEDIUM | LOW | Public booking engine must send a confirmation email after reservation. Basic but frequently overlooked. |
| **Availability calendar on booking engine** | MEDIUM | LOW | Guest-facing booking page needs to show available dates visually, not just a form. Conversion rate impact. |

### Trims — v1 Should Explicitly Defer

These were not in v1 but commonly requested — explicitly marking them out-of-scope is useful:

| Feature | Why Defer |
|---------|-----------|
| **Real-time channel sync (OTA)** | Already deferred — correct. OTA API certification is months of work. |
| **Payment gateway integration** | Already deferred — correct. PCI compliance + gateway setup is a project in itself. |
| **Full accounting / GL integration** | Night audit generates reconciliation data; full accounting (QuickBooks, Siigo) is v3+. |
| **CRM / loyalty / marketing emails** | Already deferred — correct. |
| **Online check-in (guest self-service)** | Mobile check-in is a differentiator, not table stakes for a small hotel. V2. |
| **Multi-language booking engine** | Valuable but not required for a single Colombian hotel's MVP. V2. |
| **Revenue management / dynamic pricing** | Rate rules (already in v1) are sufficient. Automated yield management is v3. |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features staff and guests assume exist. Missing these means the product is not usable on day one.

| Feature | Why Expected | Complexity | v1 Coverage | Notes |
|---------|--------------|------------|-------------|-------|
| **Room rack / tape chart** | Core front-desk mental model: rooms on Y-axis, dates on X-axis, color-coded by status | MEDIUM | Partial (calendar mentioned, not specified as grid) | Must be drag-and-drop or click-to-create. This is the most used screen in the PMS. |
| **Reservations CRUD** | Creating / editing / cancelling reservations is the basic unit of work | LOW | Yes | Must include stay dates, room assignment, guest link, rate, and notes. |
| **Overbooking prevention** | No hotel can function if rooms are double-booked | LOW | Yes | Must be atomic at DB level, not just UI validation. |
| **Check-in workflow** | Marking a reservation as "in-house", assigning physical room, validating guest ID | LOW | Yes | Must require document number (TRA compliance). |
| **Check-out + folio close** | Closing a stay and producing the itemized bill | MEDIUM | Partial (no folio documented) | Folio must list: room rate per night, extras charged, taxes, total. Must be printable/PDF. |
| **Guest folio (running bill)** | Real-time ledger of all charges against a stay | MEDIUM | NOT COVERED | Room rate posts nightly. Charges add in real time. Folio is the financial record of the stay. |
| **Night audit (automated daily close)** | Posts room + tax charges for the night, advances business date, generates reconciliation report | MEDIUM | NOT COVERED | Without this, room revenue is not recorded daily. Critical for multi-night stays. |
| **Room inventory CRUD** | Managing rooms, types, characteristics, status | LOW | Yes | Must support "out of order" status to block rooms from booking. |
| **Room status workflow** | Dirty / Clean / Inspected / Out of Order | LOW | Yes | Status drives housekeeping and affects room assignment at check-in. |
| **Housekeeping board** | Visual board showing all rooms and their cleaning status | LOW | Yes | Realtime updates are a strong plus (already in scope). |
| **Rate configuration** | Room type rates, seasonal overrides, minimum stay | MEDIUM | Yes | Must apply correct rate automatically when a reservation is created. |
| **Availability check (booking engine)** | Guest can search available rooms by dates | LOW | Yes | Must show room types, rates, and photos. |
| **Booking engine reservation flow** | Guest selects room type, enters details, submits reservation | MEDIUM | Yes | No payment in v1 — reservation creates a "pending payment" status. |
| **Booking confirmation email** | Guest receives confirmation after booking | LOW | NOT COVERED | Transactional email. Basic expectation for any booking system. |
| **Guest registration with document ID** | Capturing guest document type + number at check-in | LOW | Partial (contact data yes, ID enforcement unclear) | Colombia law (TRA) requires this. Must be mandatory field. |
| **TRA compliance export** | Generating the Tarjeta de Registro de Alojamiento report for Colombian authorities | MEDIUM | NOT COVERED | Legal requirement. Can be a simple CSV/PDF export per day or stay. Non-compliance = fines. |
| **Dashboard KPIs** | Occupancy %, ADR, RevPAR, arrivals/departures today | LOW | Yes | These are the standard hotel performance indicators. |
| **Reports (occupancy, revenue)** | Filterable reports by date range | LOW | Yes | Night audit feeds these. |
| **Auth + RBAC** | Role-based access: admin, manager, reception, housekeeping | MEDIUM | Yes | Reception should not touch rates; housekeeping should not see billing. |
| **Charges to room** | Staff can post ad-hoc charges (minibar, laundry, etc.) to the open folio | LOW | Yes | These populate the folio for checkout. |

### Differentiators (Competitive Advantage)

Features that set HotelOS AI apart. Not universally expected, but valued.

| Feature | Value Proposition | Complexity | v1 Coverage | Notes |
|---------|-------------------|------------|-------------|-------|
| **AI assistant — natural language reporting** | "What was our occupancy last week?" in plain Spanish — no report builder needed | MEDIUM | Yes | Core differentiator. Reduces training time. Most PMS products have no AI at all. |
| **AI assistant — operational suggestions** | Proactively surfaces: "3 check-outs today, housekeeping is behind by 2 rooms" | HIGH | Partial (basic suggestions only) | More valuable than chat-only. Requires context-aware prompting over PMS data. |
| **AI assistant — anomaly detection** | "Room 204 has had no room charge posted tonight — check the folio" | HIGH | Not covered | Agentic, not just conversational. V1.5 candidate. |
| **Realtime housekeeping notifications** | WebSocket push when room status changes — eliminates walkie-talkies | MEDIUM | Yes | Rare in budget PMS tools. Genuine operational improvement. |
| **Booking engine — availability calendar (visual)** | Guest-facing date picker that shows green/red availability visually | LOW | Not explicitly covered | Directly improves booking conversion vs. a plain form. |
| **CSV/PDF export** | Staff can export reports without PMS-vendor lock-in | LOW | Yes | Builds trust with management. |
| **Drag-and-drop reservation on room rack** | Move a reservation to another room by dragging on the tape chart | HIGH | Not specified | Extremely useful for front desk. Complex to build but high satisfaction. Candidate for v1.x. |
| **Mobile-responsive front desk UI** | Reception can check in a guest from a tablet | MEDIUM | Implied (web-only) | Not native app, but responsive web is achievable and useful. |

### Anti-Features (Explicitly NOT Building)

Features to deliberately exclude, with rationale documented for the team.

| Anti-Feature | Why It Seems Appealing | Why Problematic in v1 | What to Do Instead |
|--------------|------------------------|----------------------|-------------------|
| **Full accounting / GL integration** | "We need real numbers" | Full accounting (chart of accounts, journals, P&L) is a separate domain with country-specific compliance. Builds in 6 months minimum. | Night audit produces a reconciliation report that an accountant can import manually. Mark as v3. |
| **Real OTA channel integrations** | "We lose bookings without Booking.com" | Each OTA (Booking.com, Expedia, Airbnb) requires a certified channel manager partner, XML/REST API agreements, test certification, and ongoing maintenance. Months of work per channel. | Prepare the data model (`source` field on reservation). Manual entry of OTA bookings in v1 is acceptable for a small hotel. Real integrations → v2/v3. |
| **Payment gateway (Stripe, PayU, etc.)** | "Guests want to pay online" | PCI DSS compliance, gateway agreements, refund flows, chargebacks, country-specific tax on payments. Complex and high-risk for MVP. | Reservation model has `paid_status` field. Payment collected at front desk or via external link. Mark as v2. |
| **Restaurant / F&B full POS** | "Guests eat at the hotel" | POS is a separate product domain: menu management, tables, orders, kitchen display, split checks. Scope explosion. | "Charges to room" covers the use case: staff posts a charge manually. Full POS → v3 or never. |
| **CRM / loyalty program** | "We want returning guests" | Guest history is in v1. True CRM (campaigns, points, tiers, email automation) requires a marketing stack. | Save guest data cleanly in v1. CRM can be bolted on later or connected to Mailchimp/HubSpot externally. |
| **Multi-property management** | "What if we expand?" | Multi-tenancy adds cross-cutting complexity to every bounded context: auth, pricing, reporting, availability. 40% more development effort. | Single-tenant architecture is the right call. If expansion happens, it's a new version, not an extension. |
| **Self-service online check-in/check-out (guest-facing)** | "Contactless is the future" | Requires mobile key integration (physical lock API), payment completion, digital signature, ID scan. High dependency chain. | Front desk check-in is v1. Online self-check-in is v2 after the core workflow is validated. |
| **AI write access to PMS (agentic mutations)** | "AI should be able to change reservations" | Write access dramatically increases failure surface: wrong cancellation, incorrect rate override, data corruption. Requires full audit trail + confirmation UX. | AI is read-only in v1. Staff confirm and execute. Write access is a v2 research item after trust is established. |
| **Dynamic pricing / yield management** | "Maximize revenue automatically" | Revenue management algorithms require historical data, competitor rates (scraping), and demand forecasting. Cannot work at MVP with no history. | Manual rate rules (seasons, min-stay) in v1. Dynamic pricing → v3 once 6+ months of occupancy data exists. |
| **WhatsApp / SMS automated messaging** | "Guests want confirmations on WhatsApp" | Twilio/Meta BSP onboarding, template approval, messaging compliance per country. Operational overhead > value at launch. | Email confirmation in v1 is sufficient. WhatsApp integration is a post-MVP enhancement. |

---

## Feature Dependencies

```
TRA Compliance Export
    └──requires──> Guest registration with document ID
                       └──requires──> Check-in workflow

Guest Folio
    └──requires──> Charges to room
    └──requires──> Night audit (to post room charges)
    └──requires──> Rate configuration (to know what to charge)

Check-out + Folio Close
    └──requires──> Guest Folio
    └──requires──> Folio tax line items

Night Audit
    └──requires──> Rate configuration
    └──requires──> Reservations (to know who is in-house)

Booking Engine Reservation Flow
    └──requires──> Room inventory
    └──requires──> Rate configuration
    └──requires──> Overbooking prevention (availability query)
    └──requires──> Booking confirmation email

AI Assistant
    └──requires──> Auth (staff only)
    └──enhances──> Reporting (natural language over report data)
    └──enhances──> Reservations (availability queries)
    └──enhances──> Housekeeping (status queries)

Dashboard KPIs
    └──requires──> Night audit (for accurate daily revenue figures)
    └──requires──> Reservations (for occupancy)

Housekeeping Realtime Notifications
    └──requires──> Housekeeping board
    └──requires──> WebSocket infrastructure
```

### Dependency Notes

- **Night audit must be built before accurate reporting:** KPIs like ADR and RevPAR require nightly room charge postings. Without night audit, revenue figures are wrong.
- **Folio is the output of check-out:** Check-out without a folio is not a real check-out — it produces no financial record.
- **TRA compliance requires document ID at check-in:** The check-in workflow must enforce document type + number as non-nullable fields.
- **Booking engine requires overbooking prevention at the DB level:** UI validation is insufficient. Unique constraint or advisory lock at the database layer is required.

---

## MVP Definition

### Launch With (v1) — Recommended Final List

Core operations must work end-to-end before anything else.

- [ ] Room inventory CRUD (types, characteristics, out-of-order status)
- [ ] Rate configuration (by room type, seasonal overrides, min-stay)
- [ ] Room rack / tape chart grid (primary front-desk UI)
- [ ] Reservations CRUD with overbooking prevention (DB-level)
- [ ] Guest registration with document ID (TRA-compliant fields)
- [ ] Check-in workflow (assign room, mark in-house, validate ID)
- [ ] Guest folio (running charges ledger per stay)
- [ ] Charges to room (post ad-hoc items to open folio)
- [ ] Night audit (post room+tax charges nightly, advance business date)
- [ ] Check-out + folio close (produce itemized PDF/printable bill)
- [ ] TRA compliance export (daily CSV/PDF of guest registrations)
- [ ] Housekeeping board with realtime status updates
- [ ] Dashboard KPIs (occupancy, ADR, RevPAR, arrivals/departures today)
- [ ] Reports (filterable by date, CSV export)
- [ ] Public booking engine (availability search + reservation flow)
- [ ] Booking confirmation email (transactional, triggered on reservation)
- [ ] AI assistant (read-only chat over PMS data, natural language reporting)
- [ ] Auth + RBAC (4 roles: admin, manager, reception, housekeeping)

### Add After Validation (v1.x)

Features to add once core workflow is operational and trusted.

- [ ] Drag-and-drop on room rack — trigger: reception staff feedback after using the PMS for 2+ weeks
- [ ] AI anomaly detection (unfilled folios, housekeeping delays) — trigger: AI assistant is in active daily use
- [ ] Folio split (separate billing for room vs. extras) — trigger: corporate client requirement
- [ ] Availability calendar on booking engine — trigger: low booking conversion rate

### Future Consideration (v2+)

- [ ] Payment gateway integration — after legal/compliance review
- [ ] Real OTA channel integrations — after MVP validation and OTA agreements
- [ ] Online guest self-check-in — requires lock/hardware integration
- [ ] CRM / loyalty / email campaigns
- [ ] WhatsApp / SMS messaging
- [ ] Full accounting / GL export
- [ ] Multi-language booking engine
- [ ] Dynamic pricing / yield management

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Room rack / tape chart | HIGH | MEDIUM | P1 |
| Reservations CRUD | HIGH | LOW | P1 |
| Check-in / Check-out + Folio | HIGH | MEDIUM | P1 |
| Guest folio | HIGH | MEDIUM | P1 |
| Night audit | HIGH | MEDIUM | P1 |
| TRA compliance export | HIGH (legal) | LOW-MEDIUM | P1 |
| Auth + RBAC | HIGH | MEDIUM | P1 |
| Booking engine (availability + flow) | HIGH | MEDIUM | P1 |
| Room inventory + rates | HIGH | LOW | P1 |
| Housekeeping board + realtime | HIGH | MEDIUM | P1 |
| Dashboard KPIs | HIGH | LOW | P1 |
| AI assistant (read-only chat) | HIGH (differentiator) | HIGH | P1 |
| Booking confirmation email | MEDIUM | LOW | P1 |
| Reports + CSV export | MEDIUM | LOW | P1 |
| Booking engine availability calendar | MEDIUM | LOW | P2 |
| Drag-and-drop on room rack | HIGH | HIGH | P2 |
| AI anomaly detection | MEDIUM | HIGH | P2 |
| Folio split billing | MEDIUM | MEDIUM | P2 |
| Payment gateway | HIGH | HIGH | P3 (v2) |
| OTA integrations | HIGH | VERY HIGH | P3 (v2) |

---

## Competitor Feature Analysis

Reference products studied: Cloudbeds, Mews, Hotelogix, RoomRaccoon, Little Hotelier.

| Feature | Cloudbeds / Mews | Hotelogix / Little Hotelier | HotelOS AI v1 Approach |
|---------|------------------|-----------------------------|------------------------|
| Room rack / tape chart | Full drag-and-drop grid | Basic grid | Grid view (click-to-create; drag-and-drop in v1.x) |
| Night audit | Automated, one-click | Automated | Automated (cron job, nightly batch) |
| Guest folio | Full (split, PDF, email) | Full | Basic (single folio, PDF/print) |
| TRA Colombia | Cloudbeds: native integration | Not documented | Manual export (CSV/PDF) — sufficient for v1 |
| AI assistant | Mews: limited; most: none | None | Conversational (Claude API) — strong differentiator |
| Booking engine | Included, branded | Included | Included (public-facing, no payment) |
| Channel manager | Real OTA sync | Real OTA sync | Data model only (v1) |
| Payments | Full (Stripe, PayU) | Full | None (v1) — deferred correctly |
| Housekeeping realtime | Some via integrations | Basic | WebSocket (differentiator for cost tier) |

---

## Hotel-Specific Gotchas

These are implementation pitfalls specific to hotel features, distinct from general software pitfalls.

1. **Night audit is NOT optional.** It is the mechanism that posts room charges daily. Without it, a 3-night stay that checks out on day 3 would have 0 room charges on the folio unless manually posted. Every hotel PMS runs a night audit (automated or manual).

2. **Business date vs. calendar date.** Hotel "today" is the business date advanced by night audit, not `new Date()`. A reservation made at 1am on May 14 belongs to the business date of May 13 (before audit ran). This affects all reporting and folio logic.

3. **Colombia TRA is a legal requirement, not optional.** Non-compliance results in fines from the Ministry of Commerce, Industry, and Tourism. The system must capture: guest full name, document type, document number, nationality, date of birth, arrival date, departure date. Must be exportable per stay or per day.

4. **Folio taxes vary by country.** In Colombia: IVA (19%) applies to lodging above a threshold; some municipalities add a "contribución parafiscal al turismo". The folio must support configurable tax rules, not hardcoded percentages.

5. **Overbooking must be prevented at the database layer.** UI-side checks fail under concurrent requests (two guests booking the last room simultaneously). Use a DB-level unique constraint or serializable transaction on the availability check.

6. **Check-in and room assignment are separate concerns.** A reservation can exist without a room assigned (group hold). Check-in assigns a specific physical room. The system must support this distinction.

7. **Reservations from the booking engine vs. staff-created reservations.** Both go into the same reservation pool. The `source` field distinguishes them. Night audit, folio, and reporting must treat them identically.

8. **AI assistant context window and data freshness.** The assistant queries live PMS data. Responses must reflect real-time state (not cached snapshots older than a few seconds). For read-heavy queries (occupancy last 30 days), consider a read replica or materialized view.

---

## Sources

- Cloudbeds Colombia compliance: https://www.cloudbeds.com/government-compliance/colombia/
- Mews hotel night audit: https://www.mews.com/en/blog/hotel-night-audit-automation
- Hotelogix night audit process: https://blog.hotelogix.com/night-audit-process/
- AltexSoft PMS complete guide: https://www.altexsoft.com/blog/hotel-property-management-systems-products-and-features/
- Hospitality Net PMS features 2025: https://www.hospitalitynet.org/opinion/4125729.html
- Hotel folio guide (Mews): https://www.mews.com/en/blog/hotel-folio
- RoomRaccoon booking engine guide: https://roomraccoon.com/resources/hotel-booking-engine/
- Little Hotelier guest registration: https://www.littlehotelier.com/blog/running-your-property/guest-registration/
- Priority Software PMS features: https://www.priority-software.com/resources/top-features-to-look-for-in-a-hotel-pms/
- AI for hotels 2026 (Conduit): https://conduit.ai/blog/ai-use-cases-hotels-2025

---
*Feature research for: Hotel PMS + Booking Engine + AI Assistant (single-tenant)*
*Researched: 2026-05-13*
