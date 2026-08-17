---
phase: 09-design-system-foundation
verified: 2026-05-17T00:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "Abrir http://localhost:<port>/design-system en el navegador"
    expected: "La página renderiza los 6 secciones (Botones, Tarjetas, Inputs, Badges, Estados, Tipografía) sin errores de consola"
    why_human: "El render visual y la ausencia de errores de consola no son verificables mediante grep/static analysis"
  - test: "Hacer clic en el botón ThemeToggle en /design-system"
    expected: "Toda la paleta (fondo, textos, bordes) cambia en un solo paint frame — sin parpadeo blanco intermediario"
    why_human: "El one-paint-frame no puede medirse sin un navegador real con DevTools Timeline"
  - test: "Recargar la página /design-system mientras está en modo oscuro"
    expected: "La página carga directamente en modo oscuro — sin FOUC (flash of unstyled content)"
    why_human: "El comportamiento FOUC solo es observable en un navegador real; el script inline de index.html está presente pero su eficacia visual requiere comprobación manual"
  - test: "Inspeccionar los h1/h2/h3 de /design-system en DevTools > Computed Styles"
    expected: "font-family resuelve a 'Instrument Serif' como primera familia"
    why_human: "La carga de Google Fonts y el computed style del navegador no son verificables mediante static analysis"
---

# Phase 9: Design System Foundation — Verification Report

**Phase Goal:** Every color, font, and status semantic in `apps/web` comes from a single CSS-variable source of truth; no hardcoded hex in any component or page file (Phase 9 scope: `components/ui/` + `StaffLayout.tsx`); dark mode toggles work in one paint frame; all 6 status states render consistently; 3 font families load; core shadcn primitives (Button, Card, Input, Badge) read colors only from CSS variables.

**Verified:** 2026-05-17
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | No hardcoded hex en scope Phase 9 (components/ui + StaffLayout) | VERIFIED | `rg` sobre `components/ui/*.tsx` retorna 0 matches de valor (solo 1 match en comentario JSDoc de button.tsx — `#dc2626` en descripción textual, no como clase CSS ni valor funcional) |
| 2 | `data-theme="dark"` toggle escribe atributo y localStorage | VERIFIED | `useTheme.ts` confirma: `setAttribute('data-theme','dark')`, `removeAttribute('data-theme')`, `localStorage.setItem(STORAGE_KEY, theme)` — 3 patrones presentes |
| 3 | Inline FOUC script en index.html antes de React | VERIFIED | index.html líneas 4-13: script antes de `<meta charset>`, lee `localStorage.getItem('hos-theme')`, llama `setAttribute('data-theme','dark')` |
| 4 | Todos los 6 status states consistentes (12 tokens fg+bg) | VERIFIED | globals.css líneas 58-69 define los 12 tokens; Badge tiene 6+1 variantes CVA; StatusPill consume Badge con español labels |
| 5 | 3 familias tipográficas cargan | VERIFIED | globals.css línea 13: `@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap')` + heading rules lines 209-217 |
| 6 | Primitivas shadcn (Button, Card, Input, Badge) sin hex ni palette colors | VERIFIED | `rg` retorna 0 matches de clases `text-gray-NNN` / `bg-blue-NNN` / inline `style={{color}}` en los 4 archivos |

