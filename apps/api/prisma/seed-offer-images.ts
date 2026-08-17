import * as fs from 'fs';
import * as path from 'path';

/**
 * seed-offer-images.ts — Create placeholder images for demo offers.
 *
 * Generates simple SVG placeholders and saves them as SVG files
 * in the storage directory. The seed-demo-data.ts now references .svg files.
 *
 * Run: npx ts-node prisma/seed-offer-images.ts
 */

const STORAGE_DIR = process.env.STORAGE_DIR ?? './storage';
const IMAGES_DIR = path.join(STORAGE_DIR, 'images', 'offers');

const OFFER_TITLES = [
  'Escapada Romántica',
  'Plan Familiar',
  'Descuento Early Bird',
  'Paquete Negocios',
];

const COLORS = [
  { bg: '#c45a3a', text: '#ffffff' },
  { bg: '#2a5a4a', text: '#ffffff' },
  { bg: '#d4a574', text: '#2a221a' },
  { bg: '#5a4d3f', text: '#f9f5f0' },
];

function createPlaceholderSvg(title: string, index: number): string {
  const color = COLORS[index % COLORS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="${color.bg}"/>
  <text x="400" y="280" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="${color.text}" text-anchor="middle">${title}</text>
  <text x="400" y="340" font-family="Arial, sans-serif" font-size="24" fill="${color.text}" text-anchor="middle">Hotel Sumapaz</text>
  <rect x="250" y="380" width="300" height="4" fill="${color.text}" opacity="0.5"/>
</svg>`;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[seed-offer-images] Created directory: ${dir}`);
  }
}

async function main() {
  ensureDir(IMAGES_DIR);

  for (let i = 0; i < 4; i++) {
    const filename = `demo-offer-${i + 1}.svg`;
    const filepath = path.join(IMAGES_DIR, filename);

    if (fs.existsSync(filepath)) {
      console.log(`[seed-offer-images] EXISTS: ${filename}`);
      continue;
    }

    const svgContent = createPlaceholderSvg(OFFER_TITLES[i], i);
    fs.writeFileSync(filepath, svgContent);
    console.log(`[seed-offer-images] CREATED: ${filename}`);
  }

  console.log('[seed-offer-images] Done. SVG placeholders created. For production, upload real images via admin panel.');
}

main().catch((e) => {
  console.error('[seed-offer-images] FAILED', e);
  process.exit(1);
});
