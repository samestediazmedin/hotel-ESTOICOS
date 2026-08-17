# Plan de Pruebas HotelOS AI

> Versión actualizada al estado real del repositorio (2026-06-12).
> El plan anterior quedó desactualizado: reportaba 5 specs de backend y 0 de frontend/E2E, cuando en realidad el proyecto ya cuenta con cobertura significativa. Esta versión parte del inventario real de tests e identifica **gaps** en lugar de proponer duplicados.

---

## Estado Actual de Tests

| Tipo | Cantidad | Ubicación | Notas |
|------|----------|-----------|-------|
| Unit/Integration (Backend) | **60 archivos** | `apps/api/src/**/*.spec.ts` | Incluye servicios, controladores, repositorios, gateways, utilidades y tests de seguridad |
| Componentes / Hooks (Frontend) | **25 archivos** | `apps/web/src/**/*.test.{ts,tsx}` | Mayoritariamente en `public-portal`, `pricing` y `reporting` |
| E2E (Playwright) | **6 archivos** | `apps/web/e2e/**/*.spec.ts` | Configuración real en `apps/web/playwright.config.ts` |
| Tests de integración puros (`apps/api/test/`) | **0 archivos** | `apps/api/test/**/*.spec.ts` | Gap identificado: no hay suite de supertest contra la app completa |

**Cobertura estimada:** backend ~servicios cubiertos en su mayoría, controladores parcialmente; frontend concentrado en portal público; E2E con flujos críticos básicos.

---

## Pirámide de Testing Actual

```
        ┌─────────┐
        │   E2E   │  6 specs  (Playwright)
        ├─────────┤
        │Integrac.│  0 specs  (supertest / apps/api/test)
        ├─────────┤
        │ Unitarios│ 85 specs  (60 backend + 25 frontend)
        └─────────┘
```

**Evaluación:** la base de unitarios es sólida. El cuello de botella está en la capa media de integración y en el desbalance del frontend (muchos tests de portal público, pocos del PMS de staff).

---

## Cobertura por Módulo (Backend)

| Módulo | Specs existentes | Controller test | Gaps principales |
|--------|------------------|-----------------|------------------|
| `auth` | 5 (controller, service, token, login-attempt, refresh-race) | ✅ | Revisar JWT strategy de forma aislada |
| `users` | 1 (service) | ❌ | `users.controller.spec.ts` |
| `ai-assistant` | 8 | ✅ controller | Tests de integración SSE; más tools individuales |
| `concierge` | 11 | ✅ controller | `concierge-public-csrf.controller.spec.ts` (CSRF double-submit) |
| `inventory` | 2 (service, photos) | ❌ | `inventory.controller.spec.ts` |
| `housekeeping` | 4 | ❌ | `housekeeping.controller.spec.ts` |
| `reservations` | 3 (service, repository, availability) | ❌ | `reservations.controller.spec.ts`; overbooking edge cases |
| `operations` | 1 (service) | ❌ | `operations.controller.spec.ts`; flujo check-in/out end-to-end |
| `pricing` | 1 (service) | ❌ | `pricing.controller.spec.ts` |
| `offers` | 1 (service) | ❌ | `offers-admin.controller.spec.ts`, `offers-public.controller.spec.ts` |
| `public-booking` | 2 | ✅ controller | Casos de error 409/422 en booking |
| `public-portal` | 2 | ❌ | `public-portal.controller.spec.ts` |
| `reporting` | 3 | ✅ controller | Reportes descargables (PDF/CSV) |
| `folio` | 3 | ❌ | `folio.controller.spec.ts` |
| `guests` | 2 | ❌ | `guests.controller.spec.ts`; cifrado de PII |
| `guest-contact` | 2 | ❌ | `guest-contact.controller.spec.ts` |
| `reviews` | 1 (service) | ❌ | `reviews-admin.controller.spec.ts`, `reviews-public.controller.spec.ts` |
| `night-audit` | 1 (service) | ❌ | `night-audit.controller.spec.ts` |
| `storage` | 2 | ❌ | `storage.controller.spec.ts` |
| `tra-export` | 1 (service) | ❌ | `tra-export.controller.spec.ts` |
| `email` | 1 (service) | ❌ | `email.controller.spec.ts` (si aplica) |
| `hotel-photos` | 1 (service) | ❌ | `hotel-photos.controller.spec.ts` |
| `system-config` | 1 (service) | ❌ | `system-config.controller.spec.ts` |
| `shared` | 4 (roles guard, authz-matrix, throttle-burst, api-contract) | — | Mantener al día con cambios de RBAC |

