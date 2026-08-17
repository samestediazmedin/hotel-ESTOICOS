# Plan de Reparación HotelOS AI — Sprint de Mantenimiento v1.5.1

**Fecha:** 2026-06-16  
**Proyecto:** HotelOS AI (Single-tenant PMS para hotel en Colombia)  
**Scope:** Todos los bugs abiertos identificados en QA sessions (v1.3 bug hunt + QA 2026-06-12)  
**Total Bugs:** 7 CRÍTICOS/ALTO + 2 NUEVOS (POST 500) + 1 UX  
**Tests Base:** 1,475 pasan (1,034 backend + 444 frontend) | 3 fallan (jsdom drag)  

---

## 1. TRIAGE Y MAPEO DE DEPENDENCIAS

### Diagrama de Impacto en Cascada

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BUGS CRÍTICOS (Bloquean flujos completos)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  BUG-1: POST /api/guests 500         BUG-2: POST /api/users 500            │
│  ├─ Bloquea: Creación huéspedes      ├─ Bloquea: Creación staff            │
│  ├─ Impacta: Wizard reservas       ├─ Impacta: Gestión usuarios           │
│  ├─ Impacta: Booking público       ├─ Impacta: RBAC completo             │
│  └─ Impacta: Contact events        └─ Impacta: Admin settings            │
│                                                                             │
│  BUG-3: CRITICAL-01 (XSS email)    BUG-4: CRITICAL-02 (Phase 15 DTOs)     │
│  ├─ Bloquea: Email confirmations   ├─ Bloquea: Guest detail visual         │
│  ├─ Impacta: Seguridad (CWE-79)    ├─ Impacta: Contact buttons           │
│  └─ Impacta: Reputación hotel    ├─ Impacta: WhatsApp/Phone disabled     │
│                                    └─ Impacta: Marketing consent           │
│                                                                             │
│  BUG-5: CRITICAL-03 (NaN limit)    BUG-6: HIGH-01 (WhatsApp spaces)        │
│  ├─ Bloquea: Contact events API    ├─ Impacta: UX booking público         │
│  └─ Impacta: Logs/auditoría      └─ Impacta: Datos inconsistentes         │
│                                                                             │
│  BUG-7: HIGH-02 (LANGUAGE_LABEL)   BUG-8: HIGH-03 (Popup blocker)          │
│  ├─ Impacta: Guest detail UI     ├─ Impacta: Contact buttons            │
│  └─ Impacta: Percepción calidad    └─ Impacta: Workflow staff              │
│                                                                             │
│  BUG-9: Fecha malformada           BUG-10: Placeholders técnicos           │
│  ├─ Impacta: Guest detail UI       ├─ Impacta: Percepción profesional      │
│  └─ Impacta: Confianza usuario     └─ Impacta: Todas las drawers          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. EJECUCIÓN DEL SPRINT (Orden Lógico)

### 🔴 PRIORIDAD 1: Bloqueantes (Backend/API)
**Objetivo:** Restaurar capacidad de crear datos (huéspedes + usuarios)

---

#### BUG-1: POST /api/guests retorna 500

| Atributo | Detalle |
|----------|---------|
| **Componente** | `apps/api/src/modules/guests/guests.controller.ts`, `guests.service.ts`, `guests.repository.ts`, `dto/create-guest.dto.ts` |
| **Comportamiento Actual** | 500 Internal Server Error al crear huésped desde frontend |
| **Hipótesis H1 (más probable)** | `ValidationPipe` global sin `transform: true` + DTOs con `declare` → validación frágil |
| **Hipótesis H2** | Migración DB desactualizada — tabla `guests` no coincide con schema Prisma |
| **Hipótesis H3** | `GUEST_ENCRYPTION_KEY` inválida en runtime |
| **Hipótesis H4** | Error de validación Zod no manejado como 400 |
| **Hipótesis H5** | Problema de Prisma Client generado (versión mismatch) |
| **Impacto en Cascada** | 🚨 **BLOQUEA:** Wizard de reservas (no puede crear huésped) → Booking público (no puede completar) → Check-in/out (no hay huésped) → Folio (no hay cuenta) → Night audit (no hay datos) → Contact events (no hay guestId) → Guest detail page (no existe) → Marketing/Ley 1581 (no hay consent) |
| **Tests Afectados** | 0 tests de controller existen para este endpoint (gap crítico) |

