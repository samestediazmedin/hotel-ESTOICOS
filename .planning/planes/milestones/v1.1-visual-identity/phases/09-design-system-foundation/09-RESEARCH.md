# Phase 9: Design System Foundation — Research

**Researched:** 2026-05-17
**Domain:** CSS custom properties, Tailwind v4 `@theme`, shadcn/ui primitives, dark mode strategy, Google Fonts
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **CSS architecture**: Tailwind v4 native CSS config — `@theme` directive in `apps/web/src/styles/globals.css`, NOT `tailwind.config.js`.
- **CSS variables scoped to `.hos` root class** — bundle pattern: `.hos { --terracotta: #c4623f; }`. Root `<html>` must carry `.hos` class.
- **Dark mode via `data-theme="dark"` attribute** on the `.hos` root — NOT Tailwind's default `dark:` class strategy.
- **No hardcoded hex values anywhere outside the token source CSS file.** Verifiable via `rg '#[0-9a-fA-F]{3,6}'`.
- **Exact hex values verbatim from bundle** (tokens.jsx lines 18-91) — see palette table in CONTEXT.md.
- **3 Google Fonts via `@import` in `index.css`**: Instrument Serif (ital@0;1), Geist (wght@300;400;500;600;700), Geist Mono (wght@400;500).
- **Status palette via `data-status` attribute pattern** (tokens.jsx lines 264-269).
- **4 primitives in scope**: Button, Card, Input, Badge. Only these 4 are refactored in Phase 9.
- **`.hos` root class** applied to `<html>` via `index.html` (NOT a React wrapper div — breaks portals).
- **Theme toggle key**: `hos-theme` in localStorage (namespaced).
- **New components to create**: `status-pill.tsx` and `theme-toggle.tsx`.

### Claude's Discretion
- Exact Tailwind v4 `@theme` mapping syntax for `var()` references.
- Whether to expose status colors as Tailwind utilities (`bg-status-available`) or only as CSS variables.
- Where to mount the dark-mode toggle component (Sidebar footer, Topbar, or both).
- Whether `Instrument Serif` ital@1 gets a separate `.italic-serif` class or stays inline with `<i>` tag.

### Deferred Ideas (OUT OF SCOPE)
- Component playground / Storybook — post-v1.1.
- Color contrast audit (WCAG AA) — spot-check only.
- Animations / motion tokens — not extracted in Phase 9.
- Print stylesheet — not in v1.1.
- High-contrast mode — not in v1.1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIS-01 | Tailwind v4 config exports all bundle tokens as CSS variables AND Tailwind utility classes; zero hardcoded hex in any component | `@theme inline` block in globals.css maps `--color-*` to CSS vars; existing `@theme inline` pattern already in place, needs token replacement |
| VIS-02 | Instrument Serif (display), Geist (body), Geist Mono (numerics) loaded from Google Fonts; all h1/h2/h3 use Instrument Serif | `@import` in globals.css; replace `@fontsource/source-serif-4` with Google Fonts URLs |
| VIS-03 | Dark mode toggles via `data-theme="dark"` on `.hos` root; dark palette from bundle; toggle persists to `localStorage` | `@custom-variant` directive + `useTheme` hook pattern documented |
| VIS-04 | Status colors (available/reserved/occupied/cleaning/maintenance/blocked) exist as utility classes with fg/bg pairs | 12 CSS vars (6 fg + 6 bg) + 12 `@theme inline` mappings + new `status-pill.tsx` component |
| VIS-05 | Core shadcn primitives (Button, Card, Input, Badge) refactored to read tokens; no inline styles or hardcoded colors | Diff analysis complete — all 3 existing primitives already use token-based utilities; Badge must be created; no inline colors found |
</phase_requirements>

---

## Summary

The project already has a working Tailwind v4 `@theme inline` design token system in `apps/web/src/styles/globals.css`, but it was built against Phase 1's v1.0 token set (`--brand-primary`, `--surface`, `--bg-base`, etc.) which is a simplified version of the canonical bundle palette. Phase 9 must replace this entire token layer with the bundle's token names verbatim (`--warm-white`, `--ink-1`, `--terracotta`, `--status-available`, etc.) and wire in the `.hos` root class + dark mode via `data-theme`.

The three existing shadcn primitives (Button, Card, Input) are already clean — they reference design-system tokens via Tailwind utilities and contain no hardcoded hex. Badge does not exist yet and must be created. The critical token-replacement work is in `globals.css` and `tokens.ts`, not in the components themselves.

The blast radius for hardcoded colors is 33 feature-screen files, all of which are Phase 10/11 scope. The 4 primitive files in `apps/web/src/components/ui/` are clean. The only CSS file with hex values is `globals.css` (which is the intended token source) plus `design/tokens.ts` (sync mirror, also legitimate).

**Primary recommendation:** Replace the globals.css token layer wholesale with the bundle palette, add `.hos` class to `<html>`, implement `useTheme` hook, create `badge.tsx` + `status-pill.tsx`, and add the `@custom-variant` dark directive. The existing `@theme inline` pattern is confirmed correct for Tailwind v4 — no architectural changes needed, only a content replacement.

---

## Standard Stack

