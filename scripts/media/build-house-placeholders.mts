// Draws placeholder images for every house type, at their final sizes, into
// public/media/houses/<slug>/: the card (portrait and landscape), the hero (desktop and mobile)
// and each floor's poster. The Google Flow images replace them under the same names
// (docs/media/houses.md), so the code never changes.
//
//   npm run media:houses

import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

import sharp from "sharp";

import { catalogData } from "../../src/features/houses/data.ts";
import {
  floorPoster,
  type HouseImage,
  houseImageSizes,
  houseTypeImages,
} from "../../src/features/houses/media.ts";

/** Each house type's gradient, from the brand palette. */
const palettes: Record<string, [string, string, string]> = {
  // mar, mar (Noche), arena
  "villa-mar": ["#1F5F6B", "#7CC0C9", "#E6D6BC"],
  // olivo, olivo (Noche), arena
  "casa-pinar": ["#5F6E3F", "#A9B97F", "#E6D6BC"],
  // terracota, sol, arena
  "casa-olivo": ["#C2683F", "#E9B45C", "#E6D6BC"],
};

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A brand gradient with a low sun and a horizon, labelled just above the middle: clear of the
 * decorative name the hero sets near the top, and of the bottom 40 %, the scrim's text zone.
 */
function placeholderSvg(size: HouseImage, colors: [string, string, string], label: string) {
  const { width, height } = houseImageSizes[size];
  const short = Math.min(width, height);
  const [sky, glow, sand] = colors;
  const fontSize = Math.round(short * 0.06);
  const panelWidth = Math.round(width * 0.9);
  // The note is about 26 em wide: it must fit portrait images too.
  const noteSize = Math.round(Math.min(fontSize * 0.55, panelWidth / 30));
  const panelHeight = Math.round(fontSize * 3.4);
  const panelY = Math.round(height * 0.42);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${sky}"/>
      <stop offset="0.55" stop-color="${glow}"/>
      <stop offset="1" stop-color="${sand}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <circle cx="${width * 0.68}" cy="${height * 0.6}" r="${short * 0.12}" fill="#E9B45C" opacity="0.55"/>
  <rect y="${height * 0.62}" width="${width}" height="${height * 0.38}" fill="${sand}" opacity="0.45"/>
  <rect x="${(width - panelWidth) / 2}" y="${panelY}" width="${panelWidth}" height="${panelHeight}" rx="${fontSize / 2}" fill="#0C1314" opacity="0.7"/>
  <text x="50%" y="${panelY + fontSize * 1.45}" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" fill="#F2ECE1">${escape(label)}</text>
  <text x="50%" y="${panelY + fontSize * 2.6}" text-anchor="middle" font-family="sans-serif" font-size="${noteSize}" fill="#A9B4B2">Marcador · se sustituye por la imagen de Google Flow</text>
</svg>`;
}

async function draw(
  publicPath: string,
  size: HouseImage,
  colors: [string, string, string],
  label: string,
) {
  const out = resolve("public", publicPath.replace(/^\//, ""));
  mkdirSync(dirname(out), { recursive: true });
  await sharp(Buffer.from(placeholderSvg(size, colors, label)))
    .webp({ quality: 80 })
    .toFile(out);
  console.log(`  ${publicPath}`);
}

async function main() {
  rmSync(resolve("public/media/houses"), { recursive: true, force: true });
  for (const { slug, name, floors } of catalogData.houseTypes) {
    const colors = palettes[slug];
    if (!colors) throw new Error(`No placeholder palette for "${slug}"`);
    console.log(name);
    const { card, hero } = houseTypeImages(slug);
    await draw(card.portrait, "cardPortrait", colors, `${name} · Tarjeta`);
    await draw(card.landscape, "cardLandscape", colors, `${name} · Tarjeta`);
    await draw(hero.desktop, "heroDesktop", colors, `${name} · Hero`);
    await draw(hero.mobile, "heroMobile", colors, `${name} · Hero`);
    for (const floor of floors) {
      const poster = floorPoster(slug, floor.id);
      await draw(poster.desktop, "floorDesktop", colors, `${name} · ${floor.name}`);
      await draw(poster.mobile, "floorMobile", colors, `${name} · ${floor.name}`);
    }
  }
}

await main();
