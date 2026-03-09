/**
 * Generate all furniture sprites and floor tiles from scratch as original pixel art.
 * These replace the privately licensed Donarg tileset assets.
 *
 * Run: node scripts/generate-open-assets.js
 *
 * Generates:
 *   - webview-ui/public/assets/floors.png (112×16, 7 grayscale 16×16 floor patterns)
 *   - webview-ui/public/assets/furniture/ (all furniture sprites)
 */

import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '..', 'webview-ui', 'public', 'assets');

// ── Color helpers ────────────────────────────────────────
function rgba(r, g, b, a = 255) { return [r, g, b, a]; }
const T = [0, 0, 0, 0]; // transparent
const BK = rgba(0x1a, 0x1a, 0x1a); // dark outline
const BK2 = rgba(0x2a, 0x2a, 0x2a); // softer outline

// Wood palette
const WOOD_DARK = rgba(0x6b, 0x44, 0x23);
const WOOD_MED = rgba(0x8b, 0x5e, 0x3c);
const WOOD_LIGHT = rgba(0xa5, 0x76, 0x4a);
const WOOD_HI = rgba(0xc4, 0x94, 0x60);

// White/Gray palette
const WHITE = rgba(0xf0, 0xf0, 0xf0);
const LGRAY = rgba(0xd0, 0xd0, 0xd0);
const MGRAY = rgba(0xaa, 0xaa, 0xaa);
const DGRAY = rgba(0x70, 0x70, 0x70);
const DDGRAY = rgba(0x50, 0x50, 0x50);

// Green palette (plants)
const GREEN_DARK = rgba(0x2d, 0x5a, 0x27);
const GREEN_MED = rgba(0x3c, 0x7a, 0x33);
const GREEN_LIGHT = rgba(0x5c, 0x9e, 0x4f);
const GREEN_HI = rgba(0x7c, 0xb8, 0x6a);

// Brown palette (pots, misc)
const BROWN_DARK = rgba(0x5a, 0x34, 0x1c);
const BROWN_MED = rgba(0x7a, 0x4e, 0x2e);
const BROWN_LIGHT = rgba(0x9a, 0x68, 0x40);

// Blue/Teal (electronics)
const BLUE_DARK = rgba(0x28, 0x3c, 0x5a);
const BLUE_MED = rgba(0x3c, 0x5a, 0x7a);
const BLUE_LIGHT = rgba(0x60, 0x80, 0xa0);
const SCREEN_DARK = rgba(0x20, 0x30, 0x40);
const SCREEN_MED = rgba(0x30, 0x50, 0x70);
const SCREEN_LIGHT = rgba(0x50, 0x80, 0xb0);
const SCREEN_HI = rgba(0x70, 0xa0, 0xd0);

// Red/Warm
const RED_DARK = rgba(0x8b, 0x22, 0x22);
const RED_MED = rgba(0xb0, 0x33, 0x33);
const RED_LIGHT = rgba(0xd0, 0x55, 0x55);

// Cream/Tan (cushions)
const CREAM = rgba(0xd4, 0xb8, 0x96);
const CREAM_DARK = rgba(0xb0, 0x90, 0x70);
const CREAM_LIGHT = rgba(0xe8, 0xd0, 0xb0);

// Orange (accents)
const ORANGE = rgba(0xd0, 0x80, 0x30);
const ORANGE_DARK = rgba(0xa0, 0x60, 0x20);

// Metal
const METAL_DARK = rgba(0x50, 0x55, 0x5a);
const METAL_MED = rgba(0x78, 0x80, 0x88);
const METAL_LIGHT = rgba(0xa0, 0xa8, 0xb0);
const METAL_HI = rgba(0xc0, 0xc8, 0xd0);

// Sky/landscape painting colors
const SKY_LIGHT = rgba(0x87, 0xce, 0xeb);
const SKY_MED = rgba(0x60, 0xb0, 0xd0);
const GRASS_GREEN = rgba(0x4a, 0x8c, 0x3a);
const GRASS_LIGHT = rgba(0x6a, 0xac, 0x5a);
const EARTH_BROWN = rgba(0x8b, 0x6b, 0x47);
const SUN_YELLOW = rgba(0xf0, 0xd0, 0x40);

// ── PNG creation helpers ─────────────────────────────────
function createPng(w, h, pixels) {
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const c = (pixels[y] && pixels[y][x]) || T;
      png.data[idx] = c[0];
      png.data[idx + 1] = c[1];
      png.data[idx + 2] = c[2];
      png.data[idx + 3] = c[3];
    }
  }
  return PNG.sync.write(png);
}

function savePng(relPath, w, h, pixels) {
  const fullPath = path.join(ASSETS_DIR, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, createPng(w, h, pixels));
  console.log(`  ✓ ${relPath} (${w}×${h})`);
}

/** Fill a pixel grid region */
function fillRect(pixels, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      if (pixels[y + dy]) pixels[y + dy][x + dx] = color;
}

/** Draw an outlined rect */
function outlinedRect(pixels, x, y, w, h, fill, outline = BK) {
  fillRect(pixels, x, y, w, h, outline);
  if (w > 2 && h > 2)
    fillRect(pixels, x + 1, y + 1, w - 2, h - 2, fill);
}

/** Create a blank pixel grid */
function makeGrid(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(T));
}

// ══════════════════════════════════════════════════════════
// ═══ FLOOR TILES (112×16, 7 grayscale 16×16 patterns) ═══
// ══════════════════════════════════════════════════════════