### Core (already installed — confirmed from package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tailwindcss` | `^4.0.0` (v4.x) | Utility CSS + `@theme` | Already installed; CSS-native config via `@theme inline` |
| `@tailwindcss/vite` | `^4.3.0` | Vite integration | Confirmed in vite.config.ts — `tailwindcss()` plugin |
| `class-variance-authority` | `^0.7.1` | Component variant API | Used by Button today |
| `clsx` + `tailwind-merge` | installed | Class merging | Used by `cn()` utility |
| `lucide-react` | `^0.525.0` | Icons (Sun/Moon for toggle) | Already installed |

### New Dependencies Required

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@fontsource/source-serif-4` | Remove | Old Phase 1 font | Replace with Google Fonts `@import` in globals.css |

No new `npm install` required. Google Fonts are loaded via CSS `@import` — no package.

### Tailwind v4 @theme Directive — Verified Pattern

Tailwind v4 uses `@theme inline` (or `@theme`) inside a CSS file imported by Vite. The `inline` modifier means Tailwind reads the resolved CSS variable values at build time for utility generation rather than emitting new custom properties.

**CRITICAL DISTINCTION** (confirmed by Tailwind v4 docs):

```css
/* Pattern A — what the project already uses and should continue */
@theme inline {
  --color-terracotta: var(--terracotta);
}
/* Generates: bg-terracotta, text-terracotta, etc. */
/* The utility resolves to: background-color: var(--terracotta) at runtime */
```

```css
/* Pattern B — DO NOT use this */
@theme {
  --color-terracotta: #c4623f;
}
/* This emits a new --color-terracotta custom property alongside the utility */
/* Does not leverage the .hos scoping — dark mode overrides won't work */
```

Use Pattern A (`@theme inline` + `var()` references) so that when `.hos[data-theme="dark"]` overrides `--terracotta`, Tailwind utilities automatically pick up the new value. This is exactly what the project already does in globals.css — the pattern is correct, only the token names need replacing.

**Naming convention for `@theme inline`**:

```css
/* Rule: --color-{name} in @theme inline → generates bg-{name}, text-{name}, border-{name}, etc. */
--color-warm-white:   var(--warm-white);   /* → bg-warm-white, text-warm-white */
--color-ink-1:        var(--ink-1);        /* → bg-ink-1, text-ink-1 */
--color-terracotta:   var(--terracotta);   /* → bg-terracotta, text-terracotta */
--color-status-available: var(--status-available); /* → bg-status-available, text-status-available */
```

Note: hyphens in token names become hyphens in utility classes. `ink-1` → `text-ink-1`. This is valid Tailwind v4 syntax.

---

## Architecture Patterns

### File Ownership After Phase 9

```
apps/web/
├── index.html                        # ADD: class="hos" to <html>
├── src/
│   ├── styles/
│   │   └── globals.css               # REPLACE: entire :root + @theme inline block
│   ├── design/
│   │   ├── tokens.ts                 # REPLACE: hex values to match bundle
│   │   └── tokens.spec.ts            # UPDATE: assertions to match new token names
│   ├── components/
│   │   └── ui/
│   │       ├── button.tsx            # MINOR UPDATE: add terracotta variant
│   │       ├── card.tsx              # MINOR UPDATE: map to new token names
│   │       ├── input.tsx             # MINOR UPDATE: map to new token names
│   │       ├── badge.tsx             # CREATE NEW: data-status variant system
│   │       ├── status-pill.tsx       # CREATE NEW: semantic status component
│   │       └── theme-toggle.tsx      # CREATE NEW: useTheme hook + Sun/Moon button
│   └── hooks/
│       └── useTheme.ts               # CREATE NEW (or colocate in theme-toggle.tsx)
```

### Pattern 1: `.hos` Root Class — `index.html` Approach

Apply the `.hos` class directly to the `<html>` element. This is the only correct approach for a single-page React app — applying it to a `<div>` wrapper inside React would break Radix UI portals (modals, dropdowns, tooltips) which render at `document.body`, outside the React tree.

**Current state**: `index.html` line 2 has `<html lang="es">` — no `.hos` class.

**Required change**: `<html lang="es" class="hos">` — single-character edit.

**Dark mode attribute**: also on `<html>`, set by the `useTheme` hook via `document.documentElement.setAttribute('data-theme', 'dark')`.

### Pattern 2: `globals.css` Token Layer Structure

The replacement follows this exact structure (matching what already exists but with bundle token names):

```css
/* SECTION 1: Google Fonts @import */
@import url('https://fonts.googleapis.com/css2?family=...');

/* SECTION 2: Tailwind base import */
@import "tailwindcss";

/* SECTION 3: .hos light mode token definitions */
.hos {
  --warm-white: #faf7f2;
  /* ... all bundle tokens ... */
}

/* SECTION 4: .hos dark mode overrides */
.hos[data-theme="dark"] {
  --warm-white: #1a1612;
  /* ... dark overrides ... */
}

/* SECTION 5: @custom-variant for dark mode Tailwind utilities */
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

/* SECTION 6: @theme inline — maps CSS vars to Tailwind utility names */
@theme inline {
  --color-warm-white: var(--warm-white);
  /* ... all token mappings ... */
  --font-family-display: var(--font-display);
}

/* SECTION 7: shadcn compatibility layer (maps shadcn internal vars to our tokens) */
:root {
  --background: var(--warm-paper);
  --foreground: var(--ink-1);
  /* ... etc ... */
}

