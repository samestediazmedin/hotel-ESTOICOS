# Milestone v1.7 — Guest Experience Enhancement

**Goal:** Cerrar las features diferidas del v1.3 carry-forward que impactan directamente la experiencia del huésped y reducen carga operativa del staff.

**Trigger:** v1.6 completado, sistema estable, 1,566 tests verdes. Es momento de agregar valor al huésped.

**Execution order:** Phase 24 → Phase 25 → Phase 26 → Phase 27 (sequential)

---

## Phase 24: Pre-arrival Reminder System

**Mode:** mvp
**Goal:** El sistema envía automáticamente un email recordatorio a los huéspedes 1 día antes de su check-in, incluyendo información útil del hotel.

**Requirements:** REM-01, REM-02, REM-03, REM-04

**Success Criteria:**
1. Cron job corre diariamente a las 04:00 Bogotá y envía recordatorios a huéspedes con check-in mañana
2. Email incluye: nombre del huésped, fecha check-in, dirección del hotel, teléfono, tagline, instrucciones especiales si las hay
3. Staff puede ver en el dashboard cuántos recordatorios se enviaron hoy
4. El cron es idempotente — no envía duplicados si corre múltiples veces

**Plans:** 3 plans

**Depends on:** Phase 4 (night audit cron ya existe), Phase 14 (Resend ya configurado)

---

## Phase 25: Email Templates Library

**Mode:** mvp
**Goal:** Sistema de plantillas de email reutilizables que el admin puede personalizar desde el staff panel.

**Requirements:** TPL-01, TPL-02, TPL-03, TPL-04

**Success Criteria:**
1. Tabla `email_templates` existe con columns: id, name, subject, body_html, variables, is_active, created_at, updated_at
2. Admin puede ver/editar plantillas desde /settings/email-templates
3. 4 plantillas base creadas: welcome, pre-arrival, thank-you, booking-confirmation
4. Las plantillas usan variables {{hotelName}}, {{guestName}}, {{checkInDate}}, etc.
5. Refactor de booking confirmation email para usar el sistema de plantillas

**Plans:** 4 plans

**Depends on:** Phase 24 (Resend + cron pattern establecido)

---

## Phase 26: Online Reservation Completion

**Mode:** mvp
**Goal:** Huéspedes pueden completar una reserva iniciada pero no finalizada desde el portal público.

**Requirements:** ORC-01, ORC-02, ORC-03, ORC-04

**Success Criteria:**
1. Nueva columna `completionStatus` en Reservation: PENDING, COMPLETED, EXPIRED
2. Endpoint público POST /api/public/reservations/lookup (email + confirmationCode)
3. Página /complete-reservation en portal que muestra detalles de reserva pendiente
4. Botón "Completar reserva" que actualiza estado a COMPLETED (pago diferido a v2)
5. Reservas PENDING expiran después de 24h sin completar

**Plans:** 4 plans

**Depends on:** Phase 3 (reservation system), Phase 10 (public portal)

---

## Phase 27: Documentation Retroactive v1.0 MVP

**Mode:** documentation-only
**Goal:** Crear documentación retroactiva para fases 01-08 que nunca tuvieron PLAN.md ni CLOSEOUT.md.

**Requirements:** DOC-01, DOC-02, DOC-03

**Success Criteria:**
1. Cada fase 01-08 tiene PLAN.md con: objetivo, criterios de éxito, decisiones clave
2. Cada fase 01-08 tiene CLOSEOUT.md con: qué se entregó, métricas, bugs encontrados
3. QA Checklists creados para cada fase
4. Documentación v1.0 completa en .planning/planes/milestones/v1.0-mvp/

**Plans:** 2 plans (batch por grupos de fases)

**Depends on:** Nothing (documentation only)

---

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 24. Pre-arrival Reminder | ⬜ Not started | — |
| 25. Email Templates | ⬜ Not started | — |
| 26. Online Completion | ⬜ Not started | — |
| 27. Documentation v1.0 | ⬜ Not started | — |