function generateFloors() {
  const W = 112, H = 16;
  const g = makeGrid(W, H);

  // Helper: set pixel in a specific tile (0-6)
  function setTile(tileIdx, x, y, val) {
    g[y][tileIdx * 16 + x] = rgba(val, val, val);
  }
  function fillTile(tileIdx, val) {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        setTile(tileIdx, x, y, val);
  }

  // Tile 0: Plain flat floor
  fillTile(0, 200);
  for (let x = 0; x < 16; x++) { setTile(0, x, 0, 180); setTile(0, x, 15, 180); }
  for (let y = 0; y < 16; y++) { setTile(0, 0, y, 180); setTile(0, 15, y, 180); }

  // Tile 1: Horizontal planks
  fillTile(1, 190);
  for (let x = 0; x < 16; x++) {
    setTile(1, x, 3, 160);
    setTile(1, x, 7, 160);
    setTile(1, x, 11, 160);
    setTile(1, x, 15, 160);
  }
  // Slight variation in plank brightness
  for (let y = 4; y < 8; y++)
    for (let x = 0; x < 16; x++)
      setTile(1, x, y, 180);
  for (let y = 12; y < 15; y++)
    for (let x = 0; x < 16; x++)
      setTile(1, x, y, 180);

  // Tile 2: Checkerboard
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const check = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0) ? 210 : 170;
      setTile(2, x, y, check);
    }

  // Tile 3: Diagonal tiles
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const diag = ((x + y) % 8 < 4) ? 200 : 170;
      setTile(3, x, y, diag);
      // Grid lines
      if ((x + y) % 8 === 0 || (x + y) % 8 === 4) setTile(3, x, y, 150);
    }

  // Tile 4: Herringbone / parquet
  fillTile(4, 185);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const bx = Math.floor(x / 4), by = Math.floor(y / 4);
      if ((bx + by) % 2 === 0) {
        // Horizontal mini plank
        if (x % 4 === 0) setTile(4, x, y, 160);
        else setTile(4, x, y, 195);
      } else {
        // Vertical mini plank
        if (y % 4 === 0) setTile(4, x, y, 160);
        else setTile(4, x, y, 175);
      }
    }

  // Tile 5: Stone/cobble
  fillTile(5, 185);
  // Stone outlines
  const stoneLines5 = [
    [0,0,16,0], [0,5,8,5], [8,4,16,4], [0,9,16,9], [0,13,6,13], [6,14,16,14],
    [0,0,0,5], [8,0,8,5], [4,5,4,9], [12,4,12,9], [0,9,0,13], [6,9,6,14], [10,9,10,14],
  ];
  for (const [x1,y1,x2,y2] of stoneLines5) {
    if (y1 === y2) for (let x = x1; x < x2; x++) setTile(5, x, y1, 155);
    else for (let y = y1; y < y2; y++) setTile(5, x1, y, 155);
  }

  // Tile 6: Carpet/solid with border
  fillTile(6, 180);
  for (let x = 0; x < 16; x++) { setTile(6, x, 0, 150); setTile(6, x, 1, 155); setTile(6, x, 14, 155); setTile(6, x, 15, 150); }
  for (let y = 0; y < 16; y++) { setTile(6, 0, y, 150); setTile(6, 1, y, 155); setTile(6, 14, y, 155); setTile(6, 15, y, 150); }
  // Inner area slightly lighter
  for (let y = 2; y < 14; y++)
    for (let x = 2; x < 14; x++)
      setTile(6, x, y, 195);

  savePng('floors.png', W, H, g);
}

// ══════════════════════════════════════════════════════════
// ═══ FURNITURE SPRITES ═══════════════════════════════════
// ══════════════════════════════════════════════════════════

// ── DESKS ────────────────────────────────────────────────

function generateCounterWhiteSm() {
  // 32×32, 2×2 footprint, isDesk, backgroundTiles:1
  const g = makeGrid(32, 32);
  // Top row (background): just the back edge of counter
  // Back panel (rows 2-7)
  outlinedRect(g, 0, 2, 32, 6, LGRAY);
  fillRect(g, 1, 3, 30, 1, WHITE); // highlight stripe
  // Countertop surface (rows 8-10)
  outlinedRect(g, 0, 8, 32, 3, WHITE);
  // Front panel (rows 11-16 of top half visible)
  fillRect(g, 0, 11, 32, 5, LGRAY);
  fillRect(g, 0, 11, 32, 1, BK);
  fillRect(g, 0, 15, 32, 1, BK);
  // Drawers
  outlinedRect(g, 2, 12, 13, 3, WHITE);
  outlinedRect(g, 17, 12, 13, 3, WHITE);
  // Drawer handles
  fillRect(g, 7, 13, 3, 1, MGRAY);
  fillRect(g, 22, 13, 3, 1, MGRAY);
  // Bottom half (front face)
  fillRect(g, 0, 16, 32, 16, T); // clear
  outlinedRect(g, 0, 16, 32, 14, LGRAY);
  fillRect(g, 1, 17, 30, 1, WHITE); // top highlight
  // Lower drawers
  outlinedRect(g, 2, 19, 13, 5, WHITE);
  outlinedRect(g, 17, 19, 13, 5, WHITE);
  fillRect(g, 7, 21, 3, 1, MGRAY);
  fillRect(g, 22, 21, 3, 1, MGRAY);
  // Legs
  fillRect(g, 1, 30, 2, 2, DGRAY);
  fillRect(g, 29, 30, 2, 2, DGRAY);
  savePng('furniture/desks/COUNTER_WHITE_SM.png', 32, 32, g);
}

function generateTableWoodLg() {
  // 32×64, 2×4 footprint, isDesk, backgroundTiles:1
  const g = makeGrid(32, 64);
  // Background row (top 16px) - back edge of table
  outlinedRect(g, 0, 10, 32, 6, WOOD_MED);
  fillRect(g, 1, 11, 30, 1, WOOD_HI);
  // Tabletop (row 1 = y16-31)
  outlinedRect(g, 0, 16, 32, 5, WOOD_LIGHT);
  fillRect(g, 1, 17, 30, 1, WOOD_HI); // highlight
  // Front face
  outlinedRect(g, 0, 21, 32, 9, WOOD_MED);
  fillRect(g, 1, 22, 30, 1, WOOD_LIGHT);
  // Legs (extend through rows 2-3)
  fillRect(g, 1, 30, 2, 2, WOOD_DARK);
  fillRect(g, 29, 30, 2, 2, WOOD_DARK);
  // Open space below table
  fillRect(g, 1, 32, 30, 28, T);
  // Just the legs continuing
  fillRect(g, 1, 32, 2, 28, WOOD_DARK);
  fillRect(g, 29, 32, 2, 28, WOOD_DARK);
  // Cross bar
  outlinedRect(g, 1, 48, 30, 2, WOOD_DARK);
  // Feet
  fillRect(g, 0, 60, 4, 4, WOOD_DARK);
  fillRect(g, 28, 60, 4, 4, WOOD_DARK);
  savePng('furniture/desks/TABLE_WOOD_LG.png', 32, 64, g);
}

function generateTableWood() {
  // 48×32, 3×2 footprint, isDesk, backgroundTiles:1
  const g = makeGrid(48, 32);
  // Background row: back edge
  outlinedRect(g, 0, 8, 48, 5, WOOD_MED);
  fillRect(g, 1, 9, 46, 1, WOOD_HI);
  // Tabletop surface
  outlinedRect(g, 0, 13, 48, 4, WOOD_LIGHT);
  fillRect(g, 1, 14, 46, 1, WOOD_HI);
  // Front panel
  outlinedRect(g, 0, 17, 48, 7, WOOD_MED);
  fillRect(g, 1, 18, 46, 1, WOOD_LIGHT);
  // Legs
  fillRect(g, 1, 24, 2, 8, WOOD_DARK);
  fillRect(g, 22, 24, 2, 8, WOOD_DARK);
  fillRect(g, 45, 24, 2, 8, WOOD_DARK);
  savePng('furniture/desks/TABLE_WOOD.png', 48, 32, g);
}