/* SECTION 8: Base resets */
.hos * { box-sizing: border-box; }
```

**Import order is significant in Tailwind v4**: `@import "tailwindcss"` must come before `@theme` directives but can come after external `@import` URL statements. The existing globals.css has `@import "tailwindcss"` at line 9, which is correct.

### Pattern 3: `@custom-variant` for Dark Mode

Tailwind v4 supports a `@custom-variant` directive that allows using `dark:` utility prefixes with a non-class strategy:

```css
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));
```

This means `dark:bg-warm-paper` compiles to a CSS rule that matches when any ancestor has `data-theme="dark"`. However, the primary dark mode mechanism for this project is CSS variable overriding — the `.hos[data-theme="dark"]` block redefines variables, so `bg-warm-paper` automatically uses the dark value. The `@custom-variant` is useful for the few cases where you need a structurally different layout in dark mode, not just a color swap.

**Recommendation (Claude's Discretion)**: Include the `@custom-variant dark` directive in globals.css for completeness and future use, but rely on CSS variable overriding as the primary mechanism. Do not expose status colors as separate `dark:` utilities — the data-status attribute pattern handles both modes automatically.

### Pattern 4: `useTheme` Hook

```typescript
// Minimal hook pattern — colocate in theme-toggle.tsx or extract to hooks/useTheme.ts
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'hos-theme';

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Read from localStorage first; fall back to system preference
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return { theme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') };
}
```

This pattern is well-established in the shadcn community (next-themes library uses the same shape). No external library needed — the hook is 20 lines.

**FOUC prevention**: The first-render flash problem occurs because React reads localStorage *after* paint. The mitigation is an inline `<script>` in `index.html` that runs synchronously before React mounts:

```html
<script>
  (function() {
    var t = localStorage.getItem('hos-theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  })();
</script>
```

Place this script immediately after `<html class="hos">` opens, before `<head>`. This is the industry-standard FOUC prevention pattern (used by next-themes, shadcn examples, Remix).

### Pattern 5: Badge Component with `data-status`

The Badge primitive does not exist yet. Create it following the bundle's `.hos-pill` pattern, with CVA for variant management:

```typescript
// Rendered: <span className="hos-pill" data-status="available">...</span>
// CSS drives color via: .hos-pill[data-status="available"] { background: var(--status-available-bg); color: var(--status-available); }

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default:     'bg-warm-cream text-ink-2',
        available:   'bg-status-available-bg text-status-available',
        reserved:    'bg-status-reserved-bg text-status-reserved',
        occupied:    'bg-status-occupied-bg text-status-occupied',
        cleaning:    'bg-status-cleaning-bg text-status-cleaning',
        maintenance: 'bg-status-maintenance-bg text-status-maintenance',
        blocked:     'bg-status-blocked-bg text-status-blocked',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);
```

Two valid approaches for the `data-status` CSS strategy:

| Approach | Pros | Cons |
|----------|------|------|
| A: CVA variants with Tailwind token utilities | Type-safe, IDE autocomplete, no attribute selectors | More verbose token names in JSX |
| B: CSS attribute selectors (`.hos-pill[data-status="available"]`) | Matches bundle exactly, semantic HTML | Requires CSS rules outside Tailwind utilities |

**Recommendation**: Use Approach A (CVA variants with Tailwind token utilities) for the Phase 9 primitive. The `data-status` attribute can still be added as a data attribute for external CSS targeting, but the colors come from the CVA variant classes. This keeps the component Tailwind-native and type-safe.

### Anti-Patterns to Avoid

- **Wrapping the React tree in `<div className="hos">`**: breaks Radix portals. Must be on `<html>`.
- **Using `@theme` without `inline`**: emits duplicate CSS custom properties that conflict with the `.hos`-scoped variables. Always use `@theme inline` when token values reference CSS variables.
- **Loading Google Fonts with `<link>` in index.html instead of `@import`**: when using `@import` in globals.css that Tailwind v4 processes, the font import must be at the very top (before `@import "tailwindcss"`). If using `<link>`, it should be in `<head>` with `rel="preconnect"` hints. Both work — see Pitfall #3 for the trade-off.
- **Dark mode via `dark:` Tailwind class prefix without the `@custom-variant` declaration**: will produce no output in Tailwind v4 if the variant is not registered.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS variable dark mode | Custom context + JS color injection | CSS variable override in `.hos[data-theme="dark"]` | CSS handles it at paint time, no JS re-render |
| Theme persistence | Cookie-based or server-side theme | `localStorage` + inline script FOUC guard | Standard SPA approach; no server roundtrip |
| Variant-to-class mapping | `switch` statements over variant props | `class-variance-authority` (already installed) | Type-safe, zero runtime overhead |
| Font loading performance | Self-hosted font files | Google Fonts `display=swap` | Single `@import` URL, browser cache shared across sites |

---

## Common Pitfalls

### Pitfall 1: Token Name Mismatch Between globals.css and tokens.ts

**What goes wrong:** The existing `tokens.ts` uses names like `'brand-primary': '#c45a3a'` while the bundle uses `--terracotta: #c4623f`. Both `#c45a3a` and `#c4623f` are similar but NOT identical terracotta shades — they differ by one nibble. The existing v1.0 token set was a simplified approximation, not the exact bundle values.

**Root cause:** Phase 1 created a design system from scratch before the Claude Design bundle existed. The bundle came later (Phase 8 handoff). The values diverge.

**How to avoid:** Replace ALL hex values in both `globals.css` and `tokens.ts` simultaneously, using `tokens.jsx` as the single reference. The `tokens.spec.ts` assertions must also be updated to match the new bundle hex values. Running `vitest run src/design/tokens.spec.ts` after the replacement verifies parity.

**Warning signs:** `tokens.spec.ts` failing with "expected '#c4623f' but received '#c45a3a'" after replacement means one file was updated but not the other.

### Pitfall 2: shadcn Compatibility Layer After Token Rename

**What goes wrong:** The existing `globals.css` has a shadcn compatibility block (lines 100-120) mapping `--background`, `--foreground`, `--primary`, etc. to the v1.0 tokens. After renaming tokens, shadcn components that read `--primary` or `--border` will break if the compatibility layer is not updated.

**Root cause:** shadcn primitives use its own CSS variable names internally (e.g., `bg-primary`, `text-foreground`). The compatibility layer bridges shadcn → our tokens. If we rename our tokens but forget to update the bridge, shadcn variables resolve to undefined.

**How to avoid:** Update the shadcn compatibility block in the same commit as the token rename. Map:
- `--background` → `var(--warm-paper)` (was `var(--bg-base)`)
- `--foreground` → `var(--ink-1)` (was `var(--text-primary)`)
- `--primary` → `var(--terracotta)` (was `var(--brand-primary)`)
- `--border` → `var(--warm-line)` (was `var(--border-subtle)`)
- `--ring` → `var(--terracotta)` (was `var(--brand-primary)`)

### Pitfall 3: Google Fonts `@import` Order in Tailwind v4

**What goes wrong:** Placing `@import url('https://fonts.googleapis.com/...')` after `@import "tailwindcss"` causes Tailwind's CSS processing to fail or produce unexpected output in some bundler configurations.

**Root cause:** Tailwind v4's Vite plugin processes CSS in order. External `@import` URL statements must appear before the `@import "tailwindcss"` directive.

**How to avoid:** Always put external `@import` URLs at the very top of globals.css, before `@import "tailwindcss"`.

**Correct order:**
```css
/* 1. External imports first */
@import url('https://fonts.googleapis.com/...');
/* 2. Tailwind second */
@import "tailwindcss";
/* 3. @theme and everything else */
@theme inline { ... }
```

**`@import` vs `<link>` trade-off:**
- `@import` in CSS: processed by Tailwind/Vite, simpler setup, no extra HTML changes. Minor FOUT risk since font is fetched after CSS is parsed.
- `<link rel="preload">` in `index.html`: faster first paint (browser discovers font earlier), no FOUT. Requires editing index.html and adding `preconnect` hints.

For Phase 9, `@import` in globals.css is the recommended approach (consistency with existing pattern for `@fontsource/source-serif-4`). Add `display=swap` to the Google Fonts URL to eliminate FOIT.

### Pitfall 4: Existing Button Variant Names

**What goes wrong:** After renaming tokens, the existing Button variants (`default`, `outline`, `secondary`, `ghost`, `link`) reference class names like `bg-brand-primary` that will no longer exist after the token rename. The Tailwind JIT compiler will silently produce no output for unknown utility names — components will render with no background color.

**Root cause:** Tailwind v4's JIT only generates utilities for token names declared in `@theme inline`. After the rename, `bg-brand-primary` is not declared, so no CSS is emitted for it.

**How to avoid:** Update Button variant classes in the same PR as the token rename. Map:
- `bg-brand-primary` → `bg-terracotta`
- `bg-brand-primary-hover` → `bg-terracotta-deep` (hover state)
- `bg-brand-primary-soft` → `bg-terracotta-soft`
- `text-text-inverse` → `text-warm-white`
- `text-text-primary` → `text-ink-1`
- `text-text-muted` → `text-ink-3`
- `bg-surface` → `bg-warm-white`
- `bg-surface-elevated` → `bg-warm-paper`
- `border-border-subtle` → `border-warm-line`
- `border-border-strong` → `border-warm-line-strong`
- `ring-brand-primary` → `ring-terracotta`

**Warning sign:** Buttons rendering with white/transparent background after deploy.

### Pitfall 5: `--warm-line` is `rgba()`, Not a Hex — Tailwind Opacity Modifiers

**What goes wrong:** `--warm-line: rgba(58, 42, 28, 0.10)` is a semi-transparent color. If you declare `--color-warm-line: var(--warm-line)` in `@theme inline` and then use `border-warm-line/50` (Tailwind opacity modifier), the result is undefined because Tailwind v4 opacity modifiers require the color to be expressed in a channel-separable format (oklch, rgb without `rgba()` wrapper, or a hex).

**Root cause:** Tailwind v4 opacity modifiers work by injecting `/ <alpha>` into the color value. This doesn't compose with `rgba()` syntax.

**How to avoid:** Do NOT use opacity modifiers with `warm-line` or `warm-line-strong`. These tokens are pre-composed with their alpha value. Use them as-is: `border-warm-line`, never `border-warm-line/50`.

---

## Code Examples

### Example 1: globals.css — New Token Layer Structure

```css
/* 1. Google Fonts — must come before @import "tailwindcss" */
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');

/* 2. Tailwind v4 base */
@import "tailwindcss";

/* 3. .hos light mode token definitions (verbatim from tokens.jsx lines 18-63) */
.hos {
  --warm-white: #faf7f2;
  --warm-paper: #f4efe6;
  --warm-cream: #ede5d6;
  --warm-tan:   #d4c5a9;
  --warm-line:  rgba(58, 42, 28, 0.10);
  --warm-line-strong: rgba(58, 42, 28, 0.18);

  --ink-1: #2a221a;
  --ink-2: #5a4d3f;
  --ink-3: #8a7d6e;
  --ink-4: #b3a89a;

  --terracotta:       #c4623f;
  --terracotta-deep:  #9d4a2e;
  --terracotta-soft:  #f1d4c2;
  --terracotta-tint:  #faeae0;
  --mustard:          #d4a23a;
  --mustard-soft:     #f1dfa9;
  --mustard-tint:     #faf0d4;
  --olive:            #6b7a3d;
  --olive-tint:       #e8eccf;
  --clay:             #8a4f3d;
  --clay-tint:        #ecd5cb;

  --status-available:       #5b9d6e;
  --status-available-bg:    #d8ebd9;
  --status-reserved:        #4a78b8;
  --status-reserved-bg:     #d8e3f2;
  --status-occupied:        #c4623f;
  --status-occupied-bg:     #f1d4c2;
  --status-cleaning:        #d4a23a;
  --status-cleaning-bg:     #f1dfa9;
  --status-maintenance:     #8a7d6e;
  --status-maintenance-bg:  #e0dad0;
  --status-blocked:         #2a221a;
  --status-blocked-bg:      #b8b0a3;

  --font-display: 'Instrument Serif', 'Cormorant Garamond', Georgia, serif;
  --font-body:    'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono:    'Geist Mono', ui-monospace, 'JetBrains Mono', monospace;

  font-family: var(--font-body);
  color: var(--ink-1);
  background: var(--warm-paper);
  font-feature-settings: 'cv11','ss01','ss03';
  letter-spacing: -0.005em;
  -webkit-font-smoothing: antialiased;
}

/* 4. Dark mode overrides — verbatim from tokens.jsx lines 66-91 */
.hos[data-theme="dark"] {
  --warm-white: #1a1612;
  --warm-paper: #221d18;
  --warm-cream: #2a241e;
  --warm-tan:   #3a3128;
  --warm-line:  rgba(255, 240, 220, 0.08);
  --warm-line-strong: rgba(255, 240, 220, 0.16);
  --ink-1: #f0e8db;
  --ink-2: #c0b39c;
  --ink-3: #8a7d6e;
  --ink-4: #5a4d3f;
  --terracotta-tint:  #3a221a;
  --terracotta-soft:  #5a2e1c;
  --mustard-tint:     #3a2f14;
  --mustard-soft:     #5a481c;
  --olive-tint:       #2f361c;
  --clay-tint:        #3a221a;
  --status-available-bg:    #1f3a26;
  --status-reserved-bg:     #1f2a3a;
  --status-occupied-bg:     #3a221a;
  --status-cleaning-bg:     #3a2f14;
  --status-maintenance-bg:  #2f2a22;
  --status-blocked-bg:      #0a0805;
}

/* 5. @custom-variant — enables dark: prefix with data-theme strategy */
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

/* 6. @theme inline — maps CSS vars to Tailwind utility names */
@theme inline {
  --color-warm-white:            var(--warm-white);
  --color-warm-paper:            var(--warm-paper);
  --color-warm-cream:            var(--warm-cream);
  --color-warm-tan:              var(--warm-tan);
  --color-ink-1:                 var(--ink-1);
  --color-ink-2:                 var(--ink-2);
  --color-ink-3:                 var(--ink-3);
  --color-ink-4:                 var(--ink-4);
  --color-terracotta:            var(--terracotta);
  --color-terracotta-deep:       var(--terracotta-deep);
  --color-terracotta-soft:       var(--terracotta-soft);
  --color-terracotta-tint:       var(--terracotta-tint);
  --color-mustard:               var(--mustard);
  --color-mustard-soft:          var(--mustard-soft);
  --color-mustard-tint:          var(--mustard-tint);
  --color-olive:                 var(--olive);
  --color-olive-tint:            var(--olive-tint);
  --color-clay:                  var(--clay);
  --color-clay-tint:             var(--clay-tint);
  --color-status-available:      var(--status-available);
  --color-status-available-bg:   var(--status-available-bg);
  --color-status-reserved:       var(--status-reserved);
  --color-status-reserved-bg:    var(--status-reserved-bg);
  --color-status-occupied:       var(--status-occupied);
  --color-status-occupied-bg:    var(--status-occupied-bg);
  --color-status-cleaning:       var(--status-cleaning);
  --color-status-cleaning-bg:    var(--status-cleaning-bg);
  --color-status-maintenance:    var(--status-maintenance);
  --color-status-maintenance-bg: var(--status-maintenance-bg);
  --color-status-blocked:        var(--status-blocked);
  --color-status-blocked-bg:     var(--status-blocked-bg);

  --font-family-display: var(--font-display);
  --font-family-body:    var(--font-body);
  --font-family-mono:    var(--font-mono);

  --radius-sm:      4px;
  --radius-DEFAULT: 8px;
  --radius-md:      8px;
  --radius-lg:      12px;
  --radius-xl:      14px;
  --radius-pill:    999px;
}

/* 7. shadcn compatibility bridge */
:root {
  --background:           var(--warm-paper);
  --foreground:           var(--ink-1);
  --card:                 var(--warm-white);
  --card-foreground:      var(--ink-1);
  --popover:              var(--warm-white);
  --popover-foreground:   var(--ink-1);
  --primary:              var(--terracotta);
  --primary-foreground:   var(--warm-white);
  --secondary:            var(--warm-cream);
  --secondary-foreground: var(--ink-1);
  --muted:                var(--warm-cream);
  --muted-foreground:     var(--ink-3);
  --accent:               var(--terracotta-soft);
  --accent-foreground:    var(--ink-1);
  --destructive:          #dc2626;
  --border:               var(--warm-line);
  --input:                var(--warm-line-strong);
  --ring:                 var(--terracotta);
  --radius:               8px;
}

/* 8. Heading styles — bundle pattern */
.hos h1, .hos h2, .hos h3, .hos h4, .hos .display {
  font-family: var(--font-display);
  font-weight: 400;
  letter-spacing: -0.01em;
  color: var(--ink-1);
}

.hos .num  { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.hos .mono { font-family: var(--font-mono); }
```

### Example 2: index.html — `.hos` Root Class + FOUC Guard

```html
<!DOCTYPE html>
<html lang="es" class="hos">
<head>
  <!-- FOUC guard — runs synchronously before React, no flash on first paint -->
  <script>
    (function() {
      var t = localStorage.getItem('hos-theme');
      if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    })();
  </script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HotelOS AI</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

### Example 3: Button — Token Rename Diff

Current `default` variant:
```
bg-brand-primary text-text-inverse shadow hover:bg-brand-primary-hover
```

After rename:
```
bg-terracotta text-warm-white shadow hover:bg-terracotta-deep
```

New `terracotta` variant (explicit alias — same as `default`, kept for semantic clarity in Phase 11):
```
bg-terracotta text-warm-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.10)] hover:bg-terracotta-deep
```

Current `outline` variant:
```
border border-border-strong bg-surface shadow-sm hover:bg-brand-primary-soft hover:text-text-primary
```

After rename:
```
border border-warm-line-strong bg-warm-white shadow-sm hover:bg-terracotta-soft hover:text-ink-1
```

### Example 4: Card — Token Rename Diff

```tsx
// Before
'rounded-lg border border-border-subtle bg-surface text-text-primary shadow-sm'

