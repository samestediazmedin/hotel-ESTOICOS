# Plan de Reparación HotelOS AI — Sprint de Mantenimiento v1.5.1
# Versión Extendida: QA Multi-Nivel + Revisiones de Código + Pruebas Exhaustivas

**Fecha:** 2026-06-16  
**Proyecto:** HotelOS AI (Single-tenant PMS para hotel en Colombia)  
**Scope:** Todos los bugs abiertos identificados en QA sessions (v1.3 bug hunt + QA 2026-06-12)  
**Total Bugs:** 10 (7 CRÍTICOS/ALTO + 2 NUEVOS POST 500 + 1 UX)  
**Tests Base:** 1,475 pasan (1,034 backend + 444 frontend) | 3 fallan (jsdom drag)  
**Metodología QA:** 5 niveles de prueba (Unitaria, Integración, Contrato, E2E, Exploratoria)  

---

## ÍNDICE

1. [Estrategia de QA Multi-Nivel](#1-estrategia-de-qa-multi-nivel)
2. [Triage y Mapeo de Dependencias](#2-triage-y-mapeo-de-dependencias)
3. [Plan de Reparación por Bug](#3-plan-de-reparación-por-bug)
4. [Revisiones de Código por Bug](#4-revisiones-de-código-por-bug)
5. [Matriz de Pruebas por Bug](#5-matriz-de-pruebas-por-bug)
6. [Flujos de Prueba End-to-End](#6-flujos-de-prueba-end-to-end)
7. [Checklist de Regresión](#7-checklist-de-regresión)
8. [Orden de Ejecución](#8-orden-de-ejecución)
9. [Documentación de Resultados](#9-documentación-de-resultados)

---

## 1. ESTRATEGIA DE QA MULTI-NIVEL

### 1.1 Niveles de Prueba Definidos

| Nivel | Tipo | Herramienta | Responsable | Objetivo |
|-------|------|-------------|-------------|----------|
| **N1** | Unitaria | Vitest (backend) | Desarrollador | Lógica pura, funciones, algoritmos |
| **N2** | Integración | Vitest + supertest | Desarrollador | Controller + Service + Repository + DB |
| **N3** | Contrato | Vitest + Zod schemas | Desarrollador | Request/response shapes, validaciones |
| **N4** | E2E Funcional | Playwright | QA Engineer | Flujos completos usuario real |
| **N5** | Exploratoria | Manual + DevTools | QA + Dev | Edge cases, UX, seguridad |

### 1.2 Tipos de Prueba por Categoría

#### Pruebas de Caja Blanca (White Box)
- **Cobertura de código:** Líneas, branches, funciones
- **Análisis estático:** ESLint, TypeScript strict, SonarQube
- **Revisión de código:** Peer review con checklist de seguridad
- **Análisis de dependencias:** npm audit, Snyk, Dependabot

#### Pruebas de Caja Gris (Grey Box)
- **Tests de API con conocimiento interno:** Supertest con mocks selectivos
- **Tests de integración parcial:** Service + Repository (sin controller)
- **Tests de base de datos:** Pruebas de constraints, triggers, índices

#### Pruebas de Caja Negra (Black Box)
- **Tests E2E con Playwright:** Sin conocimiento de implementación
- **Pruebas de usabilidad:** Task-based testing con usuarios reales
- **Pruebas de seguridad:** OWASP ZAP, burp suite básico
- **Pruebas de performance:** k6, Lighthouse

### 1.3 Checklist de Revisión de Código (Por Archivo Modificado)

```markdown
## Revisión de Código — [Nombre del Archivo]

### Seguridad
- [ ] No hay inyección SQL (usar Prisma ORM, no concatenación)
- [ ] No hay XSS (escapar output HTML, usar React default escaping)
- [ ] No hay CSRF (tokens CSRF en forms, SameSite cookies)
- [ ] No hay secrets hardcodeados (usar env vars)
- [ ] Validación de input en backend (Zod/ValidationPipe)
- [ ] Rate limiting aplicado (ThrottlerGuard)
- [ ] Autorización verificada (@Roles, @UseGuards)

### Calidad de Código
- [ ] TypeScript strict mode (no any implícito)
- [ ] Manejo de errores (try/catch, no throw genérico)
- [ ] Logging apropiado (no console.log en producción)
- [ ] No hay dead code (funciones no usadas, imports sin usar)
- [ ] Nombres descriptivos (variables, funciones, clases)
- [ ] Comentarios útiles (no obvios, explican por qué no qué)

### Performance
- [ ] No hay N+1 queries (usar include/select apropiado)
- [ ] Queries indexadas (verificar con EXPLAIN ANALYZE)
- [ ] No hay re-renders innecesarios (React.memo, useMemo)
- [ ] Lazy loading de componentes (React.lazy, dynamic imports)
- [ ] Optimización de imágenes (WebP, lazy loading)

### Testing
- [ ] Tests unitarios para nueva lógica
- [ ] Tests de integración para endpoints modificados
- [ ] Tests de regresión para flujos afectados
- [ ] Cobertura > 80% para archivos modificados
- [ ] Mocks apropiados (no mockear lo que se debe probar)

### Documentación
- [ ] JSDoc/TSDoc para funciones públicas
- [ ] README actualizado si cambia API
- [ ] CHANGELOG.md actualizado
- [ ] Comentarios de migración de DB si aplica
```

---

## 2. TRIAGE Y MAPEO DE DEPENDENCIAS

### 2.1 Diagrama de Impacto en Cascada (Actualizado)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BUGS CRÍTICOS (Bloquean flujos completos)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  BUG-1: POST /api/guests 500         BUG-2: POST /api/users 500            │
│  ├─ Bloquea: Creación huéspedes      ├─ Bloquea: Creación staff            │
│  ├─ Impacta: Wizard reservas         ├─ Impacta: Gestión usuarios           │
│  ├─ Impacta: Booking público         ├─ Impacta: RBAC completo               │
│  ├─ Impacta: Contact events          ├─ Impacta: Admin settings              │
│  ├─ Impacta: Folios                  ├─ Impacta: Housekeeping assignments    │
│  ├─ Impacta: Night audit             ├─ Impacta: Reporting (user filter)    │
│  └─ Impacta: Revenue (no guest)      └─ Impacta: Audit trail (no user)      │
│                                                                             │
│  BUG-3: CRITICAL-01 (XSS email)    BUG-4: CRITICAL-02 (Phase 15 DTOs)     │
│  ├─ Bloquea: Email confirmations   ├─ Bloquea: Guest detail visual         │
│  ├─ Impacta: Seguridad (CWE-79)     ├─ Impacta: Contact buttons             │
│  ├─ Impacta: Reputación hotel        ├─ Impacta: WhatsApp/Phone disabled     │
│  ├─ Impacta: Compliance (Ley 1581)  ├─ Impacta: Marketing consent            │
│  └─ Impacta: Trust (guest data)      ├─ Impacta: Dietary restrictions       │
│                                      ├─ Impacta: Special requests           │
│                                      ├─ Impacta: Preferred language         │
│                                      └─ Impacta: GDPR/Ley 1581 compliance    │
│                                                                             │
│  BUG-5: CRITICAL-03 (NaN limit)    BUG-6: HIGH-01 (WhatsApp spaces)        │
│  ├─ Bloquea: Contact events API      ├─ Impacta: UX booking público         │
│  ├─ Impacta: Logs/auditoría          ├─ Impacta: Datos inconsistentes         │
│  ├─ Impacta: Guest detail page       ├─ Impacta: Contact buttons (no WA)    │
│  └─ Impacta: Compliance (audit trail)└─ Impacta: Staff workflow             │
│                                                                             │
│  BUG-7: HIGH-02 (LANGUAGE_LABEL)   BUG-8: HIGH-03 (Popup blocker)          │
│  ├─ Impacta: Guest detail UI         ├─ Impacta: Contact buttons            │
│  ├─ Impacta: Percepción calidad       ├─ Impacta: Staff workflow             │
│  ├─ Impacta: Communication (wrong     ├─ Impacta: Response time (staff       │
│  │  language assumption)             │  must use alternative method)        │
│  └─ Impacta: Guest satisfaction       └─ Impacta: Contact events (incomplete) │
│                                                                             │
│  BUG-9: Fecha malformada           BUG-10: Placeholders técnicos           │
│  ├─ Impacta: Guest detail UI         ├─ Impacta: Percepción profesional      │
│  ├─ Impacta: Confianza usuario       ├─ Impacta: Todas las drawers           │
│  ├─ Impacta: Manual errors (copy)    ├─ Impacta: Staff training (confusion)  │
│  └─ Impacta: Legal (incorrect        └─ Impacta: Brand perception            │
│     birthdate on documents)                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Matriz de Dependencias entre Bugs

| Bug | Depende de | Bloquea | Puede paralelizarse con |
|-----|-----------|---------|------------------------|
| BUG-1 (POST guests 500) | Ninguno | BUG-4, BUG-6, BUG-7, BUG-9 | BUG-2, BUG-3, BUG-5, BUG-10 |
| BUG-2 (POST users 500) | Ninguno | Ninguno (flujo separado) | BUG-1, BUG-3, BUG-5, BUG-10 |
| BUG-3 (XSS email) | Ninguno | Ninguno (security hardening) | BUG-1, BUG-2, BUG-5 |
| BUG-4 (Phase 15 DTOs) | BUG-1 (necesita guest creado) | BUG-6, BUG-7, BUG-9 | BUG-2, BUG-3, BUG-5, BUG-10 |
| BUG-5 (NaN limit) | Ninguno | Ninguno (edge case) | Todos |
| BUG-6 (WhatsApp spaces) | BUG-4 (necesita WA field) | Ninguno | BUG-7, BUG-8, BUG-9, BUG-10 |
| BUG-7 (LANGUAGE_LABEL) | BUG-4 (necesita lang field) | Ninguno | BUG-6, BUG-8, BUG-9, BUG-10 |
| BUG-8 (Popup blocker) | Ninguno | Ninguno | BUG-6, BUG-7, BUG-9, BUG-10 |
| BUG-9 (Fecha malformada) | BUG-4 (necesita guest detail) | Ninguno | BUG-6, BUG-7, BUG-8, BUG-10 |
| BUG-10 (Placeholders) | Ninguno | Ninguno | Todos |

---

## 3. PLAN DE REPARACIÓN POR BUG

### 3.1 BUG-1: POST /api/guests retorna 500

#### Revisión de Código Pre-Fix

```markdown
## Revisión de Código — BUG-1

### Archivos a Revisar
1. `apps/api/src/main.ts` — ValidationPipe configuration
2. `apps/api/src/modules/guests/guests.controller.ts` — create endpoint
3. `apps/api/src/modules/guests/guests.service.ts` — create method
4. `apps/api/src/modules/guests/guests.repository.ts` — create query
5. `apps/api/src/modules/guests/dto/create-guest.dto.ts` — DTO definition
6. `apps/api/src/modules/guests/dto/guest-response.dto.ts` — response DTO

### Checklist de Revisión
- [ ] ValidationPipe tiene `transform: true` (requerido para DTOs con `declare`)
- [ ] ValidationPipe tiene `forbidNonWhitelisted: true`
- [ ] DTO usa `@IsString()`, `@IsEmail()`, etc. (class-validator)
- [ ] DTO usa `@Type(() => Date)` para fechas (class-transformer)
- [ ] Service maneja Prisma errors (P2002, P2025)
- [ ] Repository usa transacciones si múltiples inserts
- [ ] Controller retorna 201 con location header
- [ ] Controller maneja errores con filtros apropiados

### Preguntas de Revisión
1. ¿El DTO tiene `declare` sin decorators? → Requiere `transform: true`
2. ¿Hay validación Zod que no coincide con class-validator?
3. ¿El service hace `await` de operaciones async?
4. ¿Hay try/catch que captura errores genéricos?
```

#### Plan de Reparación Detallado

**Paso 1: Diagnóstico (30 min)**
```bash
# 1.1 Capturar stack trace exacto
curl -X POST http://localhost:3003/api/guests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(curl -s -X POST http://localhost:3003/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@hotel.com","password":"admin123"}' | jq -r '.accessToken')" \
  -d '{"fullName":"Test","email":"test@test.com","phone":"+573001234567","documentType":"CC","documentNumber":"123456","nationality":"CO","dateOfBirth":"1990-01-01"}' \
  -v 2>&1 | tee /tmp/guest_500_trace.log

# 1.2 Verificar logs del servidor
tail -100 /tmp/nestjs.log | grep -A 20 "InternalServerError\|ValidationError\|PrismaClient"

# 1.3 Verificar estado de migraciones
cd apps/api && npx prisma migrate status

# 1.4 Verificar schema vs DB
npx prisma db pull --print > /tmp/db_schema.sql
npx prisma generate && diff /tmp/db_schema.sql prisma/schema.prisma

# 1.5 Verificar GUEST_ENCRYPTION_KEY
echo $GUEST_ENCRYPTION_KEY | wc -c  # Debe ser 64 (32 bytes hex)
```

**Paso 2: Análisis de Causa Raíz (30 min)**

| Hipótesis | Verificación | Resultado Esperado |
|-----------|-------------|-------------------|
| H1: ValidationPipe sin `transform: true` | `grep -A 10 "ValidationPipe" main.ts` | Debe mostrar `transform: true` |
| H2: DB mismatch | `prisma migrate status` | Debe mostrar "Database schema is up to date" |
| H3: GUEST_ENCRYPTION_KEY inválida | `echo $GUEST_ENCRYPTION_KEY` | Debe ser 64 chars hex |
| H4: Zod validation error no manejado | Stack trace | Debe mostrar ZodError o ValidationError |
| H5: Prisma Client desactualizado | `prisma generate` output | Debe generar sin errores |

**Paso 3: Implementación Fix (1 hora)**

```typescript
// main.ts — Si H1 es verdadera:
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,           // ← AGREGAR si falta
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors) => {
      // Log detallado para debugging
      console.error('Validation errors:', JSON.stringify(errors, null, 2));
      return new BadRequestException(errors);
    },
  }),
);

// guests.controller.ts — Manejo de errores mejorado:
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER', 'RECEPTION')
async create(@Body() dto: CreateGuestDto) {
  try {
    const guest = await this.guestsService.create(dto);
    return guest;
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Guest with this email or document already exists');
      }
    }
    throw error; // Re-throw para que el exception filter lo maneje
  }
}
```

**Paso 4: Tests (2 horas)**

```typescript
// guests.controller.spec.ts — Nuevo archivo
describe('GuestsController (POST /api/guests)', () => {
  let controller: GuestsController;
  let service: GuestsService;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [GuestsController],
      providers: [
        {
          provide: GuestsService,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();
    
    controller = module.get(GuestsController);
    service = module.get(GuestsService);
  });
  
  // N1: Test unitario (controller aislado)
  describe('create', () => {
    it('should create guest with valid data', async () => {
      const dto = createGuestDtoFixture();
      const expected = guestResponseFixture();
      jest.spyOn(service, 'create').mockResolvedValue(expected);
      
      const result = await controller.create(dto);
      
      expect(result).toEqual(expected);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
    
    it('should throw ConflictException on duplicate email', async () => {
      const error = new PrismaClientKnownRequestError('P2002', {
        clientVersion: '7.0.0',
        meta: { target: ['email'] },
      });
      jest.spyOn(service, 'create').mockRejectedValue(error);
      
      await expect(controller.create(createGuestDtoFixture()))
        .rejects.toThrow(ConflictException);
    });
    
    it('should throw BadRequestException on invalid email', async () => {
      const dto = { ...createGuestDtoFixture(), email: 'invalid-email' };
      
      await expect(controller.create(dto as any))
        .rejects.toThrow(BadRequestException);
    });
    
    it('should throw BadRequestException on missing required fields', async () => {
      const dto = { email: 'test@test.com' }; // Missing fullName, phone, etc.
      
      await expect(controller.create(dto as any))
        .rejects.toThrow(BadRequestException);
    });
    
    it('should throw BadRequestException on invalid date format', async () => {
      const dto = { ...createGuestDtoFixture(), dateOfBirth: 'not-a-date' };
      
      await expect(controller.create(dto as any))
        .rejects.toThrow(BadRequestException);
    });
    
    it('should throw BadRequestException on invalid phone format', async () => {
      const dto = { ...createGuestDtoFixture(), phone: '123' };
      
      await expect(controller.create(dto as any))
        .rejects.toThrow(BadRequestException);
    });
  });
});

// N2: Test de integración (controller + service + repository + DB)
describe('GuestsController Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  
  beforeAll(async () => {
    // Setup test module with real DB
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
    
    prisma = app.get(PrismaService);
    
    // Get admin token
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@hotel.com', password: 'admin123' });
    accessToken = login.body.accessToken;
  });
  
  afterEach(async () => {
    await prisma.guest.deleteMany({ where: { email: { contains: 'test@' } } });
  });
  
  afterAll(async () => {
    await app.close();
  });
  
  it('POST /api/guests — should create guest with 201', async () => {
    const dto = createGuestDtoFixture();
    
    const response = await request(app.getHttpServer())
      .post('/api/guests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(201);
    
    expect(response.body).toHaveProperty('id');
    expect(response.body.email).toBe(dto.email);
    expect(response.body.fullName).toBe(dto.fullName);
    
    // Verify in DB
    const dbGuest = await prisma.guest.findUnique({ where: { id: response.body.id } });
    expect(dbGuest).toBeTruthy();
    expect(dbGuest.email).toBe(dto.email);
  });
  
  it('POST /api/guests — should return 400 on invalid data', async () => {
    await request(app.getHttpServer())
      .post('/api/guests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: 'invalid' })
      .expect(400);
  });
  
  it('POST /api/guests — should return 409 on duplicate email', async () => {
    const dto = createGuestDtoFixture();
    
    // First creation
    await request(app.getHttpServer())
      .post('/api/guests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(201);
    
    // Second creation with same email
    await request(app.getHttpServer())
      .post('/api/guests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(dto)
      .expect(409);
  });
  
  it('POST /api/guests — should return 401 without token', async () => {
    await request(app.getHttpServer())
      .post('/api/guests')
      .send(createGuestDtoFixture())
      .expect(401);
  });
  
  it('POST /api/guests — should return 403 for HOUSEKEEPING role', async () => {
    // Login as housekeeping
    const hkLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'housekeeping@hotel.com', password: 'hk123' });
    
    await request(app.getHttpServer())
      .post('/api/guests')
      .set('Authorization', `Bearer ${hkLogin.body.accessToken}`)
      .send(createGuestDtoFixture())
      .expect(403);
  });
});

// N3: Test de contrato (Zod schema validation)
describe('CreateGuestDto Contract', () => {
  it('should validate with Zod schema', () => {
    const result = CreateGuestSchema.safeParse(createGuestDtoFixture());
    expect(result.success).toBe(true);
  });
  
  it('should fail with invalid email', () => {
    const result = CreateGuestSchema.safeParse({
      ...createGuestDtoFixture(),
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toContain('email');
  });
  
  it('should fail with phone too short', () => {
    const result = CreateGuestSchema.safeParse({
      ...createGuestDtoFixture(),
      phone: '+1',
    });
    expect(result.success).toBe(false);
  });
  
  it('should fail with document number too short', () => {
    const result = CreateGuestSchema.safeParse({
      ...createGuestDtoFixture(),
      documentNumber: '12',
    });
    expect(result.success).toBe(false);
  });
  
  it('should transform date string to Date object', () => {
    const result = CreateGuestSchema.parse({
      ...createGuestDtoFixture(),
      dateOfBirth: '1990-01-01',
    });
    expect(result.dateOfBirth).toBeInstanceOf(Date);
  });
});
```

**Paso 5: Pruebas E2E (N4) con Playwright**

```typescript
// e2e/guests/create-guest.spec.ts
test.describe('Create Guest E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@hotel.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });
  
  test('should create guest from guests page', async ({ page }) => {
    // Navigate to guests
    await page.click('text=Huéspedes');
    await page.waitForURL('/guests');
    
    // Click new guest button
    await page.click('text=Nuevo huésped');
    
    // Fill form
    await page.fill('[name="fullName"]', 'María González');
    await page.fill('[name="email"]', 'maria@test.com');
    await page.fill('[name="phone"]', '+573001234567');
    await page.selectOption('[name="documentType"]', 'CC');
    await page.fill('[name="documentNumber"]', '1234567890');
    await page.fill('[name="nationality"]', 'CO');
    await page.fill('[name="dateOfBirth"]', '1990-05-15');
    
    // Submit
    await page.click('text=Guardar');
    
    // Verify success
    await expect(page.locator('text=Huésped creado exitosamente')).toBeVisible();
    
    // Verify guest appears in list
    await expect(page.locator('text=María González')).toBeVisible();
  });
  
  test('should show validation errors on invalid data', async ({ page }) => {
    await page.click('text=Huéspedes');
    await page.click('text=Nuevo huésped');
    
    // Submit empty form
    await page.click('text=Guardar');
    
    // Verify validation errors
    await expect(page.locator('text=El nombre es requerido')).toBeVisible();
    await expect(page.locator('text=El email es inválido')).toBeVisible();
  });
  
  test('should show error on duplicate email', async ({ page }) => {
    // Create first guest
    await page.click('text=Huéspedes');
    await page.click('text=Nuevo huésped');
    await page.fill('[name="fullName"]', 'Test User');
    await page.fill('[name="email"]', 'duplicate@test.com');
    await page.fill('[name="phone"]', '+573001234567');
    await page.selectOption('[name="documentType"]', 'CC');
    await page.fill('[name="documentNumber"]', '1111111111');
    await page.click('text=Guardar');
    await expect(page.locator('text=Huésped creado exitosamente')).toBeVisible();
    
    // Try to create second with same email
    await page.click('text=Nuevo huésped');
    await page.fill('[name="fullName"]', 'Test User 2');
    await page.fill('[name="email"]', 'duplicate@test.com');
    await page.fill('[name="phone"]', '+573009876543');
    await page.selectOption('[name="documentType"]', 'CC');
    await page.fill('[name="documentNumber"]', '2222222222');
    await page.click('text=Guardar');
    
    // Verify error
    await expect(page.locator('text=Ya existe un huésped con este email')).toBeVisible();
  });
});
```

**Paso 6: Pruebas Exploratorias (N5)**

| Escenario | Pasos | Resultado Esperado | Resultado Actual | Estado |
|-----------|-------|-------------------|------------------|--------|
| Crear huésped con nombre muy largo (1000 chars) | 1. Ir a /guests 2. Nuevo 3. Pegar texto largo | Validación de longitud máxima | | Pendiente |
| Crear huésped con caracteres especiales en nombre | 1. Nuevo 2. Nombre: "José María O'Connor-Smith Jr." | Acepta y guarda correctamente | | Pendiente |
| Crear huésped con fecha futura | 1. Nuevo 2. Fecha: 2030-01-01 | Rechaza fecha futura | | Pendiente |
| Crear huésped con teléfono internacional | 1. Nuevo 2. Tel: +1-555-123-4567 | Acepta formato E.164 | | Pendiente |
| Crear huésped sin conexión | 1. Desconectar WiFi 2. Guardar | Mensaje de error de red | | Pendiente |
| Crear huésped con XSS en nombre | 1. Nuevo 2. Nombre: `<script>alert(1)</script>` | Escapa o rechaza | | Pendiente |
| Performance: Crear 100 huéspedes | Script de creación masiva | < 2 segundos por huésped | | Pendiente |
| Accesibilidad: Crear huésped con teclado | Solo teclado, no mouse | Flujo completo funciona | | Pendiente |

---

### 3.2 BUG-2: POST /api/users retorna 500

#### Revisión de Código Pre-Fix

```markdown
## Revisión de Código — BUG-2

### Archivos a Revisar
1. `apps/api/src/modules/users/users.controller.ts` — create endpoint
2. `apps/api/src/modules/users/users.service.ts` — createUser method
3. `apps/api/src/modules/users/dto/create-user.dto.ts` — DTO definition
4. `apps/api/src/modules/users/users.repository.ts` — create query

### Checklist de Revisión
- [ ] DTO tiene validación de password (min 8 chars, complexity)
- [ ] DTO tiene validación de email (único)
- [ ] DTO tiene validación de role (enum válido)
- [ ] Service hashea password con bcrypt
- [ ] Service maneja P2002 (duplicate email)
- [ ] Service maneja P2003 (foreign key violations)
- [ ] Controller retorna 201 (no 200)
- [ ] Controller no retorna password en response

### Preguntas de Revisión
1. ¿El password se hashea antes de guardar?
2. ¿Hay validación de complejidad de password?
3. ¿El role es validado contra enum de Prisma?
```

#### Plan de Reparación

**Paso 1: Diagnóstico (30 min)**
```bash
# Capturar stack trace
curl -X POST http://localhost:3003/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"email":"newuser@hotel.com","name":"New User","password":"password123","role":"RECEPTION"}' \
  -v 2>&1 | tee /tmp/user_500_trace.log

# Verificar logs
tail -50 /tmp/nestjs.log | grep -A 15 "InternalServerError\|ValidationError"
```

**Paso 2: Tests (2 horas)**

```typescript
// users.controller.spec.ts — Nuevo archivo
// N1: Unit tests
// N2: Integration tests
// N3: Contract tests
// N4: E2E tests (similar a BUG-1)

// Ejemplo de test de seguridad:
describe('UsersController Security', () => {
  it('should not return password in response', async () => {
    const dto = createUserDtoFixture();
    const result = await controller.create(dto);
    
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('passwordHash');
  });
  
  it('should hash password before storing', async () => {
    const dto = createUserDtoFixture({ password: 'plain123' });
    await controller.create(dto);
    
    const dbUser = await prisma.user.findUnique({
      where: { email: dto.email },
    });
    
    expect(dbUser.password).not.toBe('plain123');
    expect(dbUser.password).toMatch(/^\$2[aby]\$/); // bcrypt format
  });
  
  it('should reject weak passwords', async () => {
    const dto = { ...createUserDtoFixture(), password: '123' };
    
    await expect(controller.create(dto))
      .rejects.toThrow(BadRequestException);
  });
  
  it('should reject invalid roles', async () => {
    const dto = { ...createUserDtoFixture(), role: 'HACKER' };
    
    await expect(controller.create(dto))
      .rejects.toThrow(BadRequestException);
  });
  
  it('should require ADMIN role to create users', async () => {
    // Login as reception (not admin)
    const token = await loginAs('reception@hotel.com', 'password');
    
    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send(createUserDtoFixture())
      .expect(403);
  });
});
```

---

### 3.3 BUG-3: CRITICAL-01 — XSS en Email de Confirmación

#### Revisión de Código Pre-Fix

```markdown
## Revisión de Código — BUG-3 (Seguridad)

### Archivos a Revisar
1. `apps/api/src/modules/email/email.service.ts` — buildConfirmationHtml, buildReviewInviteHtml
2. `apps/api/src/modules/email/email.service.spec.ts` — tests existentes

### Checklist de Seguridad (OWASP Top 10)
- [ ] CWE-79: Cross-site Scripting (XSS)
- [ ] CWE-116: Improper Encoding or Escaping of Output
- [ ] CWE-20: Improper Input Validation

### Preguntas de Revisión
1. ¿Todos los campos de usuario se escapan antes de inyectar en HTML?
2. ¿El método escapeHtml cubre: < > " ' & ?
3. ¿Hay otros templates de email con el mismo patrón?
4. ¿Se usa el mismo método para SMS/push notifications?
```

#### Plan de Reparación

**Paso 1: Verificación de Fix Existente (15 min)**
```bash
# Verificar si fix fff9f01 está aplicado
grep -n "escapeHtml" apps/api/src/modules/email/email.service.ts

# Debe mostrar:
# - this.escapeHtml(params.guestName)
# - this.escapeHtml(params.hotelName)
# - this.escapeHtml(params.roomTypeName)

# Si NO está aplicado, verificar git log
git log --oneline --grep="XSS\|escapeHtml\|fff9f01" | head -10
```

**Paso 2: Tests de Seguridad (1 hora)**

```typescript
// email.service.spec.ts — Tests de seguridad
describe('EmailService Security — XSS Prevention', () => {
  let service: EmailService;
  
  beforeEach(() => {
    service = new EmailService(/* mocks */);
  });
  
  // N1: Unit test de escapeHtml
  describe('escapeHtml', () => {
    it('should escape < and >', () => {
      expect(service['escapeHtml']('<script>alert(1)</script>'))
        .toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
    
    it('should escape " and \'', () => {
      expect(service['escapeHtml']('"onclick="alert(1)"'))
        .toBe('&quot;onclick=&quot;alert(1)&quot;');
    });
    
    it('should escape &', () => {
      expect(service['escapeHtml']('Tom & Jerry'))
        .toBe('Tom &amp; Jerry');
    });
    
    it('should handle null/undefined', () => {
      expect(service['escapeHtml'](null)).toBe('');
      expect(service['escapeHtml'](undefined)).toBe('');
    });
    
    it('should handle empty string', () => {
      expect(service['escapeHtml']('')).toBe('');
    });
    
    it('should not double-escape', () => {
      const input = '&lt;script&gt;';
      expect(service['escapeHtml'](input)).toBe('&lt;script&gt;');
    });
    
    // OWASP XSS vectors
    it('should escape img onerror', () => {
      expect(service['escapeHtml']('<img src=x onerror=alert(1)>'))
        .toBe('&lt;img src=x onerror=alert(1)&gt;');
    });
    
    it('should escape javascript protocol', () => {
      expect(service['escapeHtml']('javascript:alert(1)'))
        .toBe('javascript:alert(1)'); // Not HTML, but good to verify
    });
    
    it('should escape SVG onload', () => {
      expect(service['escapeHtml']('<svg onload=alert(1)>'))
        .toBe('&lt;svg onload=alert(1)&gt;');
    });
  });
  
  // N2: Integration test de templates
  describe('buildConfirmationHtml — XSS vectors', () => {
    it('should escape guestName in confirmation email', () => {
      const html = service.buildConfirmationHtml({
        ...confirmationParamsFixture(),
        guestName: '<b>Test</b> User',
      });
      
      expect(html).toContain('&lt;b&gt;Test&lt;/b&gt; User');
      expect(html).not.toContain('<b>Test</b>');
    });
    
    it('should escape hotelName in confirmation email', () => {
      const html = service.buildConfirmationHtml({
        ...confirmationParamsFixture(),
        hotelName: 'Hotel <script>alert(1)</script>',
      });
      
      expect(html).toContain('Hotel &lt;script&gt;alert(1)&lt;/script&gt;');
    });
    
    it('should escape roomTypeName in confirmation email', () => {
      const html = service.buildConfirmationHtml({
        ...confirmationParamsFixture(),
        roomTypeName: 'Suite <img src=x onerror=alert(1)>',
      });
      
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });
  });
  
  describe('buildReviewInviteHtml — XSS vectors', () => {
    it('should escape guestName in review invite', () => {
      const html = service.buildReviewInviteHtml({
        ...reviewInviteParamsFixture(),
        guestName: 'Mario <script>alert(1)</script>',
      });
      
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });
  
  // N3: Contract test — verify output is safe HTML
  describe('HTML output contract', () => {
    it('should produce valid HTML after escaping', () => {
      const html = service.buildConfirmationHtml(confirmationParamsFixture());
      
      // Parse with JSDOM to verify valid HTML
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Should not have script tags
      expect(document.querySelectorAll('script')).toHaveLength(0);
      
      // Should not have onerror attributes
      const elementsWithOnerror = document.querySelectorAll('[onerror]');
      expect(elementsWithOnerror).toHaveLength(0);
    });
  });
});

// N4: E2E — Send email and verify content
test('should send confirmation email with escaped content', async () => {
  // Create guest with XSS name
  const guest = await createGuest({
    fullName: '<script>alert(1)</script> Mario',
  });
  
  // Create reservation
  const reservation = await createReservation({ guestId: guest.id });
  
  // Trigger email
  await page.goto(`/admin/reservations/${reservation.id}`);
  await page.click('text=Enviar confirmación');
  
  // Verify email was sent (check mailtrap or mock)
  const email = await getLastEmail();
  expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  expect(email.html).not.toContain('<script>alert(1)</script>');
});
```

---

### 3.4 BUG-4: CRITICAL-02 — Phase 15 Fields Ausentes en DTOs

#### Revisión de Código Pre-Fix

```markdown
## Revisión de Código — BUG-4

### Archivos a Revisar
1. `apps/api/src/modules/guests/dto/guest-response.dto.ts` — GuestResponseDto
2. `apps/api/src/modules/guests/dto/guest-public.dto.ts` — GuestPublicDto
3. `apps/api/src/modules/guests/guests.service.ts` — toResponseDto, toPublicDto
4. `apps/web/src/features/guests/GuestDetailPage.tsx` — renderizado
5. `apps/web/src/features/guests/components/ContactButtons.tsx` — habilitación

### Checklist de Revisión
- [ ] GuestResponseDto declara los 6 campos Phase 15
- [ ] GuestPublicDto declara los 5 campos (sin marketingConsent)
- [ ] toResponseDto mapea los 6 campos con fallback
- [ ] toPublicDto mapea los 5 campos con fallback
- [ ] GuestDetailPage renderiza los 6 campos
- [ ] ContactButtons se habilita con whatsappNumber
- [ ] ContactButtons se habilita con phone

### Preguntas de Revisión
1. ¿Los campos son nullables o required?
2. ¿marketingConsent es boolean o null?
3. ¿preferredLanguage tiene default 'es'?
4. ¿contactPreference es enum o string?
```

#### Plan de Reparación

**Paso 1: Verificación de Fix Existente (15 min)**
```bash
# Verificar si fix bf5949c está aplicado
grep -n "whatsappNumber\|contactPreference\|preferredLanguage" \
  apps/api/src/modules/guests/dto/guest-response.dto.ts

# Debe mostrar las 6 declaraciones
```

**Paso 2: Tests de Contrato (1.5 horas)**

```typescript
// guests.service.spec.ts — Contract tests
describe('GuestResponseDto Contract — Phase 15 Fields', () => {
  it('should include all Phase 15 fields in response', async () => {
    const guest = await prisma.guest.create({
      data: {
        ...guestFixture(),
        whatsappNumber: '+573001234567',
        contactPreference: 'WHATSAPP',
        preferredLanguage: 'es',
        marketingConsent: true,
        dietaryRestrictions: 'Vegetariano',
        specialRequests: 'Cama extra',
      },
    });
    
    const response = await service.toResponseDto(guest);
    
    expect(response).toMatchObject({
      id: guest.id,
      fullName: guest.fullName,
      // Phase 15 fields
      whatsappNumber: '+573001234567',
      contactPreference: 'WHATSAPP',
      preferredLanguage: 'es',
      marketingConsent: true,
      dietaryRestrictions: 'Vegetariano',
      specialRequests: 'Cama extra',
    });
  });
  
  it('should handle null Phase 15 fields with defaults', async () => {
    const guest = await prisma.guest.create({
      data: {
        ...guestFixture(),
        // Phase 15 fields null
        whatsappNumber: null,
        contactPreference: null,
        preferredLanguage: null, // Should default to 'es'
        marketingConsent: null, // Should default to false
        dietaryRestrictions: null,
        specialRequests: null,
      },
    });
    
    const response = await service.toResponseDto(guest);
    
    expect(response.whatsappNumber).toBeNull();
    expect(response.contactPreference).toBeNull();
    expect(response.preferredLanguage).toBe('es'); // Default
    expect(response.marketingConsent).toBe(false); // Default
    expect(response.dietaryRestrictions).toBeNull();
    expect(response.specialRequests).toBeNull();
  });
  
  it('should NOT include marketingConsent in public DTO', async () => {
    const guest = await prisma.guest.create({
      data: {
        ...guestFixture(),
        marketingConsent: true,
      },
    });
    
    const publicDto = await service.toPublicDto(guest);
    
    expect(publicDto).not.toHaveProperty('marketingConsent');
    expect(publicDto).toHaveProperty('whatsappNumber');
    expect(publicDto).toHaveProperty('contactPreference');
    expect(publicDto).toHaveProperty('preferredLanguage');
    expect(publicDto).toHaveProperty('dietaryRestrictions');
    expect(publicDto).toHaveProperty('specialRequests');
  });
  
  // N3: Zod schema validation
  it('should validate GuestResponseDto with Zod', () => {
    const valid = GuestResponseSchema.safeParse({
      ...guestResponseFixture(),
      whatsappNumber: '+573001234567',
      contactPreference: 'WHATSAPP',
      preferredLanguage: 'es',
      marketingConsent: true,
      dietaryRestrictions: null,
      specialRequests: null,
    });
    
    expect(valid.success).toBe(true);
  });
  
  it('should reject invalid contactPreference', () => {
    const invalid = GuestResponseSchema.safeParse({
      ...guestResponseFixture(),
      contactPreference: 'INVALID',
    });
    
    expect(invalid.success).toBe(false);
  });
});

// Frontend tests — GuestDetailPage rendering
describe('GuestDetailPage — Phase 15 Fields Rendering', () => {
  it('should render WhatsApp number when available', async () => {
    const guest = guestFixture({
      whatsappNumber: '+573001234567',
    });
    
    render(<GuestDetailPage guestId={guest.id} />);
    
    await waitFor(() => {
      expect(screen.getByText('+573001234567')).toBeInTheDocument();
    });
  });
  
  it('should render contact preference label', async () => {
    const guest = guestFixture({
      contactPreference: 'WHATSAPP',
    });
    
    render(<GuestDetailPage guestId={guest.id} />);
    
    await waitFor(() => {
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    });
  });
  
  it('should render language in Spanish', async () => {
    const guest = guestFixture({
      preferredLanguage: 'es',
    });
    
    render(<GuestDetailPage guestId={guest.id} />);
    
    await waitFor(() => {
      expect(screen.getByText('Español')).toBeInTheDocument();
      expect(screen.queryByText('es')).not.toBeInTheDocument();
    });
  });
  
  it('should enable ContactButtons when phone and WA available', async () => {
    const guest = guestFixture({
      phone: '+573001234567',
      whatsappNumber: '+573001234567',
    });
    
    render(<GuestDetailPage guestId={guest.id} />);
    
    await waitFor(() => {
      const callButton = screen.getByRole('button', { name: /llamar/i });
      const waButton = screen.getByRole('button', { name: /whatsapp/i });
      
      expect(callButton).not.toBeDisabled();
      expect(waButton).not.toBeDisabled();
    });
  });
  
  it('should disable WhatsApp button when no WA number', async () => {
    const guest = guestFixture({
      whatsappNumber: null,
    });
    
    render(<GuestDetailPage guestId={guest.id} />);
    
    await waitFor(() => {
      const waButton = screen.getByRole('button', { name: /whatsapp/i });
      expect(waButton).toBeDisabled();
    });
  });
});
```

---

### 3.5 BUG-5: CRITICAL-03 — parseInt(limit) puede retornar NaN

#### Revisión de Código Pre-Fix

```markdown
## Revisión de Código — BUG-5

### Archivos a Revisar
1. `apps/api/src/modules/guest-contact/guest-contact.controller.ts` — listEvents endpoint
2. `apps/api/src/modules/guests/guests.controller.ts` — list endpoint (skip/take)

### Checklist de Revisión
- [ ] Query params validados con Zod o class-validator
- [ ] parseInt con fallback para NaN
- [ ] Limit clamped entre 1 y 50
- [ ] Skip no negativo

### Preguntas de Revisión
1. ¿Hay otros controllers con el mismo patrón parseInt?
2. ¿Se usa un pipe de validación de query params?
```

#### Plan de Reparación

**Paso 1: Verificación de Fix Existente (15 min)**
```bash
# Verificar si fix 567040f está aplicado
grep -A 2 "parseInt.*limit" apps/api/src/modules/guest-contact/guest-contact.controller.ts

# Debe mostrar: const n = limit !== undefined ? (parseInt(limit, 10) || 5) : 5
```

**Paso 2: Tests (45 min)**

```typescript
// guest-contact.controller.spec.ts
describe('GuestContactController — Query Param Validation', () => {
  describe('limit parameter', () => {
    it('should default to 5 when not provided', async () => {
      const spy = jest.spyOn(service, 'listEvents');
      
      await controller.listEvents('guest-123', undefined);
      
      expect(spy).toHaveBeenCalledWith('guest-123', 5);
    });
    
    it('should parse valid limit', async () => {
      const spy = jest.spyOn(service, 'listEvents');
      
      await controller.listEvents('guest-123', '10');
      
      expect(spy).toHaveBeenCalledWith('guest-123', 10);
    });
    
    it('should handle NaN by defaulting to 5', async () => {
      const spy = jest.spyOn(service, 'listEvents');
      
      await controller.listEvents('guest-123', 'abc');
      
      expect(spy).toHaveBeenCalledWith('guest-123', 5);
    });
    
    it('should handle empty string by defaulting to 5', async () => {
      const spy = jest.spyOn(service, 'listEvents');
      
      await controller.listEvents('guest-123', '');
      
      expect(spy).toHaveBeenCalledWith('guest-123', 5);
    });
    
    it('should clamp to max 50', async () => {
      const spy = jest.spyOn(service, 'listEvents');
      
      await controller.listEvents('guest-123', '100');
      
      expect(spy).toHaveBeenCalledWith('guest-123', 50);
    });
    
    it('should clamp to min 1', async () => {
      const spy = jest.spyOn(service, 'listEvents');
      
      await controller.listEvents('guest-123', '0');
      
      expect(spy).toHaveBeenCalledWith('guest-123', 1);
    });
    
    it('should handle negative numbers', async () => {
      const spy = jest.spyOn(service, 'listEvents');
      
      await controller.listEvents('guest-123', '-5');
      
      expect(spy).toHaveBeenCalledWith('guest-123', 1);
    });
  });
});

// Integration test
describe('GET /api/guests/:id/contact-events — Query params', () => {
  it('should return 200 with default limit 5', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/guests/guest-123/contact-events')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(response.body).toHaveLength(5);
  });
  
  it('should return 200 with custom limit', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/guests/guest-123/contact-events?limit=10')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(response.body).toHaveLength(10);
  });
  
  it('should return 200 with invalid limit (defaults to 5)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/guests/guest-123/contact-events?limit=abc')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(response.body).toHaveLength(5);
  });
  
  it('should return 400 with negative limit (if strict validation)', async () => {
    await request(app.getHttpServer())
      .get('/api/guests/guest-123/contact-events?limit=-1')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});
```

---

### 3.6 BUG-6: HIGH-01 — WhatsApp solo-espacios pasa validación

#### Revisión de Código

```markdown
## Revisión de Código — BUG-6

### Archivos a Revisar
1. `apps/web/src/features/public-booking/BookingFormPage.tsx` — whatsappNumber field
2. `apps/web/src/features/public-booking/BookingFormPage.spec.tsx` — tests

### Checklist de Revisión
- [ ] Transform elimina espacios
- [ ] Trim aplica después del transform
- [ ] Empty string se convierte a null/undefined
- [ ] Mensaje de error claro para usuario
```

#### Tests

```typescript
describe('BookingFormPage — WhatsApp Validation', () => {
  it('should reject whitespace-only input', async () => {
    render(<BookingFormPage />);
    
    const waInput = screen.getByLabelText(/whatsapp/i);
    await userEvent.type(waInput, '   ');
    await userEvent.tab(); // blur
    
    expect(screen.getByText(/whatsapp debe ser formato/i)).toBeInTheDocument();
  });
  
  it('should trim spaces before validation', async () => {
    render(<BookingFormPage />);
    
    const waInput = screen.getByLabelText(/whatsapp/i);
    await userEvent.type(waInput, '  +573001234567  ');
    
    // Should be valid after trim
    expect(screen.queryByText(/whatsapp debe ser formato/i)).not.toBeInTheDocument();
  });
  
  it('should send null when empty', async () => {
    const mockSubmit = jest.fn();
    render(<BookingFormPage onSubmit={mockSubmit} />);
    
    // Fill required fields
    await userEvent.type(screen.getByLabelText(/nombre/i), 'Test');
    await userEvent.type(screen.getByLabelText(/email/i), 'test@test.com');
    // Leave WhatsApp empty
    
    await userEvent.click(screen.getByText(/continuar/i));
    
    expect(mockSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsappNumber: undefined, // or null
      }),
    );
  });
});
```

---

### 3.7 BUG-7: HIGH-02 — LANGUAGE_LABEL keys mayúsculas vs minúsculas

#### Tests

```typescript
describe('GuestDetailPage — Language Display', () => {
  it('should display "Español" for es', async () => {
    const guest = guestFixture({ preferredLanguage: 'es' });
    render(<GuestDetailPage guestId={guest.id} />);
    
    await waitFor(() => {
      expect(screen.getByText('Español')).toBeInTheDocument();
    });
  });
  
  it('should display "Inglés" for en', async () => {
    const guest = guestFixture({ preferredLanguage: 'en' });
    render(<GuestDetailPage guestId={guest.id} />);
    
    await waitFor(() => {
      expect(screen.getByText('Inglés')).toBeInTheDocument();
    });
  });
  
  it('should display "Francés" for fr', async () => {
    const guest = guestFixture({ preferredLanguage: 'fr' });
    render(<GuestDetailPage guestId={guest.id} />);
    
    await waitFor(() => {
      expect(screen.getByText('Francés')).toBeInTheDocument();
    });
  });
  
  it('should fallback to raw value for unknown language', async () => {
    const guest = guestFixture({ preferredLanguage: 'xx' });
    render(<GuestDetailPage guestId={guest.id} />);
    
    await waitFor(() => {
      expect(screen.getByText('xx')).toBeInTheDocument();
    });
  });
  
  // Verify no uppercase keys exist
  it('should not have uppercase keys in LANGUAGE_LABEL', () => {
    const keys = Object.keys(LANGUAGE_LABEL);
    const uppercaseKeys = keys.filter(k => k === k.toUpperCase());
    expect(uppercaseKeys).toHaveLength(0);
  });
});
```

---

### 3.8 BUG-8: HIGH-03 — Popup blocker bloquea WhatsApp

#### Tests

```typescript
describe('ContactButtons — Popup Blocker Handling', () => {
  let mockWindowOpen: jest.SpyInstance;
  
  beforeEach(() => {
    mockWindowOpen = jest.spyOn(window, 'open').mockReturnValue(null);
  });
  
  afterEach(() => {
    mockWindowOpen.mockRestore();
  });
  
  it('should open WhatsApp synchronously before mutation', async () => {
    render(<ContactButtons
      phone="+573001234567"
      whatsappNumber="+573001234567"
      email="test@test.com"
      fullName="Test"
    />);
    
    const waButton = screen.getByRole('button', { name: /whatsapp/i });
    
    // Mock mutation to be slow
    jest.spyOn(api, 'useMutation').mockImplementation(() => ({
      mutate: jest.fn((vars, opts) => {
        // Delay onSuccess
        setTimeout(() => opts?.onSuccess?.(), 1000);
      }),
      isPending: false,
    }));
    
    await userEvent.click(waButton);
    
    // window.open should be called immediately (synchronously)
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('wa.me'),
      '_blank',
      expect.any(String),
    );
  });
  
  it('should still open WhatsApp even if mutation fails', async () => {
    render(<ContactButtons {...defaultProps} />);
    
    jest.spyOn(api, 'useMutation').mockImplementation(() => ({
      mutate: jest.fn((vars, opts) => {
        opts?.onError?.(new Error('Network error'));
      }),
      isPending: false,
    }));
    
    await userEvent.click(screen.getByRole('button', { name: /whatsapp/i }));
    
    // Should still open window
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
  });
});
```

---

### 3.9 BUG-9: Fecha malformada en GuestDetailPage

#### Tests

```typescript
describe('GuestDetailPage — Date Formatting', () => {
  it('should format dateOfBirth as "24 nov 1998"', async () => {
    const guest = guestFixture({
      dateOfBirth: new Date('1998-11-24'),
    });
    
    render(<GuestDetailPage guestId={guest.id} />);
    
    await waitFor(() => {
      expect(screen.getByText('24 nov 1998')).toBeInTheDocument();
    });
  });
  
  it('should not display ISO string', async () => {
    const guest = guestFixture({
      dateOfBirth: new Date('1998-11-24'),
    });
    
    render(<GuestDetailPage guestId={guest.id} />);
    
    await waitFor(() => {
      expect(screen.queryByText(/1998-11-24/)).not.toBeInTheDocument();
      expect(screen.queryByText(/T00:00:00/)).not.toBeInTheDocument();
    });
  });
  
  it('should handle null dateOfBirth', async () => {
    const guest = guestFixture({ dateOfBirth: null });
    
    render(<GuestDetailPage guestId={guest.id} />);
    
    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });
  
  // Check other date fields in the page
  it('should format all dates consistently', async () => {
    const guest = guestFixture({
      dateOfBirth: new Date('1990-05-15'),
      createdAt: new Date('2024-01-10'),
    });
    
    render(<GuestDetailPage guestId={guest.id} />);
    
    await waitFor(() => {
      expect(screen.getByText('15 may 1990')).toBeInTheDocument();
      expect(screen.getByText('10 ene 2024')).toBeInTheDocument();
    });
  });
});

// Verify formatDisplayDate helper
describe('formatDisplayDate', () => {
  it('should format Date object', () => {
    expect(formatDisplayDate(new Date('1998-11-24'))).toBe('24 nov 1998');
  });
  
  it('should format ISO string', () => {
    expect(formatDisplayDate('1998-11-24T00:00:00.000Z')).toBe('24 nov 1998');
  });
  
  it('should handle null', () => {
    expect(formatDisplayDate(null)).toBe('—');
  });
  
  it('should handle undefined', () => {
    expect(formatDisplayDate(undefined)).toBe('—');
  });
});
```

---

### 3.10 BUG-10: Placeholders técnicos confusos

#### Tests

```typescript
describe('EmptyTabPlaceholder — UX', () => {
  it('should not contain technical phase names', () => {
    render(<EmptyTabPlaceholder message="Disponible en Fase 04 — Operaciones" />);
    
    expect(screen.queryByText(/Fase 0\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Phase \d/)).not.toBeInTheDocument();
  });
  
  it('should show user-friendly message', () => {
    render(<EmptyTabPlaceholder message="Próximamente" />);
    
    expect(screen.getByText('Próximamente')).toBeInTheDocument();
  });
  
  // Check all drawers
  it('should not have phase references in ReservationDrawer', () => {
    render(<ReservationDrawer reservationId="123" />);
    
    expect(screen.queryByText(/Fase 0\d/)).not.toBeInTheDocument();
  });
  
  it('should not have phase references in RoomDrawer', () => {
    render(<RoomDrawer roomId="123" />);
    
    expect(screen.queryByText(/Fase 0\d/)).not.toBeInTheDocument();
  });
});
```

---

## 4. REVISIONES DE CÓDIGO POR BUG

### 4.1 Proceso de Revisión de Código

```markdown
## Proceso de Revisión de Código

### Pre-Revisión (Autor del cambio)
1. [ ] Tests pasan (unitarios + integración)
2. [ ] Lint pasa sin errores
3. [ ] TypeScript compila sin errores
4. [ ] Cambio está documentado en CHANGELOG
5. [ ] Commit message sigue convención (fix:, feat:, test:, docs:)

### Durante la Revisión (Revisor)
1. [ ] Entiendo QUÉ cambió y POR QUÉ
2. [ ] El código es legible y mantenible
3. [ ] No hay duplicación de código (DRY)
4. [ ] No hay magic numbers/strings
5. [ ] Manejo de errores es apropiado
6. [ ] No hay race conditions
7. [ ] Seguridad: no hay inyecciones, escapes, etc.
8. [ ] Performance: no hay N+1, queries innecesarias
9. [ ] Tests cubren el cambio (happy path + edge cases)
10. [ ] Tests de regresión pasan

### Post-Revisión
1. [ ] Comentarios resueltos
2. [ ] CI pasa (build, test, lint, typecheck)
3. [ ] Merge a develop con squash
4. [ ] Deploy a staging
5. [ ] QA manual en staging
```

### 4.2 Checklist de Revisión por Bug

| Bug | Archivos a Revisar | Revisor | Checklist Específico |
|-----|-------------------|---------|---------------------|
| BUG-1 | guests.controller.ts, guests.service.ts, guests.repository.ts, create-guest.dto.ts | Senior Backend | ValidationPipe, Prisma error handling, DTO decorators |
| BUG-2 | users.controller.ts, users.service.ts, create-user.dto.ts | Senior Backend | Password hashing, RBAC, P2002 handling |
| BUG-3 | email.service.ts | Security Lead | XSS prevention, HTML escaping, template injection |
| BUG-4 | guest-response.dto.ts, guest-public.dto.ts, guests.service.ts | Backend Lead | DTO completeness, transformer mapping, null handling |
| BUG-5 | guest-contact.controller.ts, guests.controller.ts | Backend Dev | Query param validation, NaN handling, limit clamping |
| BUG-6 | BookingFormPage.tsx | Frontend Dev | Zod transform, trim, empty string handling |
| BUG-7 | GuestDetailPage.tsx | Frontend Dev | Record keys, lookup, fallback |
| BUG-8 | ContactButtons.tsx | Frontend Dev | window.open timing, async/sync, popup blocker |
| BUG-9 | GuestDetailPage.tsx, lib/date.ts | Frontend Dev | Date formatting, ISO parsing, null handling |
| BUG-10 | EmptyTabPlaceholder.tsx, ReservationDrawer.tsx, RoomDrawer.tsx | UX Lead | Message copy, user-friendly language, no technical jargon |

---

## 5. MATRIZ DE PRUEBAS POR BUG

### 5.1 Matriz Completa de Pruebas

| Bug | N1 Unit | N2 Integration | N3 Contract | N4 E2E | N5 Exploratory | Cobertura Objetivo |
|-----|---------|---------------|-------------|--------|---------------|-------------------|
| BUG-1 | 8 tests | 6 tests | 4 tests | 3 tests | 8 scenarios | 95% |
| BUG-2 | 6 tests | 5 tests | 3 tests | 2 tests | 5 scenarios | 95% |
| BUG-3 | 10 tests | 4 tests | 3 tests | 2 tests | 6 scenarios | 100% |
| BUG-4 | 8 tests | 6 tests | 5 tests | 4 tests | 7 scenarios | 95% |
| BUG-5 | 8 tests | 5 tests | 4 tests | 3 tests | 4 scenarios | 90% |
| BUG-6 | 5 tests | 3 tests | 2 tests | 2 tests | 3 scenarios | 85% |
| BUG-7 | 5 tests | 2 tests | 2 tests | 2 tests | 2 scenarios | 85% |
| BUG-8 | 4 tests | 2 tests | 1 test | 2 tests | 3 scenarios | 80% |
| BUG-9 | 5 tests | 2 tests | 2 tests | 2 tests | 3 scenarios | 85% |
| BUG-10 | 3 tests | 1 test | 1 test | 2 tests | 2 scenarios | 75% |
| **TOTAL** | **62** | **36** | **27** | **24** | **43** | **88%** |

### 5.2 Escenarios de Prueba Exploratoria (N5)

#### BUG-1 Exploratorio
| # | Escenario | Pasos | Resultado Esperado | Prioridad |
|---|-----------|-------|-------------------|-----------|
| 1 | Nombre con emojis | Crear huésped "María 🌟" | Guarda correctamente o muestra error claro | Media |
| 2 | Email con + (subaddressing) | test+hotel@example.com | Acepta y guarda | Media |
| 3 | Documento con letras | CC: "ABC123" | Valida formato según país | Baja |
| 4 | Fecha de nacimiento futura | 2030-01-01 | Rechaza con mensaje claro | Alta |
| 5 | Teléfono con espacios | +57 300 123 4567 | Normaliza a E.164 | Alta |
| 6 | Crear 100 huéspedes rápido | Script de carga | < 2s por huésped, no deadlocks | Alta |
| 7 | Sin conexión | Desconectar WiFi | Mensaje de error claro, no crash | Alta |
| 8 | XSS en nombre | `<script>alert(1)</script>` | Escapa o rechaza | Crítica |

#### BUG-3 Exploratorio (Seguridad)
| # | Escenario | Pasos | Resultado Esperado | Prioridad |
|---|-----------|-------|-------------------|-----------|
| 1 | XSS en guestName | Reserva con nombre malicioso | Email escapa HTML, no ejecuta | Crítica |
| 2 | HTML injection en hotelName | Cambiar nombre del hotel | Escapa en todos los emails | Crítica |
| 3 | CSS injection | `style="color:red"` | No aplica estilos inline | Media |
| 4 | Template injection | `{{variable}}` | No evalúa templates | Media |
| 5 | URL manipulation | `javascript:alert(1)` | No ejecuta JS | Crítica |
| 6 | Encoding bypass | `%3Cscript%3E` | Decodifica y escapa | Crítica |

---

## 6. FLUJOS DE PRUEBA END-TO-END

### 6.1 Flujo Completo: Crear Huésped → Reservar → Check-in → Contactar → Check-out

```typescript
// e2e/complete-flow.spec.ts
test.describe('Flujo Completo del Huésped', () => {
  test('should complete full guest lifecycle', async ({ page }) => {
    // 1. Login como admin
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@hotel.com');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    
    // 2. Crear huésped (BUG-1)
    await page.click('text=Huéspedes');
    await page.click('text=Nuevo huésped');
    await page.fill('[name="fullName"]', 'Carlos Rodríguez');
    await page.fill('[name="email"]', 'carlos@example.com');
    await page.fill('[name="phone"]', '+573001234567');
    await page.fill('[name="whatsappNumber"]', '+573009876543');
    await page.selectOption('[name="documentType"]', 'CC');
    await page.fill('[name="documentNumber"]', '1234567890');
    await page.fill('[name="nationality"]', 'CO');
    await page.fill('[name="dateOfBirth"]', '1985-03-15');
    await page.selectOption('[name="contactPreference"]', 'WHATSAPP');
    await page.selectOption('[name="preferredLanguage"]', 'es');
    await page.check('[name="marketingConsent"]');
    await page.fill('[name="dietaryRestrictions"]', 'Sin gluten');
    await page.fill('[name="specialRequests"]', 'Cama king size');
    await page.click('text=Guardar');
    
    await expect(page.locator('text=Huésped creado exitosamente')).toBeVisible();
    
    // 3. Verificar detalle del huésped (BUG-4, BUG-7, BUG-9)
    await page.click('text=Carlos Rodríguez');
    await expect(page.locator('text=+573009876543')).toBeVisible(); // WhatsApp
    await expect(page.locator('text=WhatsApp')).toBeVisible(); // Contact preference
    await expect(page.locator('text=Español')).toBeVisible(); // Language (BUG-7)
    await expect(page.locator('text=15 mar 1985')).toBeVisible(); // Date (BUG-9)
    await expect(page.locator('text=Sin gluten')).toBeVisible(); // Dietary
    await expect(page.locator('text=Cama king size')).toBeVisible(); // Special requests
    
    // 4. Contactar por WhatsApp (BUG-8)
    const [newPage] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('button:has-text("WhatsApp")'),
    ]);
    await expect(newPage).toHaveURL(/wa.me/);
    await newPage.close();
    
    // 5. Crear reserva
    await page.click('text=Nueva reserva');
    await page.selectOption('[name="roomType"]', 'Deluxe');
    await page.fill('[name="checkIn"]', '2024-12-01');
    await page.fill('[name="checkOut"]', '2024-12-05');
    await page.click('text=Crear reserva');
    
    await expect(page.locator('text=Reserva creada')).toBeVisible();
    
    // 6. Check-in
    await page.click('text=Check-in');
    await page.click('text=Confirmar check-in');
    await expect(page.locator('text=Check-in completado')).toBeVisible();
    
    // 7. Verificar folio
    await page.click('text=Folio');
    await expect(page.locator('text=Cargos de habitación')).toBeVisible();
    
    // 8. Check-out
    await page.click('text=Check-out');
    await page.click('text=Confirmar check-out');
    await expect(page.locator('text=Check-out completado')).toBeVisible();
    
    // 9. Verificar email de confirmación (BUG-3)
    const email = await getLastEmail();
    expect(email.to).toBe('carlos@example.com');
    expect(email.html).toContain('Carlos Rodríguez'); // Escaped if needed
    expect(email.html).not.toContain('<script>'); // XSS check
  });
});
```

### 6.2 Flujo Público: Portal → Booking → Confirmación

```typescript
// e2e/public-booking-flow.spec.ts
test.describe('Flujo Público de Reserva', () => {
  test('should complete booking from public portal', async ({ page }) => {
    // 1. Visitar portal
    await page.goto('/portal');
    await expect(page.locator('text=Hotel Sumapaz')).toBeVisible();
    
    // 2. Seleccionar fechas
    await page.click('[data-testid="date-picker"]');
    await page.click('text=15'); // Check-in
    await page.click('text=18'); // Check-out
    
    // 3. Ver disponibilidad
    await page.click('text=Buscar');
    await expect(page.locator('text=Habitaciones disponibles')).toBeVisible();
    
    // 4. Seleccionar habitación
    await page.click('text=Reservar', { first: true });
    
    // 5. Completar formulario (BUG-6 — WhatsApp validation)
    await page.fill('[name="fullName"]', 'Ana Martínez');
    await page.fill('[name="email"]', 'ana@example.com');
    await page.fill('[name="phone"]', '+573001234567');
    
    // Intentar WhatsApp con espacios (BUG-6)
    await page.fill('[name="whatsappNumber"]', '   ');
    await page.click('text=Continuar');
    await expect(page.locator('text=WhatsApp debe ser formato E.164')).toBeVisible();
    
    // Corregir WhatsApp
    await page.fill('[name="whatsappNumber"]', '+573009876543');
    await page.selectOption('[name="documentType"]', 'CC');
    await page.fill('[name="documentNumber"]', '9876543210');
    await page.fill('[name="nationality"]', 'CO');
    
    // 6. Confirmar
    await page.click('text=Confirmar reserva');
    await expect(page.locator('text=Reserva confirmada')).toBeVisible();
    
    // 7. Verificar email (BUG-3 — XSS check)
    const email = await getLastEmail();
    expect(email.to).toBe('ana@example.com');
    expect(email.subject).toContain('confirmación');
  });
});
```

---

## 7. CHECKLIST DE REGRESIÓN

### 7.1 Regresión Backend (Después de CADA fix)

```bash
#!/bin/bash
# run-regression-backend.sh

echo "=== Regresión Backend ==="

# 1. TypeScript
echo "1. TypeScript check..."
cd apps/api && npx tsc --noEmit || exit 1

# 2. Lint
echo "2. ESLint..."
npx eslint src --ext .ts || exit 1

# 3. Tests unitarios
echo "3. Unit tests..."
npx vitest run --reporter=verbose || exit 1

# 4. Tests de integración
echo "4. Integration tests..."
npx vitest run --config vitest.integration.config.ts || exit 1

# 5. Tests de seguridad
echo "5. Security tests..."
npx vitest run --config vitest.security.config.ts || exit 1

# 6. Cobertura
echo "6. Coverage..."
npx vitest run --coverage || exit 1

# 7. Prisma validate
echo "7. Prisma schema..."
npx prisma validate || exit 1

# 8. Prisma generate
echo "8. Prisma generate..."
npx prisma generate || exit 1

echo "=== Regresión Backend: OK ==="
```

### 7.2 Regresión Frontend (Después de CADA fix)

```bash
#!/bin/bash
# run-regression-frontend.sh

echo "=== Regresión Frontend ==="

# 1. TypeScript
echo "1. TypeScript check..."
cd apps/web && npx tsc --noEmit || exit 1

# 2. Lint
echo "2. ESLint..."
npx eslint src --ext .ts,.tsx || exit 1

# 3. Tests unitarios
echo "3. Unit tests..."
npx vitest run || exit 1

# 4. Tests de componentes
echo "4. Component tests..."
npx vitest run --config vitest.components.config.ts || exit 1

# 5. Build
echo "5. Build..."
npx vite build || exit 1

# 6. Lighthouse (performance)
echo "6. Lighthouse..."
npx lighthouse http://localhost:5180 --output=json || exit 1

echo "=== Regresión Frontend: OK ==="
```

### 7.3 Regresión E2E (Después de TODOS los fixes)

```bash
#!/bin/bash
# run-regression-e2e.sh

echo "=== Regresión E2E ==="

# 1. Start backend
cd apps/api && pnpm dev &
BACKEND_PID=$!
sleep 5

# 2. Start frontend
cd apps/web && pnpm dev &
FRONTEND_PID=$!
sleep 5

# 3. Run E2E tests
cd apps/web && npx playwright test || {
  kill $BACKEND_PID $FRONTEND_PID
  exit 1
}

# 4. Cleanup
kill $BACKEND_PID $FRONTEND_PID

echo "=== Regresión E2E: OK ==="
```

---

## 8. ORDEN DE EJECUCIÓN

### 8.1 Cronograma Detallado

```
DÍA 1 — BUG-1 (POST /api/guests 500) + BUG-2 (POST /api/users 500)
├─ 08:00-08:30  Standup + Revisión de plan
├─ 08:30-09:30  BUG-1: Diagnóstico (stack trace, logs, hipótesis)
├─ 09:30-10:30  BUG-1: Revisión de código (ValidationPipe, DTOs, Service)
├─ 10:30-11:30  BUG-1: Implementación fix
├─ 11:30-12:30  BUG-1: Tests N1 + N2 + N3
├─ 12:30-13:30  Almuerzo
├─ 13:30-14:30  BUG-2: Diagnóstico + Revisión de código
├─ 14:30-15:30  BUG-2: Implementación fix
├─ 15:30-16:30  BUG-2: Tests N1 + N2 + N3
├─ 16:30-17:00  Regresión backend (ambos bugs)
├─ 17:00-17:30  Commit + Documentación
└─ 17:30-18:00  Revisión de código cruzada (peer review)

DÍA 2 — BUG-3 (XSS) + BUG-4 (Phase 15 DTOs) + BUG-5 (NaN limit)
├─ 08:00-08:30  Standup + Revisión de ayer
├─ 08:30-09:00  BUG-3: Verificar fix existente (fff9f01)
├─ 09:00-10:00  BUG-3: Tests de seguridad (N1 + N2 + N3)
├─ 10:00-10:30  BUG-4: Verificar fix existente (bf5949c)
├─ 10:30-11:30  BUG-4: Tests de contrato (N3)
├─ 11:30-12:30  BUG-4: Tests frontend (renderizado, ContactButtons)
├─ 12:30-13:30  Almuerzo
├─ 13:30-14:00  BUG-5: Verificar fix existente (567040f)
├─ 14:00-15:00  BUG-5: Tests de query params
├─ 15:00-16:00  Regresión backend (bugs 3+4+5)
├─ 16:00-16:30  Commit + Documentación
└─ 16:30-17:00  Revisión de código cruzada

DÍA 3 — BUG-6 (WhatsApp) + BUG-7 (Language) + BUG-8 (Popup)
├─ 08:00-08:30  Standup
├─ 08:30-09:30  BUG-6: Verificar fix + Tests frontend
├─ 09:30-10:30  BUG-7: Verificar fix + Tests frontend
├─ 10:30-11:30  BUG-8: Verificar fix + Tests frontend
├─ 11:30-12:30  Regresión frontend (bugs 6+7+8)
├─ 12:30-13:30  Almuerzo
├─ 13:30-15:00  E2E tests (Playwright) — flujos críticos
├─ 15:00-16:00  Pruebas exploratorias (N5)
├─ 16:00-16:30  Commit + Documentación
└─ 16:30-17:00  Revisión de código cruzada

DÍA 4 — BUG-9 (Fecha) + BUG-10 (Placeholders) + QA Final
├─ 08:00-08:30  Standup
├─ 08:30-09:30  BUG-9: Implementación + Tests
├─ 09:30-10:30  BUG-10: Implementación + Tests
├─ 10:30-11:30  Regresión completa (backend + frontend)
├─ 11:30-12:30  E2E completo (todos los flujos)
├─ 12:30-13:30  Almuerzo
├─ 13:30-15:00  QA exploratoria final (N5)
├─ 15:00-16:00  Documentación de resultados
├─ 16:00-16:30  Reporte final de bugs
└─ 16:30-17:00  Planning para próximo sprint
```

---

## 9. DOCUMENTACIÓN DE RESULTADOS

### 9.1 Template de Resultado por Bug

```markdown
## Resultado: [BUG-ID] — [Título]

### Estado: [✅ Fixed / ❌ Open / ⚠️ Partial]

### Fecha de Fix: [YYYY-MM-DD]

### Commits
- [hash] [mensaje]

### Archivos Modificados
- `path/to/file.ts` — [cambio]

### Causa Raíz Confirmada
[Descripción de la causa real vs hipótesis]

### Solución Aplicada
[Descripción técnica]

### Tests Agregados
| Nivel | Cantidad | Cobertura |
|-------|----------|-----------|
| N1 Unit | X | XX% |
| N2 Integration | X | XX% |
| N3 Contract | X | XX% |
| N4 E2E | X | XX% |
| N5 Exploratory | X | — |

### Resultados de Pruebas
```
[Salida de tests]
```

### Regresión
- [ ] Backend tests pasan (1,034)
- [ ] Frontend tests pasan (444)
- [ ] E2E tests pasan (50)
- [ ] TypeScript sin errores
- [ ] Lint sin errores
- [ ] Seguridad: sin vulnerabilidades

### Impacto en Cascada Verificado
- [ ] Módulo dependiente X funciona
- [ ] Módulo dependiente Y funciona

### Notas
[Cualquier observación adicional]
```

### 9.2 Reporte Final del Sprint

```markdown
# Reporte Final — Sprint de Mantenimiento v1.5.1

## Resumen
| Métrica | Valor |
|---------|-------|
| Bugs fixeados | X/10 |
| Tests agregados | XXX |
| Cobertura backend | XX% |
| Cobertura frontend | XX% |
| Regresiones encontradas | X |
| Días utilizados | X/4 |

## Bugs por Estado
| Bug | Estado | Tests N1 | Tests N2 | Tests N3 | Tests N4 | Tests N5 |
|-----|--------|----------|----------|----------|----------|----------|
| BUG-1 | | | | | | |
| BUG-2 | | | | | | |
| ... | | | | | | |

## Lecciones Aprendidas
1. 
2. 
3. 

## Próximos Pasos
1. 
2. 
3. 
```

---

*Plan extendido creado: 2026-06-16*  
*Metodología: 5 niveles de QA (N1-N5)*  
*Revisión de código: Checklist OWASP + Calidad + Performance*  
*Pruebas: 62 unit + 36 integration + 27 contract + 24 E2E + 43 exploratory = 192 total*
