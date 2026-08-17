# Phase 4: Operations — CLOSEOUT

**Phase:** 04
**Milestone:** v1.0 — MVP
**Completed:** 2026-05-15
**Status:** ✓ COMPLETE

---

## Executive Summary

Phase 4 entregó el ciclo operativo completo del hotel: check-in/out atómico con apertura de folio, night audit cron con idempotencia, generación de PDF "ESTADO DE CUENTA" con IVA 19%, y exportación TRA Colombia para el Ministerio de Comercio.

---

## What Was Delivered

| Plan | Status | Key Deliverables |
|------|--------|------------------|
| 04-01 Check-in/Check-out | ✓ DONE | OperationsService (atomic tx), FolioService (append-only), 5-step checklist UI |
| 04-02 Night Audit | ✓ DONE | Cron 04:00 Bogotá, idempotency, NO_SHOW, advanceBusinessDate() |
| 04-03 Folio PDF | ✓ DONE | @react-pdf/renderer, "ESTADO DE CUENTA", COP formatter |
| 04-04 TRA Colombia Export | ✓ DONE | CSV export, tra_export_log audit, RBAC (ADMIN/MANAGER only) |

---

## Success Criteria Verification

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Check-in atómico | ✓ PASS | `operations.service.ts` — transaction + folio + room status |
| 2 | Night audit con IVA | ✓ PASS | `night-audit.service.ts` — room charges + IVA 19% |
| 3 | Idempotencia | ✓ PASS | Advisory lock + `night_audit_runs` table |
| 4 | PDF Estado de Cuenta | ✓ PASS | `@react-pdf/renderer` + SHA-256 snapshot |
| 5 | TRA export | ✓ PASS | `tra-export.controller.ts` — 8 tests |
| 6 | Checklist UI | ✓ PASS | `CheckInPage.tsx` — 5 pasos inline |

---

## Tests

| Suite | Count | Status |
|-------|-------|--------|
| API TRA export | 8 | ✓ PASS |
| API Night audit | 5 | ✓ PASS |
| API Check-in | 6 | ✓ PASS |
| Web Folio | 4 | ✓ PASS |

---

## Key Decisions

- **IVA 19%** — Colombia accommodation tax
- **Append-only folio** — nunca modificar, solo agregar líneas
- **SHA-256 snapshot** — inmutabilidad en checkout
- **04:00 Bogotá** — hora estándar de hotelería
- **TRA CSV** — semicolon + BOM para Excel español

---

## Files Created

- `apps/api/src/modules/operations/`
- `apps/api/src/modules/folio/`
- `apps/api/src/modules/night-audit/`
- `apps/api/src/modules/tra-export/`
- `apps/web/src/features/operations/`
- `apps/web/src/features/folio/`

---

## Carry-Forward

| Item | Reason | Resolved In |
|------|--------|-------------|
| Payment integration | Not MVP | Deferred indefinitely |
| Multiple currencies | COP only | v2 |

---

*Closed by: olaf*
*Date: 2026-05-15*