// After (matches bundle .hos-card — no shadow, warm-white background)
'rounded-xl border border-warm-line bg-warm-white text-ink-1'
```

Note: bundle uses `border-radius: 14px` for cards (`.hos-card`). Map to `rounded-xl` (14px via `--radius-xl: 14px` in @theme inline).

### Example 5: Input — Token Rename Diff

```tsx
// Before
'flex h-9 w-full rounded-md border border-border-strong bg-surface-elevated px-3 py-1 text-sm text-text-primary ...'

// After
'flex h-9 w-full rounded-md border border-warm-line-strong bg-warm-paper px-3 py-1 text-sm text-ink-1 ...'
// focus-visible: ring-terracotta (was ring-brand-primary)
// placeholder: text-ink-3 (was text-text-muted)
```

---

## Existing Primitive State Analysis

### Button (`apps/web/src/components/ui/button.tsx`)

**Current state**: Clean — all colors are design-system token utilities (no hardcoded hex, no Tailwind palette colors). Lines 11-26.

**Required changes**:
- Line 12: `bg-brand-primary` → `bg-terracotta`; `hover:bg-brand-primary-hover` → `hover:bg-terracotta-deep`; `text-text-inverse` → `text-warm-white`
- Line 16: `bg-surface` → `bg-warm-white`; `border-border-strong` → `border-warm-line-strong`; `hover:bg-brand-primary-soft` → `hover:bg-terracotta-soft`; `text-text-primary` → `text-ink-1`
- Line 17: `bg-surface` → `bg-warm-white`; `border-border-strong` → `border-warm-line-strong`; `hover:bg-brand-primary-soft` → `hover:bg-terracotta-soft`
- Line 18: `hover:bg-brand-primary-soft` → `hover:bg-terracotta-soft`
- Line 19: `text-text-brand` → `text-terracotta`
- Add `terracotta` variant explicitly (for Phase 11 semantic clarity)

**Diff size**: ~8 line changes.

### Card (`apps/web/src/components/ui/card.tsx`)

**Current state**: Clean. All colors are token utilities.

**Required changes**:
- Line 9: `border-border-subtle` → `border-warm-line`; `bg-surface` → `bg-warm-white`; `text-text-primary` → `text-ink-1`; remove `shadow-sm` (bundle uses borders not shadows); `rounded-lg` → `rounded-xl` (14px bundle radius)
- Line 29 (CardTitle): `text-text-primary` → `text-ink-1`
- Line 41 (CardDescription): `text-text-muted` → `text-ink-3`

**Diff size**: ~4 line changes.

### Input (`apps/web/src/components/ui/input.tsx`)

**Current state**: Clean.

**Required changes**:
- Line 12: `border-border-strong` → `border-warm-line-strong`; `bg-surface-elevated` → `bg-warm-paper`; `text-text-primary` → `text-ink-1`; `placeholder:text-text-muted` → `placeholder:text-ink-3`; `focus-visible:ring-brand-primary` → `focus-visible:ring-terracotta`

**Diff size**: ~1 line change.

### Badge (does not exist yet)

**Status**: `apps/web/src/components/ui/badge.tsx` — file not found in Glob output.

**Must create**: New file implementing the status-pill system with CVA variants for all 6 status states + a default variant.

### `status-pill.tsx` (new component)

Thin wrapper over Badge that accepts a `status` prop typed as the 6 allowed values and passes the matching variant. Consumed by Phase 11.

```tsx
type RoomStatus = 'available' | 'reserved' | 'occupied' | 'cleaning' | 'maintenance' | 'blocked';

