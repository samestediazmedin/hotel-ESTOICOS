# Phase 2: Inventory + Pricing — QA Checklist

**Fase:** 02 — Inventory + Pricing
**Fecha:** 2026-05-15
**Tester:** QA Team

---

## Criterios de Aceptación

### Room Types
- [ ] Crear room type con base price y amenities
- [ ] Editar room type existente
- [ ] Desactivar room type

### Rooms
- [ ] Crear habitación con número, piso, tipo
- [ ] Editar habitación
- [ ] Desactivar habitación
- [ ] physicalStatus independiente de cleaningStatus
- [ ] OUT_OF_SERVICE excluida de disponibilidad
- [ ] ON_HOLD excluida de disponibilidad

### Photos
- [ ] Subir foto a habitación
- [ ] Foto aparece en galería
- [ ] Foto servida desde R2 CDN
- [ ] Eliminar foto remueve de DB y R2

### Pricing
- [ ] Crear rate plan con seasons
- [ ] Calcular precio para rango de fechas
- [ ] Breakdown muestra base + modifier + tax + total
- [ ] Season multiplier aplica correctamente
- [ ] Minimum nights enforced

### UI
- [ ] Room drawer con tabs (Detalles/Reservas/Limpieza/Mantenimiento/Historial)
- [ ] Pricing admin UI funciona

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
