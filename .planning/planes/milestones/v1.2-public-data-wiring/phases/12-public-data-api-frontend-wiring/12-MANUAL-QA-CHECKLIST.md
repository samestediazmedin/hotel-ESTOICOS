# Fase 12 — Manual QA Checklist

## Public Data API + Frontend Wiring

### Objetivo
Verificar que los endpoints públicos y el wiring del frontend funcionan correctamente.

---

## Checklist de API Pública

### Endpoints de Información del Hotel
- [ ] GET /api/public/hotel-info — Retorna datos del hotel
- [ ] GET /api/public/room-types — Lista tipos de habitación publicados
- [ ] GET /api/public/offers — Lista ofertas activas
- [ ] GET /api/public/reviews — Lista reseñas publicadas

### Endpoints de Disponibilidad
- [ ] GET /api/public/availability — Verifica disponibilidad por fechas
- [ ] GET /api/public/availability/:roomTypeId — Disponibilidad por tipo

### Endpoints de Booking
- [ ] POST /api/public/bookings — Crea reserva pública
- [ ] GET /api/public/bookings/:id — Consulta reserva
- [ ] POST /api/public/bookings/:id/cancel — Cancela reserva

---

## Checklist de Frontend Wiring

### Páginas Públicas
- [ ] Home Page — Información del hotel, ofertas, reviews
- [ ] Rooms Page — Lista de tipos de habitación
- [ ] Booking Page — Formulario de reserva
- [ ] Booking Lookup — Consulta de reserva existente
- [ ] Contact Page — Información de contacto

### Integración API-Frontend
- [ ] TanStack Query para fetching
- [ ] Manejo de estados de loading
- [ ] Manejo de errores (404, 500)
- [ ] Optimistic updates
- [ ] Cache invalidation

---

## Checklist de Seguridad Pública

- [ ] Rate limiting en endpoints públicos
- [ ] CSRF protection
- [ ] Input validation (Zod)
- [ ] XSS prevention
- [ ] CORS configurado correctamente

---

## Checklist de SEO

- [ ] Meta tags dinámicos
- [ ] Open Graph tags
- [ ] Structured data (JSON-LD)
- [ ] Sitemap XML
- [ ] robots.txt

---

## Resultado

| Estado | Count |
|--------|-------|
| ✅ Pass | 0 |
| ❌ Fail | 0 |
| ⏭️ Skip | 0 |

**Veredicto:** ⏳ PENDIENTE

---

*Documento generado para completar brecha de documentación*