function generateCoffeeTableLg() {
  // 32×32, 2×2 footprint, isDesk, backgroundTiles:1
  const g = makeGrid(32, 32);
  // Back edge (bg row)
  outlinedRect(g, 2, 10, 28, 4, WOOD_MED);
  fillRect(g, 3, 11, 26, 1, WOOD_HI);
  // Table surface (low profile)
  outlinedRect(g, 1, 14, 30, 3, WOOD_LIGHT);
  fillRect(g, 2, 15, 28, 1, WOOD_HI);
  // Front face (short)
  outlinedRect(g, 1, 17, 30, 3, WOOD_MED);
  // Short legs
  fillRect(g, 2, 20, 2, 6, WOOD_DARK);
  fillRect(g, 28, 20, 2, 6, WOOD_DARK);
  // Lower shelf
  outlinedRect(g, 3, 23, 26, 2, WOOD_MED);
  savePng('furniture/desks/COFFEE_TABLE_LG.png', 32, 32, g);
}

// ── CHAIRS ───────────────────────────────────────────────

function generateChairCushionedRight() {
  // 16×16, 1×1, chair facing right
  const g = makeGrid(16, 16);
  // Seat cushion (tan/cream)
  outlinedRect(g, 2, 6, 12, 8, CREAM);
  fillRect(g, 3, 7, 10, 2, CREAM_LIGHT); // highlight
  // Back rest (right side) - small vertical piece
  outlinedRect(g, 12, 3, 3, 11, CREAM_DARK);
  fillRect(g, 13, 4, 1, 9, CREAM);
  // Legs
  g[14][3] = WOOD_DARK; g[15][3] = WOOD_DARK;
  g[14][11] = WOOD_DARK; g[15][11] = WOOD_DARK;
  g[14][4] = WOOD_DARK; g[14][10] = WOOD_DARK;
  savePng('furniture/chairs/CHAIR_CUSHIONED_RIGHT.png', 16, 16, g);
}

function generateChairCushionedLeft() {
  // 16×16, 1×1, chair facing left
  const g = makeGrid(16, 16);
  // Seat cushion
  outlinedRect(g, 2, 6, 12, 8, CREAM);
  fillRect(g, 3, 7, 10, 2, CREAM_LIGHT);
  // Back rest (left side)
  outlinedRect(g, 1, 3, 3, 11, CREAM_DARK);
  fillRect(g, 2, 4, 1, 9, CREAM);
  // Legs
  g[14][4] = WOOD_DARK; g[15][4] = WOOD_DARK;
  g[14][12] = WOOD_DARK; g[15][12] = WOOD_DARK;
  g[14][5] = WOOD_DARK; g[14][11] = WOOD_DARK;
  savePng('furniture/chairs/CHAIR_CUSHIONED_LEFT.png', 16, 16, g);
}

function generateStool() {
  // 16×16, 1×1
  const g = makeGrid(16, 16);
  // Seat (round-ish)
  outlinedRect(g, 4, 5, 8, 5, WOOD_LIGHT);
  fillRect(g, 5, 6, 6, 1, WOOD_HI);
  // Legs (4 splayed)
  g[10][5] = WOOD_DARK; g[11][4] = WOOD_DARK; g[12][3] = WOOD_DARK;
  g[10][10] = WOOD_DARK; g[11][11] = WOOD_DARK; g[12][12] = WOOD_DARK;
  g[10][6] = WOOD_DARK; g[11][6] = WOOD_DARK; g[12][5] = WOOD_DARK; g[13][5] = WOOD_DARK;
  g[10][9] = WOOD_DARK; g[11][9] = WOOD_DARK; g[12][10] = WOOD_DARK; g[13][10] = WOOD_DARK;
  savePng('furniture/chairs/STOOL.png', 16, 16, g);
}

function generateChairCushionedLgRight() {
  // 16×32, 1×2, large cushioned chair facing right
  const g = makeGrid(16, 32);
  // Back rest (top portion, right side)
  outlinedRect(g, 10, 4, 5, 18, CREAM_DARK);
  fillRect(g, 11, 5, 3, 16, CREAM);
  fillRect(g, 12, 5, 1, 16, CREAM_LIGHT);
  // Seat cushion
  outlinedRect(g, 1, 16, 14, 8, CREAM);
  fillRect(g, 2, 17, 12, 2, CREAM_LIGHT);
  // Arm rest (left)
  outlinedRect(g, 1, 14, 3, 10, CREAM_DARK);
  // Legs
  fillRect(g, 2, 24, 2, 4, WOOD_DARK);
  fillRect(g, 12, 24, 2, 4, WOOD_DARK);
  // Feet
  g[28][2] = WOOD_DARK; g[28][13] = WOOD_DARK;
  savePng('furniture/chairs/CHAIR_CUSHIONED_LG_RIGHT.png', 16, 32, g);
}

function generateChairCushionedLgLeft() {
  // 16×32, 1×2, large cushioned chair facing left
  const g = makeGrid(16, 32);
  // Back rest (top portion, left side)
  outlinedRect(g, 1, 4, 5, 18, CREAM_DARK);
  fillRect(g, 2, 5, 3, 16, CREAM);
  fillRect(g, 3, 5, 1, 16, CREAM_LIGHT);
  // Seat cushion
  outlinedRect(g, 1, 16, 14, 8, CREAM);
  fillRect(g, 2, 17, 12, 2, CREAM_LIGHT);
  // Arm rest (right)
  outlinedRect(g, 12, 14, 3, 10, CREAM_DARK);
  // Legs
  fillRect(g, 2, 24, 2, 4, WOOD_DARK);
  fillRect(g, 12, 24, 2, 4, WOOD_DARK);
  g[28][2] = WOOD_DARK; g[28][13] = WOOD_DARK;
  savePng('furniture/chairs/CHAIR_CUSHIONED_LG_LEFT.png', 16, 32, g);
}

// ── STORAGE ──────────────────────────────────────────────

function generateWoodenBookshelfSmall() {
  // 32×32, 2×2, backgroundTiles:1
  const g = makeGrid(32, 32);
  // Frame
  outlinedRect(g, 0, 2, 32, 28, WOOD_MED);
  // Top highlight
  fillRect(g, 1, 3, 30, 1, WOOD_HI);
  // Shelves (3 rows)
  fillRect(g, 0, 10, 32, 1, WOOD_DARK);
  fillRect(g, 0, 18, 32, 1, WOOD_DARK);
  fillRect(g, 0, 26, 32, 1, WOOD_DARK);
  // Interior (lighter)
  fillRect(g, 1, 3, 30, 7, WOOD_LIGHT);
  fillRect(g, 1, 11, 30, 7, WOOD_LIGHT);
  fillRect(g, 1, 19, 30, 7, WOOD_LIGHT);
  // Sides
  fillRect(g, 0, 2, 1, 28, BK);
  fillRect(g, 31, 2, 1, 28, BK);
  fillRect(g, 1, 2, 1, 28, WOOD_DARK);
  fillRect(g, 30, 2, 1, 28, WOOD_DARK);
  savePng('furniture/storage/WOODEN_BOOKSHELF_SMALL.png', 32, 32, g);
}