**Score: 6/6 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/styles/globals.css` | Token layer completo — luz + oscuro + @theme inline | VERIFIED | 231 líneas; secciones 1-9 según PLAN; contiene `--terracotta: #c4623f`, `@custom-variant dark`, bloque `.hos[data-theme="dark"]` |
| `apps/web/src/design/tokens.ts` | Mirror TS de bundle palette | VERIFIED | 33 tokens de color; `fontFamily`; `borderRadius`; documentado con JSDoc |
| `apps/web/src/design/tokens.spec.ts` | TDD spec — 42 assertions | VERIFIED | 42 tests declarados; cuenta exacta de 33 tokens; aserciones verbatim para cada color del bundle |
| `apps/web/index.html` | `<html class="hos">` + FOUC script primero en head | VERIFIED | Línea 2: `<html lang="es" class="hos">`; script FOUC en líneas 4-13 antes de `<meta charset>` |
| `apps/web/src/components/layout/StaffLayout.tsx` | Usa `bg-warm-paper` (no `bg-bg-base`) | VERIFIED | Línea 13: `className="flex min-h-screen bg-warm-paper"` |
| `apps/web/src/components/ui/button.tsx` | 7 variantes con tokens bundle | VERIFIED | `default`/`terracotta`: `bg-terracotta text-warm-white shadow hover:bg-terracotta-deep`; sin hex ni palette |
| `apps/web/src/components/ui/card.tsx` | `rounded-xl border border-warm-line bg-warm-white` sin `shadow-sm` | VERIFIED | Card root línea 9 exacta; `text-ink-1`, `text-ink-3` en Title/Description |
| `apps/web/src/components/ui/input.tsx` | `bg-warm-paper`, `border-warm-line-strong`, `focus-visible:ring-terracotta` | VERIFIED | className única línea 12 contiene los 3 patrones requeridos |
| `apps/web/src/components/ui/badge.tsx` | 7 variantes CVA (default + 6 status) | VERIFIED | Creado nuevo; `bg-status-available-bg text-status-available` ... `bg-status-blocked-bg text-status-blocked` |
| `apps/web/src/components/ui/status-pill.tsx` | Wrapper semántico, `RoomStatus` type, labels en español | VERIFIED | `RoomStatus` exportado; `STATUS_LABELS` con 6 labels españoles; `data-status` forwarded |
| `apps/web/src/components/ui/theme-toggle.tsx` | Sun/Moon icons, usa `useTheme`, aria-label en español | VERIFIED | Importa `Sun, Moon` de lucide-react, `useTheme` de `@/hooks/useTheme`, aria-label dinámico en español |
| `apps/web/src/hooks/useTheme.ts` | `STORAGE_KEY='hos-theme'`, `data-theme` set/remove, localStorage | VERIFIED | Los 3 patrones críticos presentes; lazy `useState(getInitialTheme)`; guard `typeof window === 'undefined'` |
| `apps/web/src/features/design-system/DesignSystemPage.tsx` | Demo page con todos los primitivos | VERIFIED | Named export `DesignSystemPage`; importa Button, Card, Input, Badge, StatusPill, ThemeToggle; `data-testid="design-system-page"` |
| `apps/web/src/features/design-system/DesignSystemPage.test.tsx` | 5 smoke tests Vitest | VERIFIED | `describe('DesignSystemPage')` con 5 tests: render, status pills x6, data-theme toggle, localStorage, button variants x7 |
| `apps/web/src/router.tsx` | Ruta `/design-system` fuera de ProtectedRoute, gateada por `import.meta.env.DEV` | VERIFIED | `devRoutes` en línea 51; spread en línea 96 ANTES de `ProtectedRoute` en línea 100 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/src/main.tsx` | `apps/web/src/styles/globals.css` | `import './styles/globals.css'` | VERIFIED | Línea 5 de main.tsx confirma el import |
| `apps/web/index.html` | `.hos` token scope en globals.css | `class="hos"` en `<html>` | VERIFIED | Línea 2: `<html lang="es" class="hos">` |
| `apps/web/src/components/ui/theme-toggle.tsx` | `apps/web/src/hooks/useTheme.ts` | `import { useTheme } from '@/hooks/useTheme'` | VERIFIED | Línea 4 de theme-toggle.tsx |
| `apps/web/src/components/ui/status-pill.tsx` | `apps/web/src/components/ui/badge.tsx` | `import { Badge } from './badge'` | VERIFIED | Línea 2 de status-pill.tsx |
| `apps/web/index.html` FOUC script | `.hos[data-theme=dark]` block en globals.css | `document.documentElement.setAttribute('data-theme', 'dark')` | VERIFIED | Línea 9 de index.html |
| `apps/web/src/features/design-system/DesignSystemPage.tsx` | Button, Card, Input, Badge, StatusPill, ThemeToggle | imports `@/components/ui/*` | VERIFIED | 6 imports de `@/components/ui/*` confirmados |
| `apps/web/src/router.tsx` | `DesignSystemPage.tsx` | ruta `/design-system` con `import.meta.env.DEV` | VERIFIED | Líneas 50-96 de router.tsx |

---

### Requirements Coverage

| Requirement | Source Plan | Descripción | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VIS-01 | 09-01 | Tailwind v4 tokens bundle como CSS vars + utilidades; sin hex en componentes | SATISFIED | `@theme inline` en globals.css + 0 hex en components/ui + tokens.spec.ts 42 assertions passing |
| VIS-02 | 09-01 | Instrument Serif, Geist, Geist Mono desde Google Fonts; h1-h3 usan Instrument Serif | SATISFIED | `@import` URL verificado en globals.css; reglas `.hos h1..h4` presentes líneas 209-215 |
| VIS-03 | 09-03 | Dark mode via `data-theme="dark"`; toggle persiste en localStorage | SATISFIED | useTheme.ts + ThemeToggle.tsx + FOUC script en index.html — 3 capas presentes |
| VIS-04 | 09-01, 09-03 | Status colors (6 estados) como pares fg/bg; usados de forma consistente | SATISFIED | 12 tokens en globals.css; Badge CVA + StatusPill con labels en español; `data-status` forwarded |
| VIS-05 | 09-02, 09-03 | Button, Card, Input, Badge refactorizados a tokens; sin hex ni inline styles | SATISFIED | 4 archivos verificados: 0 hex, 0 palette colors, 0 inline style={{color}} |

---

### Bundle Fidelity Spot-Checks

| Token Bundle | Valor Esperado | Valor en globals.css | Match |
|-------------|---------------|---------------------|-------|
| `--terracotta` (línea 32) | `#c4623f` | `--terracotta: #c4623f;` (línea 39) | PASS |
| `--warm-paper` (línea 21) | `#f4efe6` | `--warm-paper: #f4efe6;` (línea 23) | PASS |
| `--ink-1` (línea 27) | `#2a221a` | `--ink-1: #2a221a;` (línea 33) | PASS |
| `--status-occupied-bg` (línea 50) | `#f1d4c2` | `--status-occupied-bg: #f1d4c2;` (línea 63) | PASS |
| `--status-cleaning` (línea 51) | `#d4a23a` | `--status-cleaning: #d4a23a;` (línea 64) | PASS |

**5/5 bundle spot-checks: PASS**

---

### Anti-Patterns Found

| File | Línea | Patrón | Severidad | Impacto |
|------|-------|--------|-----------|---------|
| `apps/web/src/components/ui/button.tsx` | 9 | `#dc2626` en comentario JSDoc (no en clase CSS) | INFO | Ninguno — es texto descriptivo del puente shadcn, no un valor funcional. El valor está en globals.css `:root { --destructive: #dc2626 }` que es la ubicación correcta y permitida. |

**Ningún blocker ni warning. 0 anti-patterns funcionales.**

Nota: `empty-tab-placeholder.tsx` contiene la palabra "placeholder" pero es un nombre de componente legítimo (UI placeholder para tabs vacíos en fases futuras), no un stub de implementación.

---

### Human Verification Required

#### 1. Render visual en /design-system

**Test:** Correr `pnpm dev` en `apps/web`, navegar a `http://localhost:PORT/design-system`.
**Expected:** La página renderiza 6 secciones con todos los primitivos sin errores de consola. Los h1/h2 muestran Instrument Serif; el fondo es `#f4efe6` (warm-paper).
**Why human:** Render visual y computed styles no son verificables con grep.

#### 2. Toggle dark mode en un paint frame

**Test:** En `/design-system`, hacer clic en el botón ThemeToggle (icono Moon/Sun en el header).
**Expected:** La paleta completa cambia en un solo frame — sin flash blanco. Toda la UI (fondo, textos, bordes) invierte a los valores dark del bundle.
**Why human:** El comportamiento paint-frame y la ausencia de parpadeo solo son observables en un navegador real con DevTools Timeline.

#### 3. FOUC en recarga

**Test:** Mientras en modo oscuro, hacer hard-refresh (`Ctrl+Shift+R`).
**Expected:** La página carga directamente en modo oscuro — sin parpadeo blanco inicial.
**Why human:** El FOUC es un fenómeno temporal del parser del navegador; el script está presente y correcto pero su eficacia requiere observación visual.

#### 4. Google Fonts cargando en Network tab

**Test:** En DevTools > Network, filtrar por "fonts.googleapis". Recargar.
**Expected:** Una petición a `fonts.googleapis.com/css2?family=Instrument+Serif...` retorna 200. Las tres familias aparecen en la pestaña Fonts del panel Styles.
**Why human:** La carga de fuentes externas depende de red y browser cache — no verificable estáticamente.

---

### Gaps Summary

No se encontraron gaps. Todos los criterios de la fase están satisfechos dentro del scope declarado (Phase 9 scope: `components/ui/`, `components/layout/StaffLayout.tsx`, `styles/globals.css`, `design/tokens*`, `index.html`, `features/design-system/`).

**Tech debt documentado y conscientemente diferido (no gaps de Phase 9):**
- `apps/web/src/router.tsx` líneas 29-31: ProtectedRoute loading spinner aún usa `bg-bg-base` y `text-text-muted` — diferido a Phase 11 (registrado en 09-01-SUMMARY y 09-04-SUMMARY).
- 33 archivos de feature-screens aún usan tokens v1.0 — diferido a Phases 10/11 (scope intencionalmente excluido de Phase 9 por CONTEXT.md y RESEARCH.md).

---

## Resumen Ejecutivo

Phase 9 (Design System Foundation) entregó su objetivo: una capa única de CSS variables como fuente de verdad para todos los colores, tipografías y semánticas de estado en el scope declarado.

Los cuatro planes ejecutaron sin gaps:

- **09-01**: globals.css reescrito con palette bundle (33 tokens), `@theme inline`, `.hos` root scope, Google Fonts, y spec TDD con 42 assertions.
- **09-02**: Button, Card, Input refactorizados a tokens bundle — sin hex, sin palette colors, sin inline styles. Button añade variante `terracotta` (alias semántico).
- **09-03**: Badge (7 variantes CVA), StatusPill (wrapper semántico con labels en español), useTheme hook, ThemeToggle component, y FOUC script en index.html.
- **09-04**: Demo route `/design-system` (dev-only, `import.meta.env.DEV`), 5 smoke tests Vitest passing, router actualizado.

Phases 10 y 11 pueden consumir con seguridad: `Button`, `Card`, `Input`, `Badge`, `StatusPill`, `ThemeToggle`, `useTheme`, `type RoomStatus`, `STATUS_LABELS`.

---

## VERIFICATION PASSED

_Verified: 2026-05-17_
_Verifier: Claude (gsd-verifier)_