**Plan de Reparación:**
1. Capturar stack trace exacto del servidor (logs NestJS)
2. Verificar `prisma migrate status` — descartar DB mismatch
3. Revisar `GUEST_ENCRYPTION_KEY` en runtime (32 bytes hex)
4. Auditar `ValidationPipe` en `main.ts` — agregar `transform: true` si falta
5. Revisar `CreateGuestDto` — campos `declare` vs `class-transformer`
6. Crear test de controller PRIMERO (red) → luego fix (green)
7. Verificar que `guests.service.create` maneja errores Prisma (P2002, etc.)

**Archivos a Modificar:**
- `apps/api/src/main.ts` (ValidationPipe config)
- `apps/api/src/modules/guests/dto/create-guest.dto.ts` (decoradores)
- `apps/api/src/modules/guests/guests.controller.ts` (manejo de errores)
- `apps/api/src/modules/guests/guests.service.ts` (try/catch Prisma)
- `apps/api/src/modules/guests/guests.repository.ts` (validación previa)
- `apps/api/src/modules/guests/guests.controller.spec.ts` (nuevo — test de integración)

**Instrucciones de Prueba:**
```bash
# 1. Verificar stack trace
curl -X POST http://localhost:3003/api/guests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"fullName":"Test","email":"test@test.com","phone":"+573001234567","documentType":"CC","documentNumber":"123456","nationality":"CO","dateOfBirth":"1990-01-01"}'

# 2. Ejecutar tests
cd apps/api && pnpm test -- guests.controller.spec.ts

# 3. Verificar en frontend: Ir a /guests → Nuevo → Completar form → Submit
```

---

#### BUG-2: POST /api/users también falla

| Atributo | Detalle |
|----------|---------|
| **Componente** | `apps/api/src/modules/users/users.controller.ts`, `users.service.ts`, `dto/create-user.dto.ts` |
| **Comportamiento Actual** | Error/cuelgue al crear usuario de staff |
| **Causa Probable** | Mismo patrón que BUG-1: `ValidationPipe` sin `transform: true` + DTOs con `declare` |
| **Servicio** | `UsersService.createUser` sin try/catch de Prisma → 500 en constraint violation |
| **Impacto en Cascada** | 🚨 **BLOQUEA:** Gestión de usuarios (no puede crear staff) → RBAC incompleto → Housekeeping sin asignaciones → Admin settings sin usuarios → No puede escalar equipo |
| **Tests Afectados** | 0 tests de controller existen para este endpoint |

**Plan de Reparación:**
1. Reutilizar fix de BUG-1 si aplica (mismo patrón de DTO/ValidationPipe)
2. Si causa diferente: auditar `UsersService.createUser` para manejo de errores
3. Verificar constraint única de email (P2002) → retornar 409 Conflict, no 500
4. Crear test de controller (red → green)

**Archivos a Modificar:**
- `apps/api/src/modules/users/dto/create-user.dto.ts` (decoradores/class-transformer)
- `apps/api/src/modules/users/users.service.ts` (try/catch Prisma, manejo P2002)
- `apps/api/src/modules/users/users.controller.ts` (manejo de errores)
- `apps/api/src/modules/users/users.controller.spec.ts` (nuevo — test de integración)

**Instrucciones de Prueba:**
```bash
# 1. Crear usuario staff
curl -X POST http://localhost:3003/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"email":"newstaff@hotel.com","name":"Nuevo Staff","password":"password123","role":"RECEPTION"}'

# 2. Verificar respuesta 201 (no 500)
# 3. Verificar que email duplicado retorna 409 (no 500)
```

---