---

## Prioridad 1: Llenar la Capa de Integración

### 1.1 Suite de integración con Supertest (`apps/api/test/`)
**Archivos a crear:**
- `apps/api/test/app.e2e-spec.ts` — levanta el módulo NestJS completo con `Test.createTestingModule` o `NestFactory` y valida endpoints críticos.
- `apps/api/test/auth.e2e-spec.ts` — registro/login/refresh/logout con cookies.
- `apps/api/test/reservations.e2e-spec.ts` — flujo completo room type → room → reserva → check-in → check-out.

**Flujo mínimo a cubrir:**
```typescript
describe('HotelOS AI Integration', () => {
  it('flujo crítico: login → crear room → reservar → check-in → check-out', async () => {
    // 1. POST /api/auth/login → obtener accessToken + refresh cookie
    // 2. POST /api/inventory/room-types
    // 3. POST /api/inventory/rooms
    // 4. POST /api/reservations
    // 5. POST /api/operations/check-in
    // 6. GET /api/inventory/rooms/:id → status OCCUPIED
    // 7. POST /api/operations/check-out
    // 8. GET /api/inventory/rooms/:id → status DIRTY + folio CLOSED
  });
});
```

> **Nota técnica:** los tests deben usar una base de datos de test aislada (por ejemplo, `hotelos_test`) y hacer `truncate` o `prisma migrate reset --force` en `beforeAll`/`afterAll`. Nunca apuntar a la DB de desarrollo.

---

## Prioridad 2: Controller Tests Faltantes

Los controladores son el contrato de la API. Muchos ya tienen servicios testeados, pero faltan tests del contrato HTTP (status, body, guards, pipes, serialización).

**Orden recomendado por riesgo de negocio:**
1. `reservations.controller.spec.ts`
2. `inventory.controller.spec.ts`
3. `operations.controller.spec.ts`
4. `housekeeping.controller.spec.ts`
5. `folio.controller.spec.ts`
6. `pricing.controller.spec.ts`
7. `guests.controller.spec.ts`
8. `public-portal.controller.spec.ts` (endpoint público expuesto)
9. `concierge-public-csrf.controller.spec.ts` (seguridad CSRF)

---

## Prioridad 3: Tests Frontend (PMS de Staff)

El frontend tiene buena cobertura del **portal público** y algo de **reportes/pricing**, pero el PMS de staff está casi sin tests.

### Archivos a crear
- `apps/web/src/features/auth/LoginForm.test.tsx`
- `apps/web/src/features/dashboard/DashboardKPIs.test.tsx`
- `apps/web/src/features/inventory/RoomList.test.tsx`
- `apps/web/src/features/reservations/ReservationForm.test.tsx`
- `apps/web/src/features/housekeeping/HousekeepingBoard.test.tsx`
- `apps/web/src/features/folio/FolioDetail.test.tsx`

### Ejemplo corregido: LoginForm.test.tsx
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('renderiza campos de email y password', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it('muestra error con credenciales inválidas', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/correo electrónico/i), 'bad@email.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument();
    });
  });
});
```

> **Regla:** usar `userEvent`, no `fireEvent`, salvo casos excepcionales.

---

## Prioridad 4: Tests E2E Robustos

La configuración real usa `baseURL` en `http://localhost:4173` (puerto de `vite preview`) y dos proyectos: `chromium-desktop` y `chromium-mobile`. Los ejemplos del plan anterior usaban puerto 5180 (`vite dev`) y proyectos inexistentes.

### Configuración real
Ver `apps/web/playwright.config.ts`:
- `baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173'`
- Proyectos: `chromium-desktop` (1280x720) y `chromium-mobile` (Pixel 5)
- Web server: `npx vite preview --port 4173` (requiere build previo)
- API server: debe correr en puerto 3003 según `vite.config.ts` (ver `API_URL` o proxy)

### Fixtures existentes
Ya existe `apps/web/e2e/fixtures/auth.ts` con `authedPage`. Usarla en lugar de loguearse manualmente en cada test.

