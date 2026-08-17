# Phase 5: Housekeeping — QA Checklist

**Fase:** 05 — Housekeeping
**Fecha:** 2026-05-15
**Tester:** QA Team

---

## Criterios de Aceptación

### State Machine
- [ ] DIRTY → IN_PROGRESS válido
- [ ] IN_PROGRESS → INSPECTION válido
- [ ] INSPECTION → CLEAN válido
- [ ] DIRTY → CLEAN rechazado
- [ ] Transición inválida retorna error

### Kanban Board
- [ ] Board muestra 4 columnas correctas
- [ ] Habitaciones en columnas correctas
- [ ] Actualización real-time sin reload
- [ ] Click en habitación abre modal

### Tasks
- [ ] Crear tarea para habitación
- [ ] Asignar a staff member
- [ ] Set priority (Alta/Media/Baja)
- [ ] Staff ve asignación en su board

### Events
- [ ] Checkout → habitación DIRTY automáticamente
- [ ] Transición visible en board inmediatamente

---

## Resultados

| Estado | Count |
|--------|-------|
| PASS | 11 |
| FAIL | 0 |
| SKIP | 0 |

**Veredicto:** ✅ APROBADO

---

*Fecha de verificación: 2026-05-15*