function generateFullWoodenBookshelfSmall() {
  // 32×32, 2×2, backgroundTiles:1 (with books)
  const g = makeGrid(32, 32);
  // Frame
  outlinedRect(g, 0, 2, 32, 28, WOOD_MED);
  fillRect(g, 1, 3, 30, 1, WOOD_HI);
  fillRect(g, 0, 10, 32, 1, WOOD_DARK);
  fillRect(g, 0, 18, 32, 1, WOOD_DARK);
  fillRect(g, 0, 26, 32, 1, WOOD_DARK);
  fillRect(g, 0, 2, 1, 28, BK);
  fillRect(g, 31, 2, 1, 28, BK);
  fillRect(g, 1, 2, 1, 28, WOOD_DARK);
  fillRect(g, 30, 2, 1, 28, WOOD_DARK);

  // Books on shelves (colored rectangles)
  const bookColors = [RED_MED, BLUE_MED, GREEN_MED, ORANGE, CREAM_DARK, RED_DARK, BLUE_DARK];
  function drawBooks(shelfY, startX, count) {
    let x = startX;
    for (let i = 0; i < count && x < 28; i++) {
      const bw = 2 + (i % 2);
      const bh = 5 + (i % 3);
      const by = shelfY - bh;
      const color = bookColors[i % bookColors.length];
      fillRect(g, x, by, bw, bh, color);
      g[by][x] = BK; // spine line
      x += bw + 1;
    }
  }
  drawBooks(10, 3, 6);
  drawBooks(18, 3, 5);
  drawBooks(26, 4, 6);

  savePng('furniture/storage/FULL_WOODEN_BOOKSHELF_SMALL.png', 32, 32, g);
}

function generateFridge() {
  // 16×32, 1×2, backgroundTiles:1
  const g = makeGrid(16, 32);
  // Main body
  outlinedRect(g, 1, 2, 14, 28, WHITE);
  // Top section (freezer)
  outlinedRect(g, 1, 2, 14, 10, LGRAY);
  fillRect(g, 2, 3, 12, 1, WHITE); // highlight
  // Handle
  fillRect(g, 12, 6, 1, 4, DGRAY);
  // Bottom section (fridge)
  fillRect(g, 2, 13, 12, 1, WHITE); // top highlight
  // Handle
  fillRect(g, 12, 17, 1, 6, DGRAY);
  // Divider
  fillRect(g, 1, 12, 14, 1, BK);
  // Feet
  g[30][3] = DGRAY; g[30][12] = DGRAY;
  savePng('furniture/storage/FRIDGE.png', 16, 32, g);
}

function generateCrates3() {
  // 32×32, 2×2, backgroundTiles:1
  const g = makeGrid(32, 32);
  // Bottom left crate
  outlinedRect(g, 1, 18, 14, 12, WOOD_MED);
  fillRect(g, 2, 19, 12, 1, WOOD_HI);
  // Cross planks
  fillRect(g, 1, 23, 14, 1, WOOD_DARK);
  fillRect(g, 7, 18, 1, 12, WOOD_DARK);
  // Bottom right crate
  outlinedRect(g, 16, 18, 14, 12, WOOD_MED);
  fillRect(g, 17, 19, 12, 1, WOOD_HI);
  fillRect(g, 16, 23, 14, 1, WOOD_DARK);
  fillRect(g, 22, 18, 1, 12, WOOD_DARK);
  // Top crate (stacked)
  outlinedRect(g, 5, 6, 14, 12, WOOD_LIGHT);
  fillRect(g, 6, 7, 12, 1, WOOD_HI);
  fillRect(g, 5, 11, 14, 1, WOOD_DARK);
  fillRect(g, 11, 6, 1, 12, WOOD_DARK);
  savePng('furniture/storage/CRATES_3.png', 32, 32, g);
}

// ── ELECTRONICS ──────────────────────────────────────────

function generateFullComputerCoffeeOff() {
  // 32×32, 2×2, canPlaceOnSurfaces, backgroundTiles:1
  // Retro 90s beige CRT monitor + keyboard + coffee mug — compact size
  const BEIGE = rgba(0xd4, 0xc8, 0xaa);
  const BEIGE_DARK = rgba(0xb0, 0xa4, 0x88);
  const BEIGE_SHADOW = rgba(0x90, 0x84, 0x6c);
  const BEIGE_HI = rgba(0xe8, 0xdc, 0xc4);
  const CRT_GREEN = rgba(0x20, 0x60, 0x30);
  const CRT_GREEN_BR = rgba(0x30, 0x80, 0x40);
  const GLARE = rgba(0x50, 0x70, 0x80, 80);
  const g = makeGrid(32, 32);
  // CRT monitor body — compact beige box (centered around x=12)
  outlinedRect(g, 6, 3, 14, 3, BEIGE_DARK, BK2); // top bulge (CRT depth)
  outlinedRect(g, 5, 6, 16, 10, BEIGE, BK2);      // main body
  fillRect(g, 6, 6, 14, 1, BEIGE_SHADOW);  // top bezel shadow
  // Rounded CRT screen inset
  fillRect(g, 8, 8, 10, 6, SCREEN_DARK);   // main screen
  fillRect(g, 7, 9, 12, 4, SCREEN_DARK);   // wider middle
  // Round corners
  g[8][8] = BEIGE; g[8][17] = BEIGE;
  g[13][8] = BEIGE; g[13][17] = BEIGE;
  // Green phosphor text
  fillRect(g, 9, 9, 5, 1, CRT_GREEN_BR);
  fillRect(g, 9, 11, 8, 1, CRT_GREEN);
  fillRect(g, 9, 13, 4, 1, CRT_GREEN_BR);
  // Screen glare — small bright streak top-right
  g[8][15] = GLARE; g[8][16] = GLARE;
  g[9][16] = GLARE; g[9][17] = GLARE;
  g[10][17] = GLARE;
  // Power LED
  g[14][7] = rgba(0x30, 0xc0, 0x30);
  // CRT stand
  fillRect(g, 10, 16, 6, 1, BEIGE_DARK);
  outlinedRect(g, 8, 17, 10, 2, BEIGE_SHADOW, BK2);
  // Keyboard — compact
  outlinedRect(g, 6, 20, 14, 4, BEIGE, BK2);
  fillRect(g, 7, 21, 12, 2, BEIGE_HI);
  for (let x = 8; x < 18; x += 2) g[21][x] = BEIGE_DARK;
  for (let x = 9; x < 17; x += 2) g[22][x] = BEIGE_DARK;
  fillRect(g, 10, 22, 4, 1, BEIGE_DARK); // spacebar
  // Coffee mug (right side)
  outlinedRect(g, 23, 22, 6, 6, WHITE);
  fillRect(g, 24, 23, 4, 4, LGRAY);
  fillRect(g, 24, 23, 4, 2, BROWN_MED);
  g[23][29] = BK; g[24][30] = BK; g[25][29] = BK;
  savePng('furniture/electronics/FULL_COMPUTER_COFFEE_OFF.png', 32, 32, g);
}

