export const ANCHOR_IDS = [
  'inicio',
  'habitaciones',
  'restaurante',
  'concierge',
  'ubicacion',
] as const;

export type AnchorId = (typeof ANCHOR_IDS)[number];

export function scrollToSection(id: string): void {
  if (id === 'inicio') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