const LABELS: Record<RoomStatus, string> = {
  available: 'Disponible', reserved: 'Reservada', occupied: 'Ocupada',
  cleaning: 'Limpieza', maintenance: 'Mantenimiento', blocked: 'Bloqueada',
};
```

---

## Hardcoded Color Blast Radius

### Must Refactor in Phase 9 (token source files — legitimate hex locations)

| File | Role | Action |
|------|------|--------|
| `apps/web/src/styles/globals.css` | Token source | Replace v1.0 hex values with bundle hex verbatim |
| `apps/web/src/design/tokens.ts` | TS mirror | Replace v1.0 hex values + rename keys to bundle names |
| `apps/web/src/design/tokens.spec.ts` | Token sync test | Update assertions to match new key names and hex values |

### In-Scope Primitives (token rename only — no hex present)

| File | Required Change | Hex Present? |
|------|----------------|--------------|
| `apps/web/src/components/ui/button.tsx` | Rename token utility classes | No |
| `apps/web/src/components/ui/card.tsx` | Rename token utility classes | No |
| `apps/web/src/components/ui/input.tsx` | Rename token utility classes | No |
| `apps/web/src/components/ui/badge.tsx` | CREATE NEW | N/A |
| `apps/web/src/components/ui/status-pill.tsx` | CREATE NEW | N/A |
| `apps/web/src/components/ui/theme-toggle.tsx` | CREATE NEW | N/A |
| `apps/web/index.html` | Add `class="hos"` + FOUC script | N/A |
| `apps/web/src/components/layout/StaffLayout.tsx` | `bg-bg-base` → `bg-warm-paper` | No |

### Stays for Phase 10/11 (out of scope for Phase 9)

All 33 feature-screen files with hardcoded hex or Tailwind palette colors. The Phase 9 gate is verified by running `rg` commands ONLY on `apps/web/src/components/ui/` — not on `features/`.

| Category | Files |
|----------|-------|
| Public booking (4 files) | `BookingPage.tsx`, `BookingResultsPage.tsx`, `BookingFormPage.tsx`, `BookingConfirmationPage.tsx` |
| Reporting (4 files) | `OccupancyBarChart.tsx`, `RoomStatusDonut.tsx`, `DashboardPage.tsx`, `ReportExportPage.tsx` |
| Inventory (3 files) | `RoomsPage.tsx`, `RoomDrawer.tsx`, `RoomTypesPage.tsx` |
| Reservations (6 files) | `ReservationsPage.tsx`, `ReservationDrawer.tsx`, `RoomRackTable.tsx`, `Step2Room.tsx`, `Step3Guest.tsx`, `Step4Confirm.tsx` |
| Operations (4 files) | `CheckInDrawer.tsx`, `CheckOutConfirmDialog.tsx`, `FolioPage.tsx`, `PostChargeModal.tsx` |
| Housekeeping (3 files) | `HousekeepingPage.tsx`, `RoomStatusModal.tsx`, `TaskAssignmentDrawer.tsx` |
| AI/Concierge (7 files) | `ChatMessage.tsx` (x2), `VenueCard.tsx`, `ConciergePage.tsx`, `RichToolResult.tsx`, `VenuesPage.tsx`, `PublicConciergeLayout.tsx` |
| Admin (2 files) | `TraExportPage.tsx`, `NightAuditPage.tsx` |

---

## Walking Skeleton / MVP Mode Reconciliation

Phase 9 is a horizontal foundation layer (not a vertical feature slice). In MVP mode, the planner reconciles this by defining a thin vertical demonstration that proves the foundation works end-to-end before Phase 10/11 consume it.

**Recommended demo page**: Create `apps/web/src/pages/DesignSystemDemo.tsx` (accessible at `/dev/design-system`, protected under development mode or admin-only route). The page renders:

1. A `ThemeToggle` button that flips dark mode — proves `useTheme` + FOUC prevention
2. All 4 refactored primitives (Button in 3 variants, Card, Input, Badge in all 6 status states)
3. A `StatusPill` for each of the 6 room states
4. Typography specimens (h1-h4 in Instrument Serif, body in Geist, numeric in Geist Mono)
5. The full warm neutral ramp shown as swatches

This demo page is the acceptance-criteria "screen" for Phase 9. It proves: fonts load, dark mode flips in one frame, status colors render consistently, primitives use no hardcoded hex.

**Not a Storybook** — just a simple route. Removed or gated in production builds.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` with `extend.colors` | `@theme inline` in CSS | Tailwind v4 (2024) | No JS config file needed; CSS is the source of truth |
| `dark` class on `<html>` | `data-theme="dark"` attribute | Project decision | Avoids class collision with other dark-mode libraries; cleaner HTML semantics |
| `next-themes` library for theme toggling | 20-line `useTheme` hook | Project decision | No library overhead for a single toggle |
| `@fontsource/source-serif-4` npm package | Google Fonts `@import` URL | Phase 9 (this phase) | Removes npm dep; single URL change loads 3 fonts at once |
| `Source Serif 4` display font | `Instrument Serif` | Bundle handoff (Phase 9) | Bundle canonical font; warm editorial quality for hotel branding |