### 🔴 PRIORIDAD 2: Seguridad Crítica (Backend)

#### BUG-3: CRITICAL-01 — XSS en Email de Confirmación (CWE-79)

| Atributo | Detalle |
|----------|---------|
| **Componente** | `apps/api/src/modules/email/email.service.ts` |
| **Comportamiento Actual** | `guestName` se inyecta directamente en HTML sin escapar |
| **Líneas Afectadas** | `buildConfirmationHtml:237`, `buildReviewInviteHtml:122` |
| **Impacto en Cascada** | 🚨 **SEGURIDAD:** Si huésped se llama `<script>alert(1)</script> García`, el email ejecuta script en cliente de correo del staff/huésped. Etiquetas como `<img onerror=...>` pueden funcionar según cliente. |
| **Estado** | Documentado como fixeado en v1.3-bug-fix-summary.md (commit `fff9f01`) pero **NO VERIFICADO** en QA 2026-06-12 |

**Plan de Reparación:**
1. **VERIFICAR** que el fix `fff9f01` realmente está aplicado en el código actual
2. Si NO está aplicado: aplicar escapeHtml en las 3 inyecciones:
   - `params.guestName` → `this.escapeHtml(params.guestName)`
   - `params.hotelName` → `this.escapeHtml(params.hotelName)`
   - `params.roomTypeName` → `this.escapeHtml(params.roomTypeName)` (preventivo)
3. Actualizar comentario de `escapeHtml` para reflejar alcance real
4. Crear test de seguridad: enviar guestName con `<b>bold</b>` → verificar que se escapa

**Archivos a Modificar:**
- `apps/api/src/modules/email/email.service.ts` (verificar/aplicar escapeHtml)
- `apps/api/src/modules/email/email.service.spec.ts` (test de seguridad XSS)

**Instrucciones de Prueba:**
```bash
# 1. Verificar que escapeHtml está aplicado
grep -n "escapeHtml" apps/api/src/modules/email/email.service.ts

# 2. Test de seguridad: crear reserva con nombre malicioso
# 3. Verificar que el HTML del email contiene &lt; en lugar de <
```

---

#### BUG-4: CRITICAL-02 — Phase 15 Fields Ausentes en DTOs

| Atributo | Detalle |
|----------|---------|
| **Componente** | `apps/api/src/modules/guests/dto/guest-response.dto.ts`, `guest-public.dto.ts`, `guests.service.ts` |
| **Comportamiento Actual** | 6 campos Phase 15 (`whatsappNumber`, `contactPreference`, `preferredLanguage`, `marketingConsent`, `dietaryRestrictions`, `specialRequests`) NO aparecen en respuestas GET |
| **Causa Raíz** | `toResponseDto()` construye objeto manualmente (sin spread) — campos Phase 15 no mapeados |
| **Impacto en Cascada** | 🚨 **BLOQUEA:** GuestDetailPage muestra `—` para todos los campos Phase 15 → ContactButtons (Llamar, WhatsApp) disabled → Staff no puede contactar huésped → Marketing consent invisible → Ley 1581 compliance roto → Preferencias de idioma no funcionan → Dietas/restricciones no visibles |
| **Estado** | Documentado como fixeado en v1.3-bug-fix-summary.md (commit `bf5949c`) pero **NO VERIFICADO** en QA 2026-06-12 |

**Plan de Reparación:**
1. **VERIFICAR** que el fix `bf5949c` realmente está aplicado en el código actual
2. Si NO está aplicado: agregar 6 campos a `GuestResponseDto` y `GuestPublicDto`
3. Mapear campos en `toResponseDto()` y `toPublicDto()` con fallbacks defensivos
4. Verificar que `GuestDetailPage` recibe los campos y los renderiza correctamente
5. Verificar que `ContactButtons` se habilitan cuando `whatsappNumber` y `phone` existen

