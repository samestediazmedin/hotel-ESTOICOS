# Phase 9: Design System Foundation — Context

**Gathered:** 2026-05-17
**Status:** Ready for planning
**Source:** Auto-derived from Claude Design bundle (`.design-fetch/hotelos-ai/`) + REQUIREMENTS.md (VIS-01..05)

<domain>
## Phase Boundary

This phase plumbs **design tokens, fonts, dark mode, status colors, and primitive refactor** into the codebase. It does NOT restyle any screen. It produces the *foundation* that Phases 10 (Public Portal) and 11 (Internal Screens) consume.

Every color, font, and status semantic in `apps/web/src/**` must come from a single CSS-variable source of truth. The bundle's `tokens.jsx` is the canonical reference — production code must match its variable names, hex values, and dark-mode overrides verbatim.

**Out of scope for Phase 9:**
- Restyling existing screens (Login, Dashboard, Calendar, etc.) — that's Phase 10/11
- New components / pages — only refactoring existing shadcn primitives
- Backend changes — frontend `apps/web` only
- Visual asset uploads (photos, logos beyond the wordmark)

</domain>

<decisions>
## Implementation Decisions (locked by bundle + roadmap)

### CSS architecture
- **Tailwind v4 native CSS config** — use `@theme` directive in `apps/web/src/index.css`, NOT `tailwind.config.js`. Per project stack table, Tailwind v4 is the locked version.
- **CSS variables scoped to `.hos` root class** — matches bundle (`.hos { --terracotta: #c4623f; ... }`). The root `<html>` or `<body>` element must carry the `.hos` class.
- **Dark mode via `data-theme="dark"` attribute on the `.hos` root** — NOT Tailwind's default `dark:` class strategy. Bundle uses `.hos[data-theme="dark"] { ... }`.
- **No hardcoded hex values anywhere outside the token source file.** Components reference `var(--token-name)` or Tailwind utilities mapped to those tokens. Verifiable via `rg '#[0-9a-fA-F]{3,6}'` returning zero matches under `apps/web/src` except the token file.

### Color palette (verbatim from bundle)
- **Warm neutral ramp**: `--warm-white #faf7f2`, `--warm-paper #f4efe6`, `--warm-cream #ede5d6`, `--warm-tan #d4c5a9`, `--warm-line rgba(58,42,28,0.10)`, `--warm-line-strong rgba(58,42,28,0.18)`
- **Ink ramp**: `--ink-1 #2a221a`, `--ink-2 #5a4d3f`, `--ink-3 #8a7d6e`, `--ink-4 #b3a89a`
- **Brand**: `--terracotta #c4623f`, `--terracotta-deep #9d4a2e`, `--terracotta-soft #f1d4c2`, `--terracotta-tint #faeae0`, `--mustard #d4a23a`, `--mustard-soft #f1dfa9`, `--mustard-tint #faf0d4`, `--olive #6b7a3d`, `--olive-tint #e8eccf`, `--clay #8a4f3d`, `--clay-tint #ecd5cb`
- **Status (6 states)**: available `#5b9d6e/#d8ebd9`, reserved `#4a78b8/#d8e3f2`, occupied `#c4623f/#f1d4c2`, cleaning `#d4a23a/#f1dfa9`, maintenance `#8a7d6e/#e0dad0`, blocked `#2a221a/#b8b0a3`
- **Dark mode overrides** — per bundle lines 66-91 of `tokens.jsx`: warm neutrals invert to dark browns, ink ramp inverts, brand tints darken to deep tones, status backgrounds darken proportionally

### Typography
- **3 Google Font families** loaded via `@import` in `index.css`:
  - `Instrument Serif` (ital@0;1) — display / h1-h4 / `.display`
  - `Geist` (wght@300;400;500;600;700) — body default
  - `Geist Mono` (wght@400;500) — numeric values (`.num` class), code (`.mono`)