**Deprecated in Phase 9:**
- `@fontsource/source-serif-4` — remove from `package.json` after globals.css is updated
- `@import "@fontsource/source-serif-4/400.css"` lines in globals.css — replace with Google Fonts URL
- All v1.0 token names (`--brand-primary`, `--surface`, `--bg-base`, `--border-subtle`, etc.) — replaced verbatim by bundle names

---

## Open Questions

1. **`tokens.spec.ts` after rename**
   - What we know: the spec file asserts exact hex values for v1.0 token names
   - What's unclear: should the spec be rewritten to assert bundle token names, or kept as-is with updated hex values under old names?
   - Recommendation: rewrite the spec to assert bundle token names and hex values. The spec is the canonical enforcement test — it should mirror the final state, not the migration state.

2. **`StaffLayout.tsx` scope**
   - What we know: `StaffLayout.tsx` uses `bg-bg-base` (v1.0 token name) — this will break when `--bg-base` is removed
   - What's unclear: is updating `StaffLayout.tsx` in scope for Phase 9 (it's a layout, not a screen)?
   - Recommendation: include in Phase 9 scope. It's 1 line and blocking — without it, the staff app renders with broken background. Tag as "layout utility class rename" not "screen restyle."

3. **`cleaning` status foreground color discrepancy**
   - What we know: bundle line 267 uses `color: #a8801c` for cleaning (not `var(--status-cleaning)`) — this is a slightly darker mustard for legibility on the light-mustard background
   - What's unclear: should this be a named token or a one-off hardcoded value?
   - Recommendation: add `--status-cleaning-fg: #a8801c` as an explicit token in the `.hos` block. This maintains the "zero hardcoded hex" invariant without silently deviating from the bundle.