**Archivos a Modificar:**
- `apps/api/src/modules/guests/dto/guest-response.dto.ts` (6 campos nuevos)
- `apps/api/src/modules/guests/dto/guest-public.dto.ts` (5 campos nuevos, sin marketingConsent)
- `apps/api/src/modules/guests/guests.service.ts` (mapeo en toResponseDto/toPublicDto)
- `apps/web/src/features/guests/GuestDetailPage.tsx` (verificar renderizado)

**Instrucciones de Prueba:**
```bash
# 1. GET /api/guests/:id y verificar que los 6 campos aparecen
# 2. Verificar que GuestDetailPage muestra valores (no —)
# 3. Verificar que ContactButtons se habilitan con datos
```

---

#### BUG-5: CRITICAL-03 — parseInt(limit) puede retornar NaN

| Atributo | Detalle |
|----------|---------|
| **Componente** | `apps/api/src/modules/guest-contact/guest-contact.controller.ts:68` |
| **Comportamiento Actual** | `limit=abc` → `parseInt("abc",10)` → `NaN` → Prisma recibe `take: NaN` → 500 |
| **Impacto en Cascada** | Contact events API inestable → Logs de auditoría incompletos → Guest detail page muestra eventos incorrectos |
| **Estado** | Documentado como fixeado en v1.3-bug-fix-summary.md (commit `567040f`) pero **NO VERIFICADO** |

**Plan de Reparación:**
1. **VERIFICAR** que el fix `567040f` está aplicado
2. Si NO: reemplazar `const n = limit ? parseInt(limit, 10) : 5` con `const n = limit !== undefined ? (parseInt(limit, 10) || 5) : 5`
3. Aplicar mismo patrón en `guests.controller.ts:52-53` (skip/take)
4. Crear test con `limit=abc` → verificar que retorna 5 (default), no 500

**Archivos a Modificar:**
- `apps/api/src/modules/guest-contact/guest-contact.controller.ts`
- `apps/api/src/modules/guests/guests.controller.ts` (mismo patrón)
- Tests de controller correspondientes

---

### 🟠 PRIORIDAD 3: Lógica de Negocio (Frontend/API)

#### BUG-6: HIGH-01 — WhatsApp solo-espacios pasa validación

| Atributo | Detalle |
|----------|---------|
| **Componente** | `apps/web/src/features/public-booking/BookingFormPage.tsx:27-37` |
| **Comportamiento Actual** | Usuario escribe `"   "` (espacios) → transform produce `""` → se envía como `undefined` → no se guarda, pero UX confusa |
| **Impacto en Cascada** | Huésped cree que ingresó WhatsApp → Staff no puede contactar → ContactButtons disabled → Perdida de comunicación |
| **Estado** | Fix documentado en `bdcb4db` pero **NO VERIFICADO** |

**Plan de Reparación:**
1. **VERIFICAR** que `.trim()` está aplicado en el transform
2. Si NO: aplicar `.replace(/\s+/g, '').trim()`
3. Agregar mensaje de validación claro: "WhatsApp debe ser formato E.164 (ej: +573001234567)"

---

#### BUG-7: HIGH-02 — LANGUAGE_LABEL keys mayúsculas vs minúsculas

| Atributo | Detalle |
|----------|---------|
| **Componente** | `apps/web/src/features/guests/GuestDetailPage.tsx:70-79` |
| **Comportamiento Actual** | `LANGUAGE_LABEL` indexa con `'ES'` pero DB guarda `'es'` → lookup falla → muestra `'es'` crudo |
| **Impacto en Cascada** | Guest detail muestra `'es'` en lugar de `'Español'` → Percepción de calidad baja → Staff no sabe idioma del huésped |
| **Estado** | Fix documentado en `5268d82` pero **NO VERIFICADO** |

**Plan de Reparación:**
1. **VERIFICAR** que las claves son minúsculas: `es: 'Español', en: 'Inglés'`
2. Si NO: cambiar claves a minúsculas

---

#### BUG-8: HIGH-03 — Popup blocker bloquea WhatsApp