- **Body font fallback stack**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`
- **Display font fallback stack**: `'Cormorant Garamond', Georgia, serif`
- **Mono fallback stack**: `ui-monospace, 'JetBrains Mono', monospace`
- **Headings**: `font-weight: 400` (not bold), `letter-spacing: -0.01em`, italic permitted (Instrument Serif italic is signature)
- **Body**: `letter-spacing: -0.005em`, `font-feature-settings: 'cv11','ss01','ss03'`, `-webkit-font-smoothing: antialiased`
- **Numeric class**: `.num { font-family: Geist Mono; font-variant-numeric: tabular-nums; }` — KPIs, prices, dates, room numbers

### Dark mode toggle behavior
- Toggle component must read initial state from `localStorage.getItem('hos-theme')` on mount (`'light'` default if absent)
- Toggling writes `localStorage.setItem('hos-theme', newValue)` AND sets `document.documentElement.setAttribute('data-theme', newValue)` (or removes attribute for light)
- Switch must complete within one paint frame (transition is on CSS variables only — no JS-driven color animation)
- Respects `prefers-color-scheme: dark` system query ONLY if no `localStorage` value is set yet (first-visit default)

### Primitive refactor scope (shadcn components)
- Four primitives must read colors EXCLUSIVELY from CSS variables: **Button, Card, Input, Badge**
- Locate all four in `apps/web/src/components/ui/` (created during v1.0 by shadcn CLI)
- Strip hardcoded Tailwind color utilities (`bg-blue-500`, `text-gray-900`, etc.) — replace with token-mapped utilities (`bg-warm-paper`, `text-ink-1`) defined via Tailwind v4 `@theme`
- Variant additions: Button gets `terracotta` variant (primary brand button) per bundle's `.hos-btn-primary` pattern
- Card: warm-white background, warm-line border, no shadow by default (bundle uses borders not shadows)
- Input: warm-paper background, warm-line border, terracotta focus ring
- Badge: maps to status palette via `data-status` attribute pattern from bundle lines 44-56

### Verification commands (locked)
1. `rg '#[0-9a-fA-F]{3,6}' apps/web/src --glob '*.{tsx,ts,css}' --ignore-case` → returns ONLY matches inside the token source CSS file (zero matches in components/pages)
2. `rg 'text-(gray|blue|red|green|yellow|purple|pink|indigo|slate|zinc|neutral|stone|amber|orange|lime|emerald|teal|cyan|sky|violet|fuchsia|rose)-[0-9]' apps/web/src --glob '*.tsx'` → zero matches (no Tailwind palette colors outside token theme)
3. `rg 'style=\{\{.*color' apps/web/src --glob '*.tsx'` → zero matches (no inline color styles)
4. Manual visual: toggle dark mode → entire palette flips in one paint frame
5. Manual visual: status pill component renders all 6 states with bundle hex values

### Claude's Discretion
- Exact Tailwind v4 `@theme` mapping syntax for `var()` references
- Whether to expose status colors as Tailwind utilities (`bg-status-available`) or only as CSS variables — pick whichever yields cleaner consumer code
- Where to mount the dark-mode toggle component (Sidebar footer, Topbar, or both — Phase 11 will finalize placement)
- Whether `Instrument Serif` ital@1 (italic) gets a separate `.italic-serif` class or stays inline with `<i>` tag

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source (locked)
- `.design-fetch/hotelos-ai/project/tokens.jsx` — Single source of truth. Lines 4-9: typography map. Lines 18-91: full CSS variable definitions (light + dark). Lines 93-103: heading/mono/num utility classes. Lines 105-500: chrome primitives (`.hos-sidebar`, `.hos-topbar`, `.hos-nav`, `.hos-btn`, etc.) — informational only for Phase 9; consumed by Phase 11.
- `.design-fetch/hotelos-ai/chats/chat1.md` — Design decisions transcript, explains *why* terracotta/mustard/olive/clay over other palettes, why Instrument Serif italic for headings, layout decisions for portal vs PMS.
- `.design-fetch/hotelos-ai/README.md` — Handoff instructions (already read; not pixel-perfect HTML copy — recreate in React/Tailwind matching visual output).

### Project requirements
- `.planning/REQUIREMENTS.md` — VIS-01 (Tailwind v4 tokens), VIS-02 (Fonts), VIS-03 (Dark mode), VIS-04 (Status colors), VIS-05 (shadcn primitives refactor)
- `.planning/ROADMAP.md` — Phase 9 section: goal, success criteria, dependents (Phase 10 + 11 consume this foundation)
- `.planning/PROJECT.md` — Stack table (Tailwind v4, shadcn/ui, React 18), Architecture (design-system bounded context added v1.1)

### Existing code (refactor targets)
- `apps/web/src/components/ui/button.tsx` — shadcn Button (refactor for terracotta variant + token colors)
- `apps/web/src/components/ui/card.tsx` — shadcn Card (refactor backgrounds + borders)
- `apps/web/src/components/ui/input.tsx` — shadcn Input (refactor backgrounds + focus ring)
- `apps/web/src/components/ui/badge.tsx` — shadcn Badge (extend with `data-status` variant)
- `apps/web/src/index.css` OR `apps/web/src/app.css` — main CSS entry where Tailwind v4 `@theme` and `@import` directives go
- `apps/web/vite.config.ts` — confirm Tailwind v4 plugin (already installed in v1.0); no changes expected

</canonical_refs>

<specifics>
## Specific Ideas

- **`.hos` root class location**: apply to `<html>` element via `index.html` (simplest) — alternative is wrapping the React tree in `<div className="hos">` but that breaks portal mounts. Lock to `<html class="hos">`.
- **Theme toggle storage key**: `hos-theme` (not `theme` — namespaced to avoid future SaaS multi-tenant naming collisions, even though we're single-tenant)
- **Status pill component**: create `apps/web/src/components/ui/status-pill.tsx` consuming the badge primitive with `data-status` prop. Six allowed values: `available | reserved | occupied | cleaning | maintenance | blocked`. Used by Calendar, Rooms, Housekeeping in Phase 11.
- **Dark mode toggle component**: create `apps/web/src/components/ui/theme-toggle.tsx` (Switch primitive from shadcn + sun/moon icons from lucide-react). Place in Sidebar footer (Phase 11 wires it).

</specifics>

<deferred>
## Deferred Ideas

- **Component playground / Storybook**: useful for design system but not blocking. Deferred to post-v1.1.
- **Color contrast audit (WCAG AA)**: spot-check during planner verification but a full audit is deferred.
- **Animations / motion tokens**: bundle defines transition timings inline (`transition: background .12s, color .12s`) — not extracted into reusable tokens in Phase 9. Phase 10/11 will reuse inline values; centralization deferred.
- **Print stylesheet**: not in v1.1.
- **High-contrast mode (accessibility)**: not in v1.1.

</deferred>

---

*Phase: 09-design-system-foundation*
*Context gathered: 2026-05-17 — auto-derived from Claude Design bundle*