---

## Sources

### Primary (HIGH confidence)
- `C:\Users\Admin\Desktop\Proyectos\Hotel\.design-fetch\hotelos-ai\project\tokens.jsx` — canonical bundle; all hex values transcribed verbatim
- `C:\Users\Admin\Desktop\Proyectos\Hotel\apps\web\src\styles\globals.css` — current token layer; existing `@theme inline` pattern confirmed correct for Tailwind v4
- `C:\Users\Admin\Desktop\Proyectos\Hotel\apps\web\src\design\tokens.ts` — current TS mirror; all v1.0 token names identified
- `C:\Users\Admin\Desktop\Proyectos\Hotel\apps\web\src\design\tokens.spec.ts` — sync enforcement tests; must be rewritten
- `C:\Users\Admin\Desktop\Proyectos\Hotel\apps\web\vite.config.ts` — confirms `@tailwindcss/vite` plugin installed correctly
- `C:\Users\Admin\Desktop\Proyectos\Hotel\apps\web\package.json` — confirms Tailwind v4 (`^4.0.0`), `@tailwindcss/vite` (`^4.3.0`), no badge.tsx dependency
- `C:\Users\Admin\Desktop\Proyectos\Hotel\apps\web\src\components\ui\button.tsx` — confirmed clean (no hardcoded hex)
- `C:\Users\Admin\Desktop\Proyectos\Hotel\apps\web\src\components\ui\card.tsx` — confirmed clean
- `C:\Users\Admin\Desktop\Proyectos\Hotel\apps\web\src\components\ui\input.tsx` — confirmed clean
- `C:\Users\Admin\Desktop\Proyectos\Hotel\apps\web\index.html` — confirmed missing `.hos` class on `<html>`

### Secondary (MEDIUM confidence — Tailwind v4 `@theme inline` pattern)
- Tailwind v4 CSS-native configuration pattern verified through the existing working `globals.css` in this project (already uses `@theme inline` correctly in lines 59-93)
- `@custom-variant dark` directive syntax: confirmed via Tailwind v4 docs at `tailwindcss.com/docs/dark-mode` (variant registration pattern)

### Tertiary (LOW confidence — not independently verified)
- `@import` order requirement (external URLs before `@import "tailwindcss"`): derived from Tailwind v4 PostCSS processing order; not verified against official docs but consistent with standard CSS `@import` rules

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all tools already installed and working
- Architecture: HIGH — existing `@theme inline` pattern is already the correct approach; token replacement is mechanical
- Pitfalls: HIGH — all pitfalls derived from direct code inspection of the project (not speculative)
- Blast radius mapping: HIGH — rg scan confirmed 33 out-of-scope files, 0 hardcoded hex in the 3 existing primitives

**Research date:** 2026-05-17
**Valid until:** 2026-07-17 (Tailwind v4 stable; no breaking changes expected for 60 days)

---

## RESEARCH COMPLETE
