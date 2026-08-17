# HotelOS AI — Design System

**Source:** Claude Design mockups (HTML + 11 screenshots)
**Captured:** 2026-05-13
**Reference files:**
- `design/HotelOS AI.html` (loader shell, references external JSX not exported)
- `design/screenshots/` (11 PNG captures of all screens)

This document is the **canonical design contract** for HotelOS AI. Every UI phase MUST conform to these tokens and patterns.

---

## 1. Brand

- **Product name:** HotelOS AI (logo: "HotelOS" sans + " AI" in serif italic)
- **Demo hotel:** "Hotel Sumapaz" — Bogotá, Colombia (used in mockups; real hotel name is configurable)
- **Logo mark:** Letter "H" in terracotta rounded square (~8px radius)
- **Tone:** Hospitality — warm, professional, calm, Colombian-aware. NOT clinical SaaS-cold.

---

## 2. Color Tokens

### Base palette

| Token | Hex (approx) | Usage |
|---|---|---|
| `--bg-base` | `#f0eee9` | App background, body |
| `--surface` | `#faf8f3` | Cards, sidebar, panels, drawer |
| `--surface-elevated` | `#ffffff` | Modals, popovers |
| `--surface-strong` | `#1a1612` | Dark cards (FULL status), assistant context |
| `--border-subtle` | `#e5e0d6` | Card borders, dividers |
| `--border-strong` | `#c9bfa9` | Form inputs, focus rings |

### Brand / accent

| Token | Hex (approx) | Usage |
|---|---|---|
| `--brand-primary` | `#c45a3a` | Primary buttons, logo H, active nav, "Direct" reservation tag |
| `--brand-primary-hover` | `#a8492e` | Hover state |
| `--brand-primary-soft` | `#f4dccf` | Selected row highlight, active state background |

### Text

| Token | Hex (approx) | Usage |
|---|---|---|
| `--text-primary` | `#1a1612` | Body, headings, important data |
| `--text-secondary` | `#5a544c` | Sublabels, descriptions |
| `--text-muted` | `#8a8278` | Breadcrumbs, metadata, placeholders |
| `--text-inverse` | `#f0eee9` | Text on dark surfaces |
| `--text-brand` | `#c45a3a` | Links, brand-colored CTAs |

### Status / semantic

| Token | Hex (approx) | Usage |
|---|---|---|
| `--status-pending` | `#d4a13a` (amber) | "Pendiente" limpieza, ocupación media |
| `--status-in-progress` | `#c45a3a` (terracota) | "En proceso", "Alta" priority |
| `--status-ready` | `#7a8a3e` (olive green) | "Lista", "Listas hoy" |
| `--status-verified` | `#6a7a92` (dusty blue) | "Verificada" |
| `--status-full` | `#1a1612` (near-black) | "FULL" en ocupación |
| `--status-confirmed` | `#f4dccf` (soft peach) | "Confirmada" badge |

### Channel source colors (reservations bar)

| Token | Usage |
|---|---|
| `--source-direct` | Terracota — reservas directas |
| `--source-ota` | Gris medio — Booking/Expedia (data model only in v1) |
| `--source-blocked` | Black — bloqueos/eventos |

---

## 3. Typography

### Family

- **Display / italic accents:** Serif transicional (recomendado: **Source Serif Pro**, fallback: **Lora**, **PT Serif**). Italic es feature distintivo — usado en nombres de hotel, headings, nombres propios.
- **Body / UI:** `system-ui` stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
- **Mono:** `JetBrains Mono`, `SF Mono`, `Menlo`, `Consolas` — para códigos de habitación, IDs (CC), precios

### Scale (approx)

| Token | Size | Weight | Usage |
|---|---|---|---|
| `--text-display` | 32-36px | 400 | Hotel name on portal, "Buenos días, *Valentina*" |
| `--text-h1` | 24-28px | 500 | Page titles ("Nueva reserva", "Habitaciones") |
| `--text-h2` | 18-20px | 500 | Section titles ("Habitaciones disponibles") |
| `--text-body` | 14-15px | 400 | Default body |
| `--text-small` | 13px | 400 | Labels, metadata |
| `--text-tiny` | 11-12px | 500 uppercase | Section labels ("OPERACIÓN", "LLEGADA") |

