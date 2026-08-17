import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusPill, STATUS_LABELS, type RoomStatus } from '@/components/ui/status-pill';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const BUTTON_VARIANTS = [
  'default',
  'terracotta',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
] as const;

const BUTTON_SIZES = ['default', 'sm', 'lg', 'icon'] as const;

const BADGE_VARIANTS = [
  'default',
  'available',
  'reserved',
  'occupied',
  'cleaning',
  'maintenance',
  'blocked',
] as const;

const ROOM_STATUSES: RoomStatus[] = [
  'available',
  'reserved',
  'occupied',
  'cleaning',
  'maintenance',
  'blocked',
];

const WARM_SWATCHES = [
  { name: 'warm-white', class: 'bg-warm-white border border-warm-line' },
  { name: 'warm-paper', class: 'bg-warm-paper border border-warm-line' },
  { name: 'warm-cream', class: 'bg-warm-cream border border-warm-line' },
  { name: 'warm-tan',   class: 'bg-warm-tan border border-warm-line' },
];

export function DesignSystemPage() {
  return (
    <main data-testid="design-system-page" className="min-h-screen bg-warm-paper p-8">
      {/* ── Header ── */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl">Sistema de diseño</h1>
          <p className="text-ink-3 text-sm mt-2">
            Phase 9 — Foundation primitives, status tokens, theme toggle
          </p>
        </div>
        <ThemeToggle />
      </header>

      {/* ── 1. Botones ── */}
      <section className="mb-10">
        <h2 className="text-2xl mb-4">Botones</h2>
        <div className="grid grid-cols-[auto_1fr] gap-4 items-center">
          {BUTTON_SIZES.map((size) => (
            <React.Fragment key={size}>
              <span className="text-ink-3 mono text-xs">{size}</span>
              <div className="flex flex-wrap gap-2">
                {BUTTON_VARIANTS.map((v) => (
                  <Button key={v} variant={v} size={size}>
                    {size === 'icon' ? '+' : v}
                  </Button>
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ── 2. Tarjetas ── */}
      <section className="mb-10">
        <h2 className="text-2xl mb-4">Tarjetas</h2>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Habitación 204</CardTitle>
            <CardDescription>Suite deluxe · 2 huéspedes · vista al jardín</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Pago confirmado. Listo para check-in a partir de las 15:00.
            </p>
          </CardContent>
          <CardFooter className="gap-2">
            <Button variant="terracotta" size="sm">Check-in</Button>
            <Button variant="outline" size="sm">Cancelar</Button>
          </CardFooter>
        </Card>
      </section>

      {/* ── 3. Inputs ── */}
      <section className="mb-10">
        <h2 className="text-2xl mb-4">Inputs</h2>
        <div className="grid gap-3 max-w-sm">
          <Input placeholder="Nombre del huésped" />
          <Input placeholder="Email" type="email" />
          <Input placeholder="Deshabilitado" disabled />
        </div>
      </section>

      {/* ── 4. Badges ── */}
      <section className="mb-10">
        <h2 className="text-2xl mb-4">Badges</h2>
        <div className="flex flex-wrap gap-2">
          {BADGE_VARIANTS.map((v) => (
            <Badge key={v} variant={v}>
              {v}
            </Badge>
          ))}
        </div>
      </section>

      {/* ── 5. Estados de habitación (StatusPill) ── */}
      <section className="mb-10">
        <h2 className="text-2xl mb-4">Estados de habitación (StatusPill)</h2>
        <div className="flex flex-wrap gap-3">
          {ROOM_STATUSES.map((s) => (
            <StatusPill key={s} status={s} data-testid={`status-pill-${s}`} />
          ))}
        </div>
      </section>

      {/* ── 6. Tipografía y paleta cálida ── */}
      <section>
        <h2 className="text-2xl mb-4">Tipografía y paleta cálida</h2>
        <div className="grid gap-6">
          <div>
            <h1 className="text-4xl">H1 Instrument Serif</h1>
            <h2 className="text-3xl">H2 Instrument Serif</h2>
            <h3 className="text-2xl">H3 Instrument Serif</h3>
            <h4 className="text-xl">H4 Instrument Serif</h4>
            <p className="text-base">Body Geist — Hospitalidad operada con inteligencia.</p>
            <p className="num text-base">1,234,567.89 — número en Geist Mono tabular</p>
            <p className="mono text-sm">code() · Geist Mono · console.log()</p>
          </div>
          <div className="grid grid-cols-4 gap-3 max-w-xl">
            {WARM_SWATCHES.map((sw) => (
              <div key={sw.name} className="flex flex-col gap-2">
                <div className={`${sw.class} h-16 rounded-lg`} />
                <span className="text-xs text-ink-3 mono">{sw.name}</span>
              </div>
            ))}
          </div>
          {/* Status color swatches */}
          <div>
            <p className="text-sm text-ink-3 mb-3 mono">Status color utilities</p>
            <div className="flex flex-wrap gap-2">
              {ROOM_STATUSES.map((s) => (
                <span
                  key={s}
                  className={`px-3 py-1 rounded-full text-xs font-medium bg-status-${s}-bg text-status-${s}`}
                >
                  {STATUS_LABELS[s]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