### Ejemplo corregido: auth.spec.ts
```typescript
import { test, expect } from '../fixtures/auth';

test('login con credenciales válidas redirige al dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/correo electrónico/i).fill('admin@hotelsumapaz.co');
  await page.getByLabel(/contraseña/i).fill('Admin123!');
  await page.getByRole('button', { name: /entrar/i }).click();

  await page.waitForURL('**/dashboard');
  await expect(page.locator('h1, h2').first()).toBeVisible();
});

test('logout redirige a login', async ({ authedPage }) => {
  await authedPage.click('[data-testid="logout-button"]');
  await authedPage.waitForURL('**/login');
});
```

### Ejemplo corregido: booking.spec.ts
```typescript
import { test, expect } from '../fixtures/auth';

test('flujo completo de reserva', async ({ authedPage }) => {
  await authedPage.goto('/reservations/new');

  // Usar selects reales; nunca hardcodear IDs ni fechas fijas
  await authedPage.getByLabel(/habitación/i).selectOption({ label: /Standard 101/i });
  await authedPage.getByLabel(/check.in/i).fill(todayPlus(1));
  await authedPage.getByLabel(/check.out/i).fill(todayPlus(4));
  await authedPage.getByLabel(/huésped/i).fill('Juan Pérez');
  await authedPage.getByRole('button', { name: /crear reserva/i }).click();

  await expect(authedPage.getByText('Juan Pérez')).toBeVisible();
  await expect(authedPage.getByText(/CONFIRMED|CONFIRMADA/i)).toBeVisible();
});
```

> **Reglas anti-fragilidad:**
> - No hardcodear `roomId` numérico; seleccionar por label visible.
> - No usar fechas fijas; usar `todayPlus(n)` con `date-fns`.
> - Cada test debe dejar el estado limpio (seed de test o transacciones revertidas).
> - No usar `cy.wait(2000)` ni `page.waitForTimeout` arbitrarios.

---

## Plan de Ejecución

| Fase | Duración | Enfoque | Objetivo |
|------|----------|---------|----------|
| **Fase 1** | 2 días | Controller tests de reservas, inventario y operaciones | Cubrir el contrato HTTP del flujo core |
| **Fase 2** | 2 días | Suite de integración `apps/api/test/` | Validar flujos end-to-end sin browser |
| **Fase 3** | 2 días | Frontend: auth, dashboard, reservas, housekeeping | Balancear cobertura PMS de staff |
| **Fase 4** | 2 días | E2E: fixtures, limpieza de estado, más flujos | Hacer los 6 E2E existentes estables y agregar 4-6 más |
| **Fase 5** | 1 día | CI/CD: correr tests en pipeline, cobertura, flakiness | Automatizar y medir |

**Total estimado:** 9 días hábiles para cerrar los gaps críticos.

---

## Comandos de Ejecución

```bash
# Backend unit tests
pnpm --filter @hotel/api test

# Frontend component tests
pnpm --filter @hotel/web test

# E2E tests (requiere build de web y API corriendo)
pnpm --filter @hotel/web build
pnpm --filter @hotel/web e2e

# Todos los tests (según turbo.json)
pnpm test

# Typecheck de ambos paquetes
pnpm typecheck
```

---

## Métricas de Éxito

| Métrica | Estado actual | Objetivo |
|---------|---------------|----------|
| Controller tests con cobertura de contrato HTTP | ~5 de 24 | 100% de módulos críticos |
| Tests de integración puros (`apps/api/test/`) | 0 | ≥3 suites |
| Tests E2E | 6 | ≥10 flujos críticos |
| Frontend: cobertura PMS de staff | Baja | ≥60% de componentes core testeados |
| Tiempo de ejecución total de test suite | Desconocido | < 5 minutos |
| Flakiness (tests inestables) | Desconocido | < 5% |

---

## Checklist de QA para Nuevos Tests

- [ ] El test usa `userEvent` en frontend, no `fireEvent`.
- [ ] El test no depende del orden de ejecución ni de estado compartido.
- [ ] Los datos de test se crean con factories o builders, no fixtures hardcodeadas.
- [ ] Los tests de BD usan una base de datos de test aislada.
- [ ] Los E2E no usan `waitForTimeout` arbitrarios; esperan por estado visible.
- [ ] Cada test tiene un único motivo para fallar.
- [ ] El nombre del test describe comportamiento observable: `should_[resultado]_when_[condición]`.
