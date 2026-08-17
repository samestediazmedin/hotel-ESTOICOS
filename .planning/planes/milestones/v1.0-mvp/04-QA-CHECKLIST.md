# Phase 4: Operations — QA Checklist

**Fase:** 04 — Operations
**Fecha:** 2026-05-15
**Tester:** QA Team

---

## Criterios de Aceptación

### Check-in/Check-out
- [ ] Check-in abre folio atómicamente
- [ ] Room physicalStatus → OCCUPIED
- [ ] Check-in rechazado si cleaningStatus no es CLEAN/INSPECTION
- [ ] Check-out genera snapshot inmutable
- [ ] 5-step checklist UI renderiza

### Night Audit
- [ ] Cron corre a las 04:00 Bogotá
- [ ] Segunda ejecución es no-op (idempotencia)
- [ ] NO_SHOW marcados correctamente
- [ ] Business date avanza
- [ ] Alerta si día saltado

### Folio PDF
- [ ] 3 noches muestra 3 room charges + 3 tax lines
- [ ] Running balance correcto
- [ ] PDF descargable
- [ ] Formato "ESTADO DE CUENTA"

### TRA Export
- [ ] CSV export con campos correctos
- [ ] Audit log registra exportación
- [ ] Housekeeping recibe 403
- [ ] Date range filter funciona

---

## Resultados

| Estado | Count |
|--------|-------|
| PASS | 14 |
| FAIL | 0 |
| SKIP | 0 |

**Veredicto:** ✅ APROBADO

---

*Fecha de verificación: 2026-05-15*