function generateLaptopLeft() {
  // 16×32, 1×2, canPlaceOnSurfaces, backgroundTiles:1
  // Retro 90s chunky laptop — thick beige ThinkPad-style, matching back view size
  const BEIGE = rgba(0xd4, 0xc8, 0xaa);
  const BEIGE_DARK = rgba(0xb0, 0xa4, 0x88);
  const BEIGE_HI = rgba(0xe8, 0xdc, 0xc4);
  const BEIGE_SHADOW = rgba(0x90, 0x84, 0x6c);
  const CRT_GREEN = rgba(0x20, 0x60, 0x30);
  const CRT_GREEN_BR = rgba(0x30, 0x80, 0x40);
  const g = makeGrid(16, 32);
  // Screen lid bezel — same size as back view
  outlinedRect(g, 1, 7, 14, 11, BEIGE_DARK, BK2);
  // Rounded CRT screen inset — clip corners for curved look
  fillRect(g, 3, 9, 10, 7, SCREEN_DARK);
  fillRect(g, 2, 10, 12, 5, SCREEN_DARK); // wider middle rows
  // Round corners: fill the 4 corner pixels with bezel color
  g[9][3] = BEIGE_DARK; g[9][12] = BEIGE_DARK;   // top corners
  g[15][3] = BEIGE_DARK; g[15][12] = BEIGE_DARK;  // bottom corners
  // Green phosphor text lines
  fillRect(g, 4, 10, 5, 1, CRT_GREEN_BR);
  fillRect(g, 4, 12, 7, 1, CRT_GREEN);
  fillRect(g, 4, 14, 4, 1, CRT_GREEN_BR);
  // Power LED on bezel
  g[16][3] = rgba(0x30, 0xc0, 0x30);
  // Chunky hinge
  fillRect(g, 2, 18, 12, 2, DDGRAY);
  g[18][4] = MGRAY; g[18][11] = MGRAY; // hinge knobs
  // Thick base/keyboard — same width as back view
  outlinedRect(g, 2, 20, 12, 4, BEIGE, BK2);
  fillRect(g, 3, 21, 10, 2, BEIGE_HI);
  // Key rows
  for (let x = 4; x < 12; x += 2) g[21][x] = BEIGE_DARK;
  for (let x = 5; x < 11; x += 2) g[22][x] = BEIGE_DARK;
  // TrackPoint nub
  g[22][7] = rgba(0xc0, 0x30, 0x30);
  savePng('furniture/electronics/LAPTOP_LEFT.png', 16, 32, g);
}

function generateLaptopBack() {
  // 16×32, 1×2, canPlaceOnSurfaces, backgroundTiles:1
  // Retro 90s chunky laptop — back view showing thick lid
  const BEIGE = rgba(0xd4, 0xc8, 0xaa);
  const BEIGE_DARK = rgba(0xb0, 0xa4, 0x88);
  const BEIGE_SHADOW = rgba(0x90, 0x84, 0x6c);
  const g = makeGrid(16, 32);
  // Thick screen back (chunky lid)
  outlinedRect(g, 1, 7, 14, 11, BEIGE_DARK, BK2);
  fillRect(g, 2, 8, 12, 9, BEIGE);
  fillRect(g, 3, 9, 10, 1, BEIGE_SHADOW); // top shadow line
  // Manufacturer logo area (centered rectangle)
  outlinedRect(g, 5, 11, 6, 3, BEIGE_SHADOW, BEIGE_DARK);
  // Vent lines
  for (let y = 15; y < 17; y++) {
    for (let x = 4; x < 12; x += 2) g[y][x] = BEIGE_SHADOW;
  }
  // Chunky hinge
  fillRect(g, 2, 18, 12, 2, DDGRAY);
  g[18][4] = MGRAY; g[18][11] = MGRAY; // hinge knobs
  // Base edge visible from back (thick)
  outlinedRect(g, 2, 20, 12, 4, BEIGE, BK2);
  fillRect(g, 3, 21, 10, 2, BEIGE_DARK);
  // Port rectangles on back edge
  fillRect(g, 4, 21, 2, 1, DDGRAY); // serial port
  fillRect(g, 8, 21, 3, 1, DDGRAY); // parallel port
  savePng('furniture/electronics/LAPTOP_BACK.png', 16, 32, g);
}

function generateServer() {
  // 16×32, 1×2, backgroundTiles:1
  const g = makeGrid(16, 32);
  // Server rack body
  outlinedRect(g, 1, 2, 14, 28, DDGRAY);
  fillRect(g, 2, 3, 12, 1, DGRAY); // top highlight
  // Server units (3 stacked)
  for (let i = 0; i < 3; i++) {
    const y = 5 + i * 8;
    outlinedRect(g, 2, y, 12, 6, DGRAY);
    fillRect(g, 3, y + 1, 10, 4, METAL_DARK);
    // LEDs
    g[y + 2][4] = rgba(0x40, 0xc0, 0x40); // green LED
    g[y + 2][6] = rgba(0x40, 0xc0, 0x40);
    // Vent lines
    for (let x = 8; x < 13; x++) g[y + 2][x] = DDGRAY;
    for (let x = 8; x < 13; x++) g[y + 4][x] = DDGRAY;
  }
  // Base
  fillRect(g, 2, 29, 12, 1, METAL_DARK);
  savePng('furniture/electronics/SERVER.png', 16, 32, g);
}

function generateTelephone() {
  // 16×32, 1×2, canPlaceOnWalls, canPlaceOnSurfaces, backgroundTiles:1
  const g = makeGrid(16, 32);
  // Wall mount plate (top half is background)
  outlinedRect(g, 3, 16, 10, 12, DGRAY);
  fillRect(g, 4, 17, 8, 10, METAL_MED);
  // Handset cradle
  outlinedRect(g, 2, 18, 12, 3, DDGRAY);
  // Handset
  outlinedRect(g, 3, 17, 4, 2, BK);
  outlinedRect(g, 9, 17, 4, 2, BK);
  fillRect(g, 5, 17, 6, 1, DDGRAY); // cord area
  // Number pad
  for (let dy = 0; dy < 3; dy++)
    for (let dx = 0; dx < 3; dx++)
      g[22 + dy * 2][5 + dx * 2] = LGRAY;
  savePng('furniture/electronics/TELEPHONE.png', 16, 32, g);
}