### Italic usage rule

**Use serif italic for:**
- Hotel names ("Hotel *Sumapaz*")
- Room type names ("Suite *Andina*", "Doble *Deluxe*")
- Personal greetings ("Buenos días, *Valentina*")
- Section eyebrow ("*Nueva* reserva")

**Never use italic for:**
- Buttons
- Form labels
- Generic body text
- Numeric data

---

## 4. Layout

### App shell (Desktop staff PMS)

```
┌─────────────────────────────────────────────────────────────┐
│ [H] HotelOS AI  │ Operación > [breadcrumb] │ [⌘K search] │ 🔔 👤 │
├──────────────────┬──────────────────────────────────────────┤
│                  │                                          │
│  OPERACIÓN       │                                          │
│  • Dashboard     │                                          │
│  • Reservas (24) │           MAIN CONTENT AREA              │
│  • Calendario    │                                          │
│  • Habitaciones  │                                          │
│  • Check-in/out  │                                          │
│  • Limpieza (12) │                                          │
│  • Servicios     │                                          │
│  • Huéspedes     │                                          │
│                  │                                          │
│  INTELIGENCIA    │                                          │
│  • Concierge IA  │                                          │
│  • Asistente staff                                          │
│                  │                                          │
│  ANÁLISIS        │                                          │
│  • Reportes      │                                          │
│                  │                                          │
│  ⚙ Configuración │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

- **Top bar height:** ~56px
- **Sidebar width:** 220-240px
- **Sidebar bg:** `--surface`
- **Active nav item:** `--brand-primary-soft` background, `--brand-primary` text/icon, full-width pill
- **Badges:** rounded pill, terracota fill or muted, white/dark text

### Drawer pattern (right-side)

- Width: ~600px (40% of viewport on desktop)
- Backdrop dims main content (rgba(0,0,0,0.2))
- Header: entity title + tabs (Detalles | Reservas | Limpieza | Mantenimiento | Historial) + close button
- Slides in from right with subtle ease-out

### Public portal (Mobile-first)

- Single column, max-width 480px
- Sticky top bar with hotel logo + favorite + share
- Hero photo grid (4 cells: fachada + lobby + suite + "Ver las 24 fotos")
- Italic serif hotel name
- Rating + reviews + location pin
- Tag pills row
- Date range picker (LLEGADA / SALIDA in uppercase tiny labels)
- Guest selector card
- Room cards with photo, name in serif, badge ("Más económica"), price
- Sticky bottom CTA: total + "Reservar" button

---

## 5. Components

### Buttons

| Variant | Background | Text | Border | Notes |
|---|---|---|---|---|
| Primary | `--brand-primary` | white | none | "Reservar", "Continuar", "Nueva reserva", "Tarea manual" |
| Secondary | `--surface` | `--text-primary` | `--border-strong` | "Cambiar estado", "Bloquear fechas", "Asignar" |
| Ghost / tertiary | transparent | `--text-primary` | none | "Ver historial completo", icon-only actions |
| Destructive | not seen yet | — | — | Define when implementing cancellation |

**Radius:** 8px
**Padding:** 10-12px vertical, 16-20px horizontal
**Font:** body weight 500

### Tags / chips

- Rounded pill (radius 999px)
- `--surface` background, `--text-primary` text
- 12-13px font
- Small padding (4-6px / 10-12px)
- Examples: "Hotel boutique", "42 habitaciones", "WiFi 300mb", "Aire acond.", "Más económica"

### Cards

- `--surface` background
- 12px radius
- `--border-subtle` 1px border
- Subtle shadow (only on elevation, e.g., drawer)
- Padding 16-20px

### Status pills (with colored dot)

- Small `●` colored circle + label
- Used in Kanban headers ("Pendiente 5", "En proceso 3", "Lista 3", "Verificada 3")
- Priority pills: "Alta" (red bg), "Media" (amber bg), "Baja" (muted bg)

### Tables / rows

- No vertical lines
- 1px bottom border `--border-subtle` between rows
- Row hover: `--brand-primary-soft` background
- Selected row: brighter peach + terracota left border accent

---

## 6. Iconography

- Style: thin stroke, ~1.5px weight, rounded ends
- Family: **Lucide** (matches the look) or **Phosphor** (regular weight)
- Size: 16-20px in nav, 14px inline
- Color: inherits text color, never decorative-colored

---

## 7. Spacing scale

Based on 4px base unit:

```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
```

---

## 8. Patterns confirmed in design

| Pattern | Where seen | Maps to |
|---|---|---|
| **Drawer for entity detail** | Habitación 412 detail | Inventory (Phase 2), Reservas, Huéspedes |
| **Kanban 4-column** | Limpieza screen | Housekeeping (Phase 5) — DIRTY→IN_PROGRESS→INSPECTION→CLEAN |
| **Room rack horizontal** | Calendario screen | Reservas (Phase 3) — `@schedule-x/react` |
| **Wizard 4 steps** | Nueva reserva | Reservas (Phase 3) |
| **Inline check-in checklist** | Check-in / out | Operations (Phase 4) — checkboxes for verify ID, sign register, deliver key, etc. |
| **Right-side context panel** | Asistente staff | AI Assistant (Phase 7) — shows data sources + suggested actions |
| **Sticky bottom CTA** (mobile) | Portal público | Public booking engine (Phase 3) |
| **Photo grid 4-cell** | Portal hero | Inventory (Phase 2 — room photos), Portal (Phase 3) |

---

## 9. Localization

- **Idioma:** Spanish (Colombia)
- **Moneda:** COP (Peso colombiano)
- **Formato de precio:** `$1.160k` (abreviación de miles para UI compacta), `$1.160.000` formato completo
- **Documento de identidad:** `CC 1.022.398.476` (Cédula de Ciudadanía con puntos como separador de miles)
- **Formato de fecha corto:** `14 may`, `13 may 2026`
- **Formato de hora:** `15:30` (24h)
- **Días de la semana:** `Lun 12`, `Mar 13` (3 letras + número)
- **Capitalización de labels:** UPPERCASE TINY para secciones (`OPERACIÓN`, `LLEGADA`, `HUÉSPEDES`)

---

## 10. Screens detected (and roadmap mapping)

| Screen file (en HTML) | Captura | Roadmap phase |
|---|---|---|
| `screens/portal.jsx` | `162923` (mobile portal hotel) + `162956` (desktop variant) | Phase 3 (Public Booking Engine) |
| `screens/dashboard.jsx` | `163012` | Phase 6 (Reporting + Dashboard) |
| `screens/calendar.jsx` | `163020` | Phase 3 (Reservations — room rack) |
| `screens/rooms.jsx` | `163033` (grid) + `163042` (detail drawer) | Phase 2 (Inventory) |
| `screens/reservations.jsx` | `163057` (wizard step 2) | Phase 3 (Reservations create flow) |
| `screens/operations.jsx` | `163107` (check-in/out) + `163119` (limpieza kanban) | Phase 4 + 5 (Operations + Housekeeping) |
| `screens/internal-chat.jsx` | `163135` | Phase 7 (AI Assistant — staff) |
| **`screens/portal.jsx` (concierge)** | `162941` (Concierge IA mobile) | **NOT IN ROADMAP — scope decision pending** |
| **Login screen** | **NOT DESIGNED** — Phase 1 must improvise within this system | Phase 1 |

---

## 11. Gaps

- **Login screen is not designed.** Phase 1 must invent it within this system (cream bg, terracotta CTA, serif italic for hotel name, etc.).
- **Empty states** are not explicit — must be designed per phase.
- **Error states / validation feedback** style not captured in screenshots.
- **Dark mode** not seen — assume light-only for v1.
- **Loading / skeleton** patterns not seen — define during Phase 1 implementation.
- **Mobile layouts for staff PMS** not seen — assume responsive web (not native), tablet-friendly minimum.

---

## 12. Open scope question

The design includes **TWO AI assistants**:
1. **Asistente staff** (internal, staff-only) → already in roadmap Phase 7.
2. **Concierge IA** (public, guest-facing, on portal subdomain) → **NOT in current roadmap**.

Decision pending from user before incorporating into project scope.

---

*This document is the source of truth for visual design. Every CONTEXT.md and UI-SPEC.md must reference this file.*
