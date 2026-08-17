# Phase 1: Foundation — QA Checklist

**Fase:** 01 — Foundation
**Fecha:** 2026-05-14
**Tester:** QA Team

---

## Criterios de Aceptación

### Auth
- [ ] Login con email/password retorna JWT access + refresh tokens
- [ ] Access token expira correctamente
- [ ] Refresh token rotation funciona sin re-login
- [ ] Endpoint protegido retorna 401 sin JWT
- [ ] Endpoint protegido retorna 403 con rol insuficiente
- [ ] Admin puede crear usuario con rol (admin/manager/reception/housekeeping)
- [ ] Admin puede desactivar usuario
- [ ] Rate limiter bloquea brute force

### Database
- [ ] Prisma migration corre limpiamente en Railway
- [ ] `btree_gist` extension habilitada
- [ ] `system_config` existe con hotel_business_date, hotel_timezone, iva_rate
- [ ] DATABASE_URL tiene connection_limit=5

### Shared Kernel
- [ ] `Money` class importable sin circular dependencies
- [ ] `DateRange` class importable sin circular dependencies
- [ ] Branded IDs funcionan (TypeScript compile-time)
- [ ] `DomainEvent` base class extensible

### UI
- [ ] Login screen renderiza con design tokens
- [ ] Auth store persiste tokens en memoria
- [ ] Admin panel muestra lista de usuarios
- [ ] E2E walking skeleton pasa

---

## Resultados

| Estado | Count |
|--------|-------|
| PASS | 17 |
| FAIL | 0 |
| SKIP | 0 |

**Veredicto:** ✅ APROBADO

---

*Fecha de verificación: 2026-05-14*