// ── DECOR ────────────────────────────────────────────────

function generateBookSingleRed() {
  // 16×16, 1×1, canPlaceOnSurfaces
  const g = makeGrid(16, 16);
  // Book lying flat
  outlinedRect(g, 3, 5, 10, 7, RED_MED);
  fillRect(g, 4, 6, 8, 1, RED_LIGHT); // cover highlight
  // Spine
  fillRect(g, 3, 5, 1, 7, RED_DARK);
  // Pages visible on right
  fillRect(g, 12, 6, 1, 5, WHITE);
  // Title line
  fillRect(g, 5, 8, 6, 1, rgba(0xd0, 0xb0, 0x60));
  savePng('furniture/decor/BOOK_SINGLE_RED.png', 16, 16, g);
}

function generateClockWallWhite() {
  // 16×16, 1×1
  const g = makeGrid(16, 16);
  // Clock face (circular-ish)
  outlinedRect(g, 3, 3, 10, 10, WHITE);
  // Round the corners
  g[3][3] = T; g[3][12] = T; g[12][3] = T; g[12][12] = T;
  g[3][3] = BK; g[3][12] = BK; g[12][3] = BK; g[12][12] = BK;
  // Clock center
  g[7][8] = BK; g[8][8] = BK;
  // Hour marks
  g[4][8] = DGRAY; // 12
  g[8][11] = DGRAY; // 3
  g[11][8] = DGRAY; // 6
  g[8][5] = DGRAY; // 9
  // Hands
  g[5][8] = BK; g[6][8] = BK; // hour hand (up)
  g[8][9] = BK; g[8][10] = BK; // minute hand (right)
  savePng('furniture/decor/CLOCK_WALL_WHITE.png', 16, 16, g);
}

function generatePaperSide() {
  // 16×32, 1×2, canPlaceOnSurfaces, backgroundTiles:1
  const g = makeGrid(16, 32);
  // Stack of papers (side view)
  // Bottom sheet
  outlinedRect(g, 2, 22, 12, 6, WHITE);
  fillRect(g, 3, 23, 10, 4, LGRAY);
  // Lines on paper
  for (let y = 24; y < 27; y++)
    fillRect(g, 4, y, 8, 1, rgba(0xc0, 0xc0, 0xc0));
  // Top sheet (slightly offset)
  outlinedRect(g, 3, 19, 11, 5, WHITE);
  fillRect(g, 4, 20, 9, 3, LGRAY);
  for (let y = 20; y < 22; y++)
    fillRect(g, 5, y, 7, 1, rgba(0xc0, 0xc0, 0xc0));
  savePng('furniture/decor/PAPER_SIDE.png', 16, 32, g);
}

function generatePlant(filename, potColor, leafDark, leafLight, leafHi) {
  // 16×32, 1×2, backgroundTiles:1
  const g = makeGrid(16, 32);
  // Pot
  outlinedRect(g, 4, 24, 8, 6, potColor);
  fillRect(g, 5, 25, 6, 1, BROWN_LIGHT); // rim highlight
  // Pot rim
  outlinedRect(g, 3, 23, 10, 2, potColor);
  // Soil
  fillRect(g, 5, 25, 6, 1, EARTH_BROWN);
  // Stem
  fillRect(g, 7, 16, 2, 8, GREEN_DARK);
  // Leaves (bushy top)
  fillRect(g, 4, 12, 8, 6, leafDark);
  fillRect(g, 3, 14, 10, 3, leafDark);
  fillRect(g, 5, 11, 6, 2, leafLight);
  fillRect(g, 5, 13, 6, 3, leafLight);
  // Highlights
  g[12][6] = leafHi; g[13][9] = leafHi; g[14][5] = leafHi;
  g[12][8] = leafHi; g[15][7] = leafHi;
  // Outline top
  g[11][4] = BK; g[11][5] = BK; g[11][10] = BK; g[11][11] = BK;
  savePng(filename, 16, 32, g);
}

function generateClockWallColor() {
  // 16×32, 1×2, canPlaceOnWalls
  const g = makeGrid(16, 32);
  // Clock body (lower portion, for wall mounting)
  // Frame
  outlinedRect(g, 2, 18, 12, 12, WOOD_MED);
  // Round corners
  g[18][2] = T; g[18][13] = T; g[29][2] = T; g[29][13] = T;
  // Clock face
  fillRect(g, 3, 19, 10, 10, WHITE);
  // Clock center
  g[23][8] = BK; g[24][8] = BK;
  // Hour marks
  g[20][8] = RED_MED; // 12
  g[24][12] = BLUE_MED; // 3
  g[28][8] = RED_MED; // 6
  g[24][4] = BLUE_MED; // 9
  // Hands
  g[21][8] = BK; g[22][8] = BK;
  g[24][9] = BK; g[24][10] = BK; g[24][11] = BK;
  savePng('furniture/wall/CLOCK_WALL_COLOR.png', 16, 32, g);
}

function generatePaintingLandscape() {
  // 32×32, 2×2, canPlaceOnWalls
  const g = makeGrid(32, 32);
  // Frame
  outlinedRect(g, 0, 8, 32, 24, WOOD_DARK);
  // Inner frame
  outlinedRect(g, 1, 9, 30, 22, WOOD_MED);
  // Canvas
  fillRect(g, 2, 10, 28, 20, SKY_LIGHT);
  // Sky gradient
  fillRect(g, 2, 10, 28, 6, SKY_LIGHT);
  fillRect(g, 2, 16, 28, 3, SKY_MED);
  // Mountains
  for (let x = 2; x < 30; x++) {
    const h = Math.abs(Math.sin(x * 0.4)) * 6;
    for (let dy = 0; dy < h; dy++) {
      const y = 19 - dy;
      if (y >= 10) g[y][x] = rgba(0x5a, 0x6a, 0x7a);
    }
  }
  // Grass
  fillRect(g, 2, 20, 28, 8, GRASS_GREEN);
  fillRect(g, 2, 22, 28, 6, GRASS_LIGHT);
  // Sun
  g[11][24] = SUN_YELLOW; g[11][25] = SUN_YELLOW;
  g[12][24] = SUN_YELLOW; g[12][25] = SUN_YELLOW;
  // Tree
  fillRect(g, 6, 16, 2, 6, BROWN_MED); // trunk
  fillRect(g, 3, 13, 8, 4, GREEN_DARK); // canopy
  fillRect(g, 4, 12, 6, 2, GREEN_MED);
  savePng('furniture/wall/PAINTING_LANDSCAPE.png', 32, 32, g);
}