| Atributo | Detalle |
|----------|---------|
| **Componente** | `apps/web/src/features/guests/components/ContactButtons.tsx:101` |
| **Comportamiento Actual** | `window.open()` en callback `onSuccess` (asíncrono) → popup blocker lo bloquea → Staff ve toast verde pero no se abre WhatsApp |
| **Impacto en Cascada** | Staff no puede contactar huésped vía WhatsApp → Workflow de contacto roto → Eventos de contacto se registran pero acción no ocurre |
| **Estado** | Fix documentado en `3773d6d` pero **NO VERIFICADO** |

**Plan de Reparación:**
1. **VERIFICAR** que `window.open()` se llama SÍNCRONAMENTE antes de la mutación
2. Si NO: invertir orden — abrir link primero, luego disparar mutación fire-and-forget

---

### 🟡 PRIORIDAD 4: Interfaces/Vistas (UX)

#### BUG-9: Fecha de nacimiento malformada en GuestDetailPage

| Atributo | Detalle |
|----------|---------|
| **Componente** | `apps/web/src/features/guests/GuestDetailPage.tsx` (sección Información de contacto) |
| **Comportamiento Actual** | Muestra `1998-11-24T00:00:00.000Z` en lugar de `24 nov 1998` |
| **Causa Raíz** | Backend envía ISO string completo; frontend no aplica `formatDisplayDate()` |
| **Helper Disponible** | `formatDisplayDate()` en `lib/date.ts` |
| **Impacto en Cascada** | Percepción de calidad baja → Staff confundido → Posible error manual al copiar fecha |

**Plan de Reparación:**
1. Importar `formatDisplayDate` en `GuestDetailPage.tsx`
2. Aplicar a campo `dateOfBirth` en la sección de información de contacto
3. Verificar que otros campos de fecha en el componente también usan el helper
4. Buscar mismo patrón en otros componentes (drawer de reserva, etc.)

**Archivos a Modificar:**
- `apps/web/src/features/guests/GuestDetailPage.tsx` (import + aplicar formato)
- `apps/web/src/features/reservations/components/ReservationDrawer.tsx` (si aplica)

**Instrucciones de Prueba:**
```bash
# 1. Navegar a /guests/:id
# 2. Verificar que fecha de nacimiento muestra "24 nov 1998" (no ISO)
# 3. Verificar que otros campos de fecha también están formateados
```

---

#### BUG-10: Placeholders técnicos confusos en drawers

| Atributo | Detalle |
|----------|---------|
| **Componente** | `apps/web/src/components/ui/empty-tab-placeholder.tsx` |
| **Ubicaciones** | `ReservationDrawer.tsx` tab "Cobros", `RoomDrawer.tsx` placeholders similares |
| **Comportamiento Actual** | Muestra `"Disponible en Fase 04 — Operaciones"` con guión largo en gris claro |
| **Impacto en Cascada** | Percepción de producto inacabado → Staff confundido (¿es un error?) → No confían en el sistema |

**Plan de Reparación:**
1. Cambiar mensaje a `"Próximamente"` o `"En desarrollo"`
2. Ocultar tabs no implementados hasta que estén listos (preferido)
3. Aplicar patrón consistente en todos los drawers

**Archivos a Modificar:**
- `apps/web/src/components/ui/empty-tab-placeholder.tsx` (mensaje genérico)
- `apps/web/src/features/reservations/components/ReservationDrawer.tsx` (ocultar tab Cobros)
- `apps/web/src/features/inventory/components/RoomDrawer.tsx` (revisar placeholders)

---

## 3. ORDEN DE EJECUCIÓN RECOMENDADO

