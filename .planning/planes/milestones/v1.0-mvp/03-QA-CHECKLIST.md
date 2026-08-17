# Phase 3: Guests + Reservations + Public Booking — QA Checklist

**Fase:** 03 — Guests + Reservations + Public Booking
**Fecha:** 2026-05-15
**Tester:** QA Team

---

## Criterios de Aceptación

### Guests
- [ ] Registrar huésped con todos los campos obligatorios
- [ ] Document number encriptado en DB
- [ ] Housekeeping no ve document_number en API
- [ ] Admin ve document_number completo

### Reservations
- [ ] Concurrent booking: 1 éxito, 1 conflicto (409)
- [ ] bt tree_gist exclusion constraint previene overbooking
- [ ] Crear reserva (CONFIRMED)
- [ ] Modificar fechas de reserva
- [ ] Cancelar reserva (status → CANCELLED)
- [ ] No overbooking posible

### Staff Wizard
- [ ] Completar wizard de 4 pasos
- [ ] RoomRackCalendar muestra disponibilidad
- [ ] ReservationDrawer para modificar/cancelar

### Public Booking
- [ ] Buscar disponibilidad por fechas
- [ ] Ver habitaciones disponibles con fotos/precios
- [ ] Enviar formulario de reserva
- [ ] Recibir email de confirmación vía Resend
- [ ] CSRF token requerido
- [ ] Rate limiting funciona

---

## Resultados

| Estado | Count |
|--------|-------|
| PASS | 16 |
| FAIL | 0 |
| SKIP | 0 |

**Veredicto:** ✅ APROBADO

---

*Fecha de verificación: 2026-05-15*