function generatePaintingLandscape2() {
  // 32×32, 2×2, canPlaceOnWalls
  const g = makeGrid(32, 32);
  // Frame
  outlinedRect(g, 0, 8, 32, 24, WOOD_MED);
  outlinedRect(g, 1, 9, 30, 22, WOOD_LIGHT);
  // Canvas - sunset scene
  fillRect(g, 2, 10, 28, 20, rgba(0xe0, 0x90, 0x50)); // sunset sky
  fillRect(g, 2, 10, 28, 5, rgba(0xf0, 0xb0, 0x60));
  fillRect(g, 2, 15, 28, 3, rgba(0xd0, 0x70, 0x40));
  // Sun
  g[11][15] = SUN_YELLOW; g[11][16] = SUN_YELLOW;
  g[12][15] = SUN_YELLOW; g[12][16] = SUN_YELLOW;
  g[12][14] = rgba(0xf0, 0xe0, 0x80); g[12][17] = rgba(0xf0, 0xe0, 0x80);
  // Water
  fillRect(g, 2, 18, 28, 10, rgba(0x30, 0x50, 0x80));
  // Water reflection
  for (let y = 19; y < 28; y += 2)
    fillRect(g, 2, y, 28, 1, rgba(0x40, 0x60, 0x90));
  // Land silhouette
  fillRect(g, 2, 18, 8, 3, rgba(0x20, 0x30, 0x20));
  fillRect(g, 22, 18, 8, 2, rgba(0x20, 0x30, 0x20));
  savePng('furniture/wall/PAINTING_LANDSCAPE_2.png', 32, 32, g);
}

// ── MISC ─────────────────────────────────────────────────

function generateVendingMachine() {
  // 32×32, 2×2, backgroundTiles:1
  const g = makeGrid(32, 32);
  // Main body
  outlinedRect(g, 1, 2, 30, 28, DGRAY);
  fillRect(g, 2, 3, 28, 1, MGRAY); // top highlight
  // Display window
  outlinedRect(g, 3, 5, 18, 16, BK);
  fillRect(g, 4, 6, 16, 14, rgba(0x20, 0x30, 0x20));
  // Product rows (colored rectangles)
  const snackColors = [RED_MED, BLUE_MED, ORANGE, GREEN_MED, RED_LIGHT, BLUE_LIGHT];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const sx = 5 + col * 4;
      const sy = 7 + row * 4;
      const c = snackColors[(row * 4 + col) % snackColors.length];
      fillRect(g, sx, sy, 3, 3, c);
    }
  }
  // Control panel
  outlinedRect(g, 22, 6, 8, 10, DDGRAY);
  fillRect(g, 23, 7, 6, 3, METAL_MED); // coin slot area
  // Buttons
  g[12][24] = RED_MED; g[12][26] = GREEN_MED;
  // Dispensing slot
  outlinedRect(g, 3, 22, 18, 5, BK);
  fillRect(g, 4, 23, 16, 3, rgba(0x10, 0x10, 0x10));
  savePng('furniture/misc/VENDING_MACHINE.png', 32, 32, g);
}

function generateWaterCooler() {
  // 16×32, 1×2, backgroundTiles:1
  const g = makeGrid(16, 32);
  // Water bottle (top)
  outlinedRect(g, 4, 4, 8, 10, rgba(0xb0, 0xd0, 0xf0));
  fillRect(g, 5, 5, 6, 8, rgba(0xc0, 0xe0, 0xf8));
  fillRect(g, 6, 5, 2, 8, rgba(0xd0, 0xf0, 0xff)); // highlight
  // Bottle neck
  outlinedRect(g, 5, 13, 6, 2, rgba(0xb0, 0xd0, 0xf0));
  // Cooler body
  outlinedRect(g, 3, 15, 10, 10, LGRAY);
  fillRect(g, 4, 16, 8, 8, WHITE);
  fillRect(g, 4, 16, 8, 1, METAL_HI); // highlight
  // Taps
  g[19][5] = BLUE_MED; // cold
  g[19][10] = RED_MED; // hot
  // Drip tray
  outlinedRect(g, 4, 22, 8, 2, DGRAY);
  // Base/legs
  outlinedRect(g, 3, 25, 10, 5, DGRAY);
  fillRect(g, 4, 26, 8, 3, METAL_MED);
  savePng('furniture/misc/WATER_COOLER.png', 16, 32, g);
}

function generateBin() {
  // 16×16, 1×1
  const g = makeGrid(16, 16);
  // Bin body (slightly tapered)
  outlinedRect(g, 3, 4, 10, 10, DGRAY);
  fillRect(g, 4, 5, 8, 8, METAL_MED);
  fillRect(g, 4, 5, 8, 1, METAL_LIGHT); // rim highlight
  // Rim
  outlinedRect(g, 2, 3, 12, 2, DGRAY);
  fillRect(g, 3, 3, 10, 1, METAL_LIGHT);
  // Vertical lines (ridges)
  for (let y = 5; y < 13; y++) {
    g[y][6] = DGRAY;
    g[y][9] = DGRAY;
  }
  savePng('furniture/misc/BIN.png', 16, 16, g);
}

function generateCoffeeMug() {
  // 16×16, 1×1, canPlaceOnSurfaces
  const g = makeGrid(16, 16);
  // Mug body
  outlinedRect(g, 4, 5, 7, 8, WHITE);
  fillRect(g, 5, 6, 5, 6, LGRAY);
  // Coffee inside
  fillRect(g, 5, 6, 5, 3, BROWN_MED);
  fillRect(g, 5, 6, 5, 1, BROWN_LIGHT); // surface
  // Handle
  g[7][11] = BK;
  g[8][12] = BK;
  g[9][12] = BK;
  g[10][11] = BK;
  // Steam
  g[3][6] = rgba(0xc0, 0xc0, 0xc0, 128);
  g[2][8] = rgba(0xc0, 0xc0, 0xc0, 128);
  savePng('furniture/misc/COFFEE_MUG.png', 16, 16, g);
}

// ── JUKEBOX ──────────────────────────────────────────────

const NEON_PINK = rgba(0xff, 0x40, 0x80);
const NEON_CYAN = rgba(0x40, 0xe0, 0xff);
const NEON_PURPLE = rgba(0xc0, 0x40, 0xff);
const NEON_GREEN_JB = rgba(0x40, 0xff, 0x80);
const NEON_YELLOW = rgba(0xff, 0xe0, 0x40);
const CABINET_DARK = rgba(0x2a, 0x1a, 0x3a);
const CABINET_MED = rgba(0x3a, 0x28, 0x4a);
const CABINET_LIGHT = rgba(0x4a, 0x38, 0x5a);
const CABINET_HI = rgba(0x5a, 0x48, 0x6a);
const CHROME = rgba(0xc0, 0xc0, 0xd0);
const CHROME_DARK = rgba(0x80, 0x80, 0x90);