```
DÍA 1 — PRIORIDAD 1 (Bloqueantes)
├── 09:00-10:30  BUG-1: POST /api/guests 500
│   ├── Capturar stack trace
│   ├── Verificar ValidationPipe + DTOs
│   ├── Crear test controller (red)
│   ├── Aplicar fix
│   └── Verificar test pasa (green)
│
├── 10:30-12:00  BUG-2: POST /api/users 500
│   ├── Reutilizar aprendizaje de BUG-1
│   ├── Crear test controller (red)
│   ├── Aplicar fix
│   └── Verificar test pasa (green)
│
└── 12:00-13:00  Almuerzo + Commit

DÍA 1 — PRIORIDAD 2 (Seguridad)
├── 14:00-15:00  BUG-3: CRITICAL-01 XSS (verificar fix existente)
├── 15:00-16:00  BUG-4: CRITICAL-02 Phase 15 DTOs (verificar fix existente)
├── 16:00-16:30  BUG-5: CRITICAL-03 NaN limit (verificar fix existente)
└── 16:30-17:00  Commit + Tests de regresión

DÍA 2 — PRIORIDAD 3 (Lógica de Negocio)
├── 09:00-10:00  BUG-6: HIGH-01 WhatsApp spaces (verificar fix)
├── 10:00-11:00  BUG-7: HIGH-02 LANGUAGE_LABEL (verificar fix)
├── 11:00-12:00  BUG-8: HIGH-03 Popup blocker (verificar fix)
└── 12:00-13:00  Almuerzo + Commit

DÍA 2 — PRIORIDAD 4 (UX)
├── 14:00-15:00  BUG-9: Fecha malformada
├── 15:00-16:00  BUG-10: Placeholders técnicos
└── 16:00-17:00  QA final + Documentación
```

---

## 4. ESTÁNDAR DE DOCUMENTACIÓN POR FIX

Cada fix debe incluir en el commit:

```markdown
## Fix: [BUG-ID] — [Título corto]

### Causa Raíz
[Explicación técnica de por qué fallaba]

### Archivos Modificados
- `path/to/file.ts` — [qué cambió]
- `path/to/file2.ts` — [qué cambió]

### Solución Técnica
[Descripción del cambio aplicado]

### Tests
- [ ] Test unitario pasa
- [ ] Test de integración pasa
- [ ] Test E2E pasa (si aplica)
- [ ] QA manual verificado

### Instrucciones de Prueba
1. [Paso 1]
2. [Paso 2]
3. [Verificación esperada]

### Impacto en Cascada Verificado
- [ ] Módulo dependiente X funciona
- [ ] Módulo dependiente Y funciona
```

---

## 5. CHECKLIST FINAL DE VERIFICACIÓN

### Backend
- [ ] POST /api/guests retorna 201 (no 500)
- [ ] POST /api/users retorna 201 (no 500)
- [ ] GET /api/guests/:id incluye 6 campos Phase 15
- [ ] GET /api/guests/:id/contact-events?limit=abc retorna 5 items (no 500)
- [ ] Email de confirmación escapa HTML (test XSS)
- [ ] 1,034 tests backend pasan

### Frontend
- [ ] GuestDetailPage muestra fecha formateada (no ISO)
- [ ] GuestDetailPage muestra "Español" (no "es")
- [ ] ContactButtons se habilitan con datos de contacto
- [ ] WhatsApp se abre sin popup blocker
- [ ] Placeholders muestran "Próximamente" (no "Fase 04")
- [ ] 444 tests frontend pasan (3 drag & drop conocidos)

### Integración
- [ ] Flujo completo: Crear huésped → Crear reserva → Check-in → Contactar → Check-out
- [ ] Flujo público: Portal → Booking → Confirmación email
- [ ] Admin: Crear usuario → Asignar rol → Login con nuevo usuario

---

## 6. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Fixes v1.3 ya aplicados pero no funcionan | Media | Alto | Verificar CADA fix antes de asumir que está ok |
| Cambios en DTOs rompen tests existentes | Media | Medio | Ejecutar tests completos después de cada fix |
| Fix de ValidationPipe afecta otros endpoints | Baja | Alto | Test de regresión: login, refresh, logout |
| Cambios en email service rompen envío | Baja | Medio | Test de envío con mock, verificar HTML output |

---

*Plan creado: 2026-06-16*  
*Próxima revisión: Al completar Prioridad 1*  
*Documento vivo — actualizar con resultados de cada fix*