function generateJukeboxOff() {
  // 16×32, 1×2, backgroundTiles:1
  const g = makeGrid(16, 32);
  // Cabinet body (bottom half is main visible part)
  outlinedRect(g, 1, 6, 14, 24, CABINET_DARK);
  fillRect(g, 2, 7, 12, 22, CABINET_MED);
  // Top dome/arch highlight
  fillRect(g, 2, 7, 12, 2, CABINET_LIGHT);
  fillRect(g, 3, 7, 10, 1, CABINET_HI);
  // Display window (dark when off)
  outlinedRect(g, 3, 10, 10, 6, BK);
  fillRect(g, 4, 11, 8, 4, rgba(0x15, 0x10, 0x20));
  // Record slot / disc area
  fillRect(g, 5, 12, 6, 2, rgba(0x20, 0x18, 0x28));
  // Chrome trim lines
  fillRect(g, 2, 9, 12, 1, CHROME_DARK);
  fillRect(g, 2, 16, 12, 1, CHROME_DARK);
  // Speaker grille (lower section)
  outlinedRect(g, 3, 18, 10, 8, CABINET_DARK);
  fillRect(g, 4, 19, 8, 6, CABINET_MED);
  // Grille lines
  for (let y = 19; y < 25; y += 2) {
    fillRect(g, 4, y, 8, 1, CABINET_DARK);
  }
  // Buttons (off - dim)
  g[17][5] = DGRAY; g[17][7] = DGRAY; g[17][10] = DGRAY;
  // Base/feet
  fillRect(g, 2, 27, 12, 2, CABINET_DARK);
  fillRect(g, 3, 29, 2, 1, CHROME_DARK);
  fillRect(g, 11, 29, 2, 1, CHROME_DARK);
  savePng('furniture/electronics/JUKEBOX_FRONT_OFF.png', 16, 32, g);
}

function generateJukeboxOn() {
  // 16×32, 1×2, backgroundTiles:1 — glowing when playing
  const g = makeGrid(16, 32);
  // Cabinet body
  outlinedRect(g, 1, 6, 14, 24, CABINET_DARK);
  fillRect(g, 2, 7, 12, 22, CABINET_MED);
  // Top dome with glow
  fillRect(g, 2, 7, 12, 2, CABINET_LIGHT);
  fillRect(g, 3, 7, 10, 1, NEON_PURPLE);
  // Display window (lit up!)
  outlinedRect(g, 3, 10, 10, 6, NEON_CYAN);
  fillRect(g, 4, 11, 8, 4, rgba(0x10, 0x20, 0x40));
  // Animated equalizer bars in display
  g[14][5] = NEON_GREEN_JB; g[13][5] = NEON_GREEN_JB; g[12][5] = NEON_GREEN_JB;
  g[14][6] = NEON_CYAN; g[13][6] = NEON_CYAN;
  g[14][7] = NEON_PINK; g[13][7] = NEON_PINK; g[12][7] = NEON_PINK; g[11][7] = NEON_PINK;
  g[14][8] = NEON_YELLOW; g[13][8] = NEON_YELLOW; g[12][8] = NEON_YELLOW;
  g[14][9] = NEON_GREEN_JB; g[13][9] = NEON_GREEN_JB;
  g[14][10] = NEON_CYAN; g[13][10] = NEON_CYAN; g[12][10] = NEON_CYAN; g[11][10] = NEON_CYAN;
  // Chrome trim (slightly lit)
  fillRect(g, 2, 9, 12, 1, CHROME);
  fillRect(g, 2, 16, 12, 1, CHROME);
  // Speaker grille with glow
  outlinedRect(g, 3, 18, 10, 8, CABINET_DARK);
  fillRect(g, 4, 19, 8, 6, CABINET_MED);
  for (let y = 19; y < 25; y += 2) {
    fillRect(g, 4, y, 8, 1, CABINET_DARK);
  }
  // Sound waves emanating from speaker
  g[20][4] = NEON_CYAN; g[22][4] = NEON_CYAN;
  g[20][11] = NEON_PINK; g[22][11] = NEON_PINK;
  // Buttons (lit)
  g[17][5] = NEON_GREEN_JB; g[17][7] = NEON_PINK; g[17][10] = NEON_CYAN;
  // Base/feet
  fillRect(g, 2, 27, 12, 2, CABINET_DARK);
  fillRect(g, 3, 29, 2, 1, CHROME);
  fillRect(g, 11, 29, 2, 1, CHROME);
  // Ambient glow at base
  g[26][2] = NEON_PURPLE; g[26][13] = NEON_PURPLE;
  savePng('furniture/electronics/JUKEBOX_FRONT_ON.png', 16, 32, g);
}

// ══════════════════════════════════════════════════════════
// ═══ MAIN ════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════

console.log('Generating open-source replacement assets...\n');

console.log('── Floor tiles ──');
generateFloors();

console.log('\n── Desks ──');
generateCounterWhiteSm();
generateTableWoodLg();
generateTableWood();
generateCoffeeTableLg();

console.log('\n── Chairs ──');
generateChairCushionedRight();
generateChairCushionedLeft();
generateStool();
generateChairCushionedLgRight();
generateChairCushionedLgLeft();

console.log('\n── Storage ──');
generateWoodenBookshelfSmall();
generateFullWoodenBookshelfSmall();
generateFridge();
generateCrates3();

console.log('\n── Electronics ──');
generateFullComputerCoffeeOff();
generateLaptopLeft();
generateLaptopBack();
generateServer();
generateTelephone();

console.log('\n── Decor ──');
generateBookSingleRed();
generateClockWallWhite();
generatePaperSide();
generatePlant('furniture/decor/WHITE_PLANT_2.png', BROWN_LIGHT, rgba(0x80, 0xb0, 0x70), rgba(0xa0, 0xd0, 0x90), rgba(0xc0, 0xe8, 0xb0));
generatePlant('furniture/decor/WHITE_PLANT_3.png', BROWN_LIGHT, rgba(0x70, 0xa8, 0x68), rgba(0x90, 0xc8, 0x88), rgba(0xb0, 0xe0, 0xa8));
generatePlant('furniture/decor/PLANT_2.png', BROWN_DARK, GREEN_DARK, GREEN_MED, GREEN_LIGHT);
generatePlant('furniture/decor/PLANT_3.png', BROWN_DARK, rgba(0x25, 0x50, 0x20), rgba(0x35, 0x70, 0x2b), rgba(0x50, 0x90, 0x45));

console.log('\n── Wall ──');
generateClockWallColor();
generatePaintingLandscape();
generatePaintingLandscape2();

console.log('\n── Misc ──');
generateVendingMachine();
generateWaterCooler();
generateBin();
generateCoffeeMug();

console.log('\n── Jukebox ──');
generateJukeboxOff();
generateJukeboxOn();

console.log('\n✅ All furniture and floor assets generated!');
console.log(`Total: 34 sprites + 1 floor tileset`);
