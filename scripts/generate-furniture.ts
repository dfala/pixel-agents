#!/usr/bin/env node
/**
 * Pixel Agents — Procedural furniture & floor asset generator
 *
 * Generates all 32 furniture PNGs + furniture-catalog.json + floors.png
 * needed by the default layout, with no external tileset dependency.
 *
 * Usage:  npx tsx scripts/generate-furniture.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { PNG } from 'pngjs'

// ── Tiny canvas helper ───────────────────────────────────────

class Sprite {
  d: string[][] // [y][x] '#RRGGBB' or ''
  w: number
  h: number
  constructor(w: number, h: number) {
    this.w = w; this.h = h
    this.d = Array.from({ length: h }, () => Array(w).fill(''))
  }
  px(x: number, y: number, c: string) {
    if (x >= 0 && x < this.w && y >= 0 && y < this.h && c) this.d[y][x] = c
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.px(x + dx, y + dy, c)
  }
  border(x: number, y: number, w: number, h: number, c: string) {
    for (let i = 0; i < w; i++) { this.px(x + i, y, c); this.px(x + i, y + h - 1, c) }
    for (let i = 0; i < h; i++) { this.px(x, y + i, c); this.px(x + w - 1, y + i, c) }
  }
  hline(x: number, y: number, len: number, c: string) {
    for (let i = 0; i < len; i++) this.px(x + i, y, c)
  }
  vline(x: number, y: number, len: number, c: string) {
    for (let i = 0; i < len; i++) this.px(x, y + i, c)
  }
  /** Fill from character-map rows + palette  ('.' = transparent) */
  charMap(rows: string[], pal: Record<string, string>, ox = 0, oy = 0) {
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x]
        if (ch !== '.' && pal[ch]) this.px(ox + x, oy + y, pal[ch])
      }
  }
  /** Mirror horizontally */
  flipH(): Sprite {
    const s = new Sprite(this.w, this.h)
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        s.d[y][this.w - 1 - x] = this.d[y][x]
    return s
  }
  toPNG(): Buffer {
    const png = new PNG({ width: this.w, height: this.h })
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const idx = (y * this.w + x) * 4
        const c = this.d[y][x]
        if (c) {
          png.data[idx] = parseInt(c.slice(1, 3), 16)
          png.data[idx + 1] = parseInt(c.slice(3, 5), 16)
          png.data[idx + 2] = parseInt(c.slice(5, 7), 16)
          png.data[idx + 3] = 255
        }
      }
    return PNG.sync.write(png)
  }
}

// ── Palette ──────────────────────────────────────────────────

const O  = '#2A2A2A' // outline
const WD = '#5C3A1E' // wood dark
const WM = '#8B6240' // wood medium
const WL = '#B08850' // wood light
const WX = '#C8A060' // wood extra-light
const WH = '#E0C890' // wood highlight
const W  = '#E0E0E0' // white
const LG = '#B8B8B8' // light gray
const MG = '#909090' // medium gray
const DG = '#606060' // dark gray
const ML = '#A0A8B0' // metal light
const MM = '#7A8290' // metal medium
const MD = '#505860' // metal dark
const SD = '#283840' // screen dark
const RD = '#802020' // red dark
const RM = '#C04040' // red medium
const GD = '#2A5020' // green dark
const GM = '#3A8030' // green medium
const GL = '#50A840' // green light
const GX = '#68C050' // green extra-light
const PD = '#5A3818' // pot dark
const PM = '#7A5030' // pot medium
const BM = '#406090' // blue medium
const BL = '#6088B8' // blue light
const BD = '#2A4060' // blue dark
const CL = '#C08050' // cushion light
const CD = '#905830' // cushion dark
const TN = '#D4B896' // tan
const YL = '#E0C060' // yellow
const OR = '#D08030' // orange
const WB = '#F0F0F0' // white bright

// ── Sprite builders ──────────────────────────────────────────
// Each returns a Sprite at the correct pixel dimensions.

function counterWhiteSm(): Sprite { // 32×32, desk, bg=1
  const s = new Sprite(32, 32)
  // Top surface (background tile zone: rows 0-15)
  s.rect(1, 2, 30, 12, W)
  s.hline(1, 1, 30, LG)
  s.border(0, 1, 32, 14, O)
  // Front face (blocking zone: rows 16-31)
  s.rect(1, 16, 30, 14, LG)
  s.border(0, 15, 32, 16, O)
  // Shelf line
  s.hline(1, 23, 30, MG)
  // Knobs
  s.px(8, 20, DG); s.px(24, 20, DG)
  return s
}

function woodenBookshelfSmall(): Sprite { // 32×32, bg=1
  const s = new Sprite(32, 32)
  // Frame
  s.rect(1, 1, 30, 30, WM)
  s.border(0, 0, 32, 32, O)
  // Shelves
  s.hline(1, 10, 30, WD); s.hline(1, 20, 30, WD)
  // Empty shelves — just a few books
  s.rect(3, 3, 3, 7, RM); s.rect(7, 5, 2, 5, BM); s.rect(10, 4, 3, 6, GM)
  s.rect(4, 12, 2, 8, BL); s.rect(8, 14, 3, 6, WD)
  return s
}

function fullWoodenBookshelfSmall(): Sprite { // 32×32, bg=1
  const s = new Sprite(32, 32)
  s.rect(1, 1, 30, 30, WM)
  s.border(0, 0, 32, 32, O)
  s.hline(1, 10, 30, WD); s.hline(1, 20, 30, WD)
  // Full shelves
  const colors = [RM, BM, GM, WD, BL, OR, RM, DG, GM, BM]
  for (let shelf = 0; shelf < 3; shelf++) {
    const sy = shelf * 10 + 2
    const sh = shelf === 2 ? 9 : 8
    let bx = 2
    for (let i = 0; i < 4 + shelf; i++) {
      const bw = 2 + (i % 2)
      s.rect(bx, sy + (sh - 5 - (i % 3)), bw, 4 + (i % 3), colors[(shelf * 4 + i) % colors.length])
      bx += bw + 1
      if (bx > 28) break
    }
  }
  return s
}

function tableWoodLg(): Sprite { // 32×64 (2×4), desk, bg=1
  const s = new Sprite(32, 64)
  // Table top surface
  s.rect(1, 2, 30, 8, WL)
  s.border(0, 1, 32, 10, O)
  // Table front face + long body
  s.rect(1, 12, 30, 50, WM)
  s.border(0, 11, 32, 52, O)
  // Legs
  s.rect(2, 56, 3, 6, WD); s.rect(27, 56, 3, 6, WD)
  // Surface highlight
  s.hline(2, 3, 28, WX)
  return s
}

function chairCushionedRight(): Sprite { // 16×16, chair
  const s = new Sprite(16, 16)
  const p: Record<string, string> = { o: O, c: CD, l: CL, w: WD, m: WM }
  s.charMap([
    '................',
    '................',
    '...oooo.........',
    '...owwwo........',
    '...owwwo........',
    '...oooooooooo...',
    '....ollllllllo..',
    '....occcccccco..',
    '....occcccccco..',
    '....occcccccco..',
    '....ollllllllo..',
    '....oooooooooo..',
    '....o..o..o..o..',
    '....w..w..w..w..',
    '................',
    '................',
  ], p)
  return s
}

function chairCushionedLeft(): Sprite { // 16×16, chair (mirror of right)
  return chairCushionedRight().flipH()
}

function vendingMachine(): Sprite { // 32×32, bg=1
  const s = new Sprite(32, 32)
  // Body
  s.rect(2, 1, 28, 30, MD)
  s.border(1, 0, 30, 32, O)
  // Display window
  s.rect(4, 3, 16, 12, ML)
  s.border(3, 2, 18, 14, DG)
  // Snack rows
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const colors = [RM, BM, GM, OR]
      s.rect(5 + c * 4, 4 + r * 4, 3, 3, colors[(r + c) % 4])
    }
  }
  // Button panel
  s.rect(22, 4, 6, 10, DG)
  s.px(24, 6, RM); s.px(24, 9, GM); s.px(26, 6, BM)
  // Slot
  s.rect(10, 26, 12, 4, O)
  s.rect(11, 27, 10, 2, DG)
  return s
}

function fridge(): Sprite { // 16×32, bg=1
  const s = new Sprite(16, 32)
  s.rect(2, 1, 12, 30, W)
  s.border(1, 0, 14, 32, O)
  // Door line
  s.hline(2, 12, 12, MG)
  // Handle
  s.vline(12, 4, 6, DG)
  s.vline(12, 15, 8, DG)
  return s
}

function waterCooler(): Sprite { // 16×32, bg=1
  const s = new Sprite(16, 32)
  // Jug (top)
  s.rect(4, 1, 8, 10, BL)
  s.border(3, 0, 10, 12, O)
  s.rect(5, 2, 6, 3, '#90C8E8') // highlight
  // Body
  s.rect(3, 12, 10, 18, LG)
  s.border(2, 11, 12, 20, O)
  // Tap
  s.px(7, 14, RM); s.px(8, 14, RM)
  // Base
  s.rect(2, 28, 12, 3, MG)
  s.border(1, 27, 14, 4, O)
  return s
}

function bin(): Sprite { // 16×16
  const s = new Sprite(16, 16)
  s.rect(4, 4, 8, 10, MG)
  s.border(3, 3, 10, 12, O)
  // Rim
  s.hline(3, 3, 10, DG)
  // Tapered bottom
  s.px(4, 13, O); s.px(11, 13, O)
  // Trash peeking out
  s.px(6, 3, WM); s.px(9, 2, LG)
  return s
}

function stool(): Sprite { // 16×16, chair
  const s = new Sprite(16, 16)
  // Seat (round-ish)
  s.rect(4, 5, 8, 4, WL)
  s.border(3, 4, 10, 6, O)
  s.hline(5, 6, 6, WX) // highlight
  // Legs
  s.px(5, 10, WD); s.px(10, 10, WD)
  s.px(4, 11, WD); s.px(11, 11, WD)
  s.px(4, 12, O); s.px(11, 12, O)
  return s
}

function coffeeMug(): Sprite { // 16×16, surface
  const s = new Sprite(16, 16)
  // Mug body
  s.rect(5, 6, 6, 7, W)
  s.border(4, 5, 8, 9, O)
  // Handle
  s.px(12, 7, O); s.px(13, 8, O); s.px(13, 9, O); s.px(12, 10, O)
  // Coffee inside
  s.hline(5, 7, 6, '#6A4020')
  // Steam
  s.px(6, 3, LG); s.px(8, 2, LG); s.px(9, 4, LG)
  return s
}

function telephone(): Sprite { // 16×32, wall+surface, bg=1
  const s = new Sprite(16, 32)
  // Base unit (bottom tile)
  s.rect(2, 18, 12, 10, DG)
  s.border(1, 17, 14, 12, O)
  // Buttons
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      s.px(5 + c * 2, 20 + r * 2, LG)
  // Handset (top tile / background)
  s.rect(3, 4, 10, 5, MD)
  s.border(2, 3, 12, 7, O)
  s.rect(4, 5, 3, 3, DG) // earpiece
  s.rect(9, 5, 3, 3, DG) // mouthpiece
  // Cord
  s.px(7, 10, MG); s.px(8, 12, MG); s.px(7, 14, MG); s.px(8, 16, MG)
  return s
}

function bookSingleRed(): Sprite { // 16×16, surface
  const s = new Sprite(16, 16)
  s.rect(4, 5, 8, 8, RM)
  s.border(3, 4, 10, 10, O)
  s.rect(5, 4, 6, 1, RD) // spine
  s.hline(5, 8, 6, RD) // line on cover
  return s
}

function clockWallWhite(): Sprite { // 16×16
  const s = new Sprite(16, 16)
  // Clock face (circular-ish)
  s.rect(4, 3, 8, 8, WB)
  s.border(3, 2, 10, 10, O)
  s.px(3, 3, O); s.px(12, 3, O); s.px(3, 10, O); s.px(12, 10, O) // round corners
  s.px(3, 3, ''); s.px(12, 3, ''); s.px(3, 10, ''); s.px(12, 10, '') // clip corners
  // Hands
  s.px(7, 5, O); s.px(7, 6, O) // hour hand (up)
  s.px(8, 6, O); s.px(9, 6, O); s.px(10, 6, O) // minute hand (right)
  // Center dot
  s.px(7, 7, O); s.px(8, 7, O)
  // Hour markers
  s.px(7, 3, DG); s.px(11, 7, DG); s.px(7, 10, DG); s.px(4, 7, DG)
  return s
}

function clockWallColor(): Sprite { // 16×32, wall
  const s = new Sprite(16, 32)
  // Frame
  s.rect(2, 8, 12, 18, BM)
  s.border(1, 7, 14, 20, O)
  // Clock face
  s.rect(4, 10, 8, 8, WB)
  s.border(3, 9, 10, 10, O)
  // Hands
  s.px(7, 12, O); s.px(7, 13, O); s.px(8, 13, O); s.px(9, 13, O)
  s.px(7, 14, RM) // center dot
  // Pendulum area
  s.px(7, 20, YL); s.px(8, 20, YL)
  s.px(7, 22, OR); s.px(8, 22, OR)
  s.rect(6, 23, 4, 3, YL)
  s.border(6, 23, 4, 3, O)
  return s
}

function fullComputerCoffeeOff(): Sprite { // 32×32, surface, bg=1
  const s = new Sprite(32, 32)
  // Monitor (background tile zone)
  s.rect(4, 2, 18, 12, MD)
  s.border(3, 1, 20, 14, O)
  // Screen
  s.rect(5, 3, 16, 10, SD)
  // Monitor stand
  s.rect(10, 15, 6, 2, MG)
  s.rect(8, 17, 10, 1, DG)
  // Keyboard (blocking zone)
  s.rect(4, 20, 16, 4, LG)
  s.border(3, 19, 18, 6, O)
  // Key rows
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < 6; c++)
      s.px(5 + c * 2, 21 + r, MG)
  // Coffee mug (right side)
  s.rect(24, 22, 5, 6, W)
  s.border(23, 21, 7, 8, O)
  s.hline(24, 23, 5, '#6A4020')
  s.px(29, 24, O); s.px(30, 25, O); s.px(29, 26, O)
  return s
}

function laptopLeft(): Sprite { // 16×32, surface, bg=1
  const s = new Sprite(16, 32)
  // Screen (top/background)
  s.rect(2, 2, 12, 12, MD)
  s.border(1, 1, 14, 14, O)
  s.rect(3, 3, 10, 10, SD)
  // Hinge
  s.hline(2, 15, 12, DG)
  // Keyboard base (bottom/blocking)
  s.rect(1, 17, 14, 10, LG)
  s.border(0, 16, 16, 12, O)
  // Trackpad
  s.rect(5, 23, 6, 3, MG)
  // Keys
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 5; c++)
      s.px(3 + c * 2, 18 + r, MG)
  return s
}

function laptopBack(): Sprite { // 16×32, surface, bg=1
  const s = new Sprite(16, 32)
  // Back of screen (top/background)
  s.rect(2, 2, 12, 12, ML)
  s.border(1, 1, 14, 14, O)
  // Logo
  s.rect(6, 6, 4, 4, LG)
  // Hinge
  s.hline(2, 15, 12, DG)
  // Base visible from back
  s.rect(2, 17, 12, 8, MG)
  s.border(1, 16, 14, 10, O)
  return s
}

function paperSide(): Sprite { // 16×32, surface, bg=1
  const s = new Sprite(16, 32)
  // Stack of paper sheets
  for (let i = 0; i < 3; i++) {
    const y = 16 + i * 3
    s.rect(3 - i, y, 10 + i, 8 - i, W)
    s.border(2 - i, y - 1, 12 + i, 10 - i, O)
  }
  // Lines on top sheet
  for (let l = 0; l < 3; l++) s.hline(4, 18 + l * 2, 6, LG)
  return s
}

function paintingLandscape(): Sprite { // 32×32, wall
  const s = new Sprite(32, 32)
  // Frame
  s.rect(1, 1, 30, 30, WM)
  s.border(0, 0, 32, 32, O)
  s.border(2, 2, 28, 28, WD)
  // Canvas
  s.rect(3, 3, 26, 26, '#87CEEB') // sky
  s.rect(3, 16, 26, 13, GM) // grass
  // Mountains
  for (let i = 0; i < 10; i++) {
    const h = 6 + (i < 5 ? i : 9 - i)
    s.px(8 + i, 16 - h + 4, MG)
    for (let y = 16 - h + 5; y < 16; y++) s.px(8 + i, y, MG)
  }
  // Sun
  s.px(24, 6, YL); s.px(25, 6, YL); s.px(24, 7, YL); s.px(25, 7, YL)
  // Trees
  s.rect(5, 13, 3, 3, GD); s.px(6, 12, GD)
  s.px(6, 16, WD); s.px(6, 17, WD)
  return s
}

function paintingLandscape2(): Sprite { // 32×32, wall
  const s = new Sprite(32, 32)
  // Frame
  s.rect(1, 1, 30, 30, WD)
  s.border(0, 0, 32, 32, O)
  s.border(2, 2, 28, 28, WM)
  // Canvas — sunset scene
  s.rect(3, 3, 26, 14, OR) // sunset sky
  s.rect(3, 10, 26, 4, '#E08050') // horizon glow
  s.rect(3, 14, 26, 15, BD) // water
  // Sun setting
  s.rect(13, 8, 6, 3, YL)
  s.rect(14, 7, 4, 1, YL)
  // Reflection
  s.px(15, 15, YL); s.px(16, 16, YL); s.px(15, 17, YL); s.px(16, 18, YL)
  return s
}

function server(): Sprite { // 16×32, surface, bg=1
  const s = new Sprite(16, 32)
  // Rack unit
  s.rect(2, 2, 12, 28, MD)
  s.border(1, 1, 14, 30, O)
  // Front panels
  for (let p = 0; p < 4; p++) {
    const py = 3 + p * 7
    s.rect(3, py, 10, 5, DG)
    s.border(3, py, 10, 5, MM)
    // Status lights
    s.px(4, py + 1, GM); s.px(6, py + 1, GM)
    // Vents
    s.hline(4, py + 3, 8, MM)
  }
  return s
}

function crates3(): Sprite { // 32×32, bg=1
  const s = new Sprite(32, 32)
  // Bottom crates (2 side by side)
  s.rect(1, 16, 14, 14, WM); s.border(0, 15, 16, 16, O)
  s.rect(17, 16, 14, 14, WL); s.border(16, 15, 16, 16, O)
  // Cross marks
  s.px(4, 20, WD); s.px(5, 21, WD); s.px(6, 22, WD); s.px(6, 20, WD); s.px(5, 21, WD); s.px(4, 22, WD)
  s.px(20, 20, WD); s.px(21, 21, WD); s.px(22, 22, WD); s.px(22, 20, WD); s.px(21, 21, WD); s.px(20, 22, WD)
  // Top crate (centered on top)
  s.rect(5, 2, 14, 12, WX)
  s.border(4, 1, 16, 14, O)
  s.px(9, 5, WD); s.px(10, 6, WD); s.px(11, 7, WD); s.px(11, 5, WD); s.px(10, 6, WD); s.px(9, 7, WD)
  return s
}

function makePlant(leafDark: string, leafMed: string, leafLight: string, style: number): Sprite {
  const s = new Sprite(16, 32)
  // Pot (lower area)
  s.rect(4, 24, 8, 6, PM)
  s.border(3, 23, 10, 8, O)
  s.hline(3, 23, 10, PD) // rim
  s.rect(5, 24, 6, 1, PD) // rim highlight

  // Leaves — varies by style
  if (style === 0) {
    // Small bushy
    s.rect(5, 14, 6, 9, leafMed)
    s.rect(4, 16, 8, 5, leafMed)
    s.rect(6, 13, 4, 2, leafLight)
    s.border(3, 12, 10, 11, O)
    s.px(3, 12, ''); s.px(12, 12, ''); s.px(3, 22, ''); s.px(12, 22, '') // round
  } else if (style === 1) {
    // Tall leafy
    s.rect(6, 8, 4, 15, leafMed)
    s.rect(3, 12, 10, 8, leafMed)
    s.rect(5, 10, 6, 4, leafLight)
    s.border(2, 7, 12, 16, O)
    s.px(2, 7, ''); s.px(13, 7, ''); s.px(2, 22, ''); s.px(13, 22, '')
    // Individual leaves
    s.px(4, 9, leafDark); s.px(11, 11, leafDark)
    s.px(3, 14, leafLight); s.px(12, 16, leafLight)
  } else if (style === 2) {
    // Round bush (like style 0 but slightly different)
    s.rect(4, 13, 8, 10, leafMed)
    s.rect(5, 12, 6, 2, leafLight)
    s.rect(3, 15, 10, 6, leafMed)
    s.border(2, 11, 12, 12, O)
    s.px(5, 14, leafDark); s.px(9, 17, leafDark); s.px(7, 13, leafLight)
  } else {
    // Tall with droopy leaves
    s.rect(6, 6, 4, 17, leafMed)
    s.rect(4, 10, 8, 8, leafMed)
    s.rect(3, 12, 3, 5, leafLight)  // left droop
    s.rect(10, 13, 3, 4, leafLight) // right droop
    s.border(2, 5, 12, 18, O)
    s.px(2, 5, ''); s.px(13, 5, '')
    s.px(7, 6, leafLight); s.px(8, 7, leafDark)
  }
  return s
}

function whitePlant2(): Sprite { return makePlant('#508848', '#70A860', '#90C880', 0) }
function whitePlant3(): Sprite { return makePlant('#508848', '#70A860', '#90C880', 1) }
function plant2(): Sprite { return makePlant(GD, GM, GL, 2) }
function plant3(): Sprite { return makePlant(GD, GM, GL, 3) }

function tableWood(): Sprite { // 48×32, 3×2, desk, bg=1
  const s = new Sprite(48, 32)
  // Surface top
  s.rect(1, 2, 46, 8, WL)
  s.border(0, 1, 48, 10, O)
  s.hline(2, 3, 44, WX) // highlight
  // Front face
  s.rect(1, 12, 46, 18, WM)
  s.border(0, 11, 48, 20, O)
  // Legs
  s.rect(2, 26, 3, 5, WD); s.rect(43, 26, 3, 5, WD)
  return s
}

function chairCushionedLgRight(): Sprite { // 16×32, chair, bg=0
  const s = new Sprite(16, 32)
  const p: Record<string, string> = { o: O, c: CD, l: CL, w: WD, m: WM, g: MG }
  s.charMap([
    '................',
    '................',
    '................',
    '...ooooo........',
    '...ommmmo.......',
    '...owwwwo.......',
    '...owwwwo.......',
    '...ooooooooooo..',
    '....olllllllllo.',
    '....occccccccco.',
    '....occccccccco.',
    '....occccccccco.',
    '....occccccccco.',
    '....olllllllllo.',
    '....ooooooooooo.',
    '................',
    '....ollllllllo..',
    '....occccccccco.',
    '....occccccccco.',
    '....occccccccco.',
    '....occccccccco.',
    '....occccccccco.',
    '....ollllllllo..',
    '....ooooooooooo.',
    '....o..o....o...',
    '....w..w....w...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ], p)
  return s
}

function chairCushionedLgLeft(): Sprite { return chairCushionedLgRight().flipH() }

function coffeeTableLg(): Sprite { // 32×32, 2×2, desk, bg=1
  const s = new Sprite(32, 32)
  // Surface (low table)
  s.rect(1, 6, 30, 6, WL)
  s.border(0, 5, 32, 8, O)
  s.hline(2, 7, 28, WX)
  // Short legs + lower shelf
  s.rect(2, 14, 28, 4, WM)
  s.border(1, 13, 30, 6, O)
  // Legs
  s.rect(2, 19, 2, 10, WD); s.rect(28, 19, 2, 10, WD)
  s.px(2, 28, O); s.px(3, 28, O); s.px(28, 28, O); s.px(29, 28, O)
  return s
}

// ── Asset definition registry ────────────────────────────────

interface AssetDef {
  id: string
  name: string
  label: string
  category: string
  footprintW: number
  footprintH: number
  isDesk: boolean
  canPlaceOnWalls?: boolean
  canPlaceOnSurfaces?: boolean
  backgroundTiles?: number
  groupId?: string
  orientation?: string
  state?: string
  build: () => Sprite
}

const ASSETS: AssetDef[] = [
  // ── Desks ──
  { id: 'ASSET_7', name: 'COUNTER_WHITE_SM', label: 'Small White Counter', category: 'desks',
    footprintW: 2, footprintH: 2, isDesk: true, backgroundTiles: 1, build: counterWhiteSm },
  { id: 'ASSET_27_A', name: 'TABLE_WOOD_LG', label: 'Large Table', category: 'desks',
    footprintW: 2, footprintH: 4, isDesk: true, backgroundTiles: 1, groupId: 'TABLE_LG', orientation: 'front', build: tableWoodLg },
  { id: 'ASSET_NEW_106', name: 'TABLE_WOOD', label: 'Wooden Table', category: 'desks',
    footprintW: 3, footprintH: 2, isDesk: true, backgroundTiles: 1, build: tableWood },
  { id: 'ASSET_NEW_112', name: 'COFFEE_TABLE_LG', label: 'Large Coffee Table', category: 'desks',
    footprintW: 2, footprintH: 2, isDesk: true, backgroundTiles: 1, build: coffeeTableLg },

  // ── Chairs ──
  { id: 'ASSET_33', name: 'CHAIR_CUSHIONED_RIGHT', label: 'Cushioned Chair - Right', category: 'chairs',
    footprintW: 1, footprintH: 1, isDesk: false, groupId: 'CUSHIONED_CHAIR', build: chairCushionedRight },
  { id: 'ASSET_34', name: 'CHAIR_CUSHIONED_LEFT', label: 'Cushioned Chair - Left', category: 'chairs',
    footprintW: 1, footprintH: 1, isDesk: false, groupId: 'CUSHIONED_CHAIR', build: chairCushionedLeft },
  { id: 'ASSET_49', name: 'STOOL', label: 'Small Wooden Stool', category: 'chairs',
    footprintW: 1, footprintH: 1, isDesk: false, build: stool },
  { id: 'ASSET_NEW_110', name: 'CHAIR_CUSHIONED_LG_RIGHT', label: 'Large Cushioned Chair', category: 'chairs',
    footprintW: 1, footprintH: 2, isDesk: false, backgroundTiles: 0, groupId: 'CUSHIONED_CHAIR_LG', orientation: 'right', build: chairCushionedLgRight },
  { id: 'ASSET_NEW_111', name: 'CHAIR_CUSHIONED_LG_LEFT', label: 'Large Cushioned Chair', category: 'chairs',
    footprintW: 1, footprintH: 2, isDesk: false, backgroundTiles: 0, groupId: 'CUSHIONED_CHAIR_LG', orientation: 'left', build: chairCushionedLgLeft },

  // ── Storage ──
  { id: 'ASSET_17', name: 'WOODEN_BOOKSHELF_SMALL', label: 'Small Wooden Bookshelf', category: 'storage',
    footprintW: 2, footprintH: 2, isDesk: false, backgroundTiles: 1, build: woodenBookshelfSmall },
  { id: 'ASSET_18', name: 'FULL_WOODEN_BOOKSHELF_SMALL', label: 'Full Small Wooden Bookshelf', category: 'storage',
    footprintW: 2, footprintH: 2, isDesk: false, backgroundTiles: 1, build: fullWoodenBookshelfSmall },
  { id: 'ASSET_41_0_1', name: 'FRIDGE', label: 'Fridge', category: 'storage',
    footprintW: 1, footprintH: 2, isDesk: false, backgroundTiles: 1, build: fridge },
  { id: 'ASSET_139', name: 'CRATES_3', label: 'Crates', category: 'storage',
    footprintW: 2, footprintH: 2, isDesk: false, backgroundTiles: 1, build: crates3 },

  // ── Electronics ──
  { id: 'ASSET_61', name: 'TELEPHONE', label: 'Telephone', category: 'electronics',
    footprintW: 1, footprintH: 2, isDesk: false, canPlaceOnWalls: true, canPlaceOnSurfaces: true, backgroundTiles: 1, build: telephone },
  { id: 'ASSET_90', name: 'FULL_COMPUTER_COFFEE_OFF', label: 'Full Computer with Coffee', category: 'electronics',
    footprintW: 2, footprintH: 2, isDesk: false, canPlaceOnSurfaces: true, backgroundTiles: 1, groupId: 'FULL_COMPUTER_COFFEE', orientation: 'front', build: fullComputerCoffeeOff },
  { id: 'ASSET_99', name: 'LAPTOP_LEFT', label: 'Laptop - Left', category: 'electronics',
    footprintW: 1, footprintH: 2, isDesk: false, canPlaceOnSurfaces: true, backgroundTiles: 1, groupId: 'LAPTOP', orientation: 'left', build: laptopLeft },
  { id: 'ASSET_109', name: 'LAPTOP_BACK', label: 'Laptop - Back', category: 'electronics',
    footprintW: 1, footprintH: 2, isDesk: false, canPlaceOnSurfaces: true, backgroundTiles: 1, groupId: 'LAPTOP', orientation: 'back', build: laptopBack },
  { id: 'ASSET_123', name: 'SERVER', label: 'Server', category: 'electronics',
    footprintW: 1, footprintH: 2, isDesk: false, canPlaceOnSurfaces: true, backgroundTiles: 1, build: server },

  // ── Decor ──
  { id: 'ASSET_72', name: 'BOOK_SINGLE_RED', label: 'Small Book', category: 'decor',
    footprintW: 1, footprintH: 1, isDesk: false, canPlaceOnSurfaces: true, build: bookSingleRed },
  { id: 'ASSET_83', name: 'CLOCK_WALL_WHITE', label: 'White Wall Clock', category: 'decor',
    footprintW: 1, footprintH: 1, isDesk: false, backgroundTiles: 0, build: clockWallWhite },
  { id: 'ASSET_100', name: 'PAPER_SIDE', label: 'Paper - Side', category: 'decor',
    footprintW: 1, footprintH: 2, isDesk: false, canPlaceOnSurfaces: true, backgroundTiles: 1, groupId: 'PAPER', orientation: 'front', build: paperSide },
  { id: 'ASSET_140', name: 'WHITE_PLANT_2', label: 'Plant', category: 'decor',
    footprintW: 1, footprintH: 2, isDesk: false, backgroundTiles: 1, groupId: 'WHITE_PLANT', build: whitePlant2 },
  { id: 'ASSET_141', name: 'WHITE_PLANT_3', label: 'Plant', category: 'decor',
    footprintW: 1, footprintH: 2, isDesk: false, backgroundTiles: 1, groupId: 'WHITE_PLANT', build: whitePlant3 },
  { id: 'ASSET_142', name: 'PLANT_2', label: 'Plant', category: 'decor',
    footprintW: 1, footprintH: 2, isDesk: false, backgroundTiles: 1, groupId: 'WHITE_PLANT', build: plant2 },
  { id: 'ASSET_143', name: 'PLANT_3', label: 'Plant', category: 'decor',
    footprintW: 1, footprintH: 2, isDesk: false, backgroundTiles: 1, groupId: 'WHITE_PLANT', build: plant3 },

  // ── Wall ──
  { id: 'ASSET_84', name: 'CLOCK_WALL_COLOR', label: 'Colorful Wall Clock', category: 'wall',
    footprintW: 1, footprintH: 2, isDesk: false, canPlaceOnWalls: true, backgroundTiles: 0, build: clockWallColor },
  { id: 'ASSET_101', name: 'PAINTING_LANDSCAPE', label: 'Landscape Painting', category: 'wall',
    footprintW: 2, footprintH: 2, isDesk: false, canPlaceOnWalls: true, backgroundTiles: 0, build: paintingLandscape },
  { id: 'ASSET_102', name: 'PAINTING_LANDSCAPE_2', label: 'Landscape Painting', category: 'wall',
    footprintW: 2, footprintH: 2, isDesk: false, canPlaceOnWalls: true, backgroundTiles: 0, build: paintingLandscape2 },

  // ── Misc ──
  { id: 'ASSET_40', name: 'VENDING_MACHINE', label: 'Snack Vending Machine', category: 'misc',
    footprintW: 2, footprintH: 2, isDesk: false, backgroundTiles: 1, build: vendingMachine },
  { id: 'ASSET_42', name: 'WATER_COOLER', label: 'Water Cooler', category: 'misc',
    footprintW: 1, footprintH: 2, isDesk: false, backgroundTiles: 1, build: waterCooler },
  { id: 'ASSET_44', name: 'BIN', label: 'Trash Bin', category: 'misc',
    footprintW: 1, footprintH: 1, isDesk: false, backgroundTiles: 0, build: bin },
  { id: 'ASSET_51', name: 'COFFEE_MUG', label: 'Coffee Mug', category: 'misc',
    footprintW: 1, footprintH: 1, isDesk: false, canPlaceOnSurfaces: true, backgroundTiles: 0, build: coffeeMug },
]

// ── Floor pattern generation ─────────────────────────────────

function generateFloors(): Sprite {
  const TILE = 16
  const COUNT = 7
  const s = new Sprite(TILE * COUNT, TILE)

  for (let t = 0; t < COUNT; t++) {
    const ox = t * TILE
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        let v: number // grayscale value 0–255
        switch (t) {
          case 0: // Plain
            v = 180
            break
          case 1: // Checkerboard
            v = ((x >> 2) + (y >> 2)) % 2 === 0 ? 190 : 160
            break
          case 2: // Small tiles (4×4 grid with grout)
            v = (x % 4 === 0 || y % 4 === 0) ? 140 : 185
            break
          case 3: // Diagonal stripes
            v = (x + y) % 6 < 3 ? 190 : 155
            break
          case 4: // Wood planks (horizontal)
            if (y % 8 === 0) v = 140 // plank gap
            else if (y % 4 === 0 && x % 8 < 2) v = 140 // stagger seam
            else v = 170 + ((x * 3 + y * 7) % 20) // wood grain variation
            break
          case 5: // Stone/cobblestone
            { const cx = (x + (y > 7 ? 4 : 0)) % 8
              v = (cx === 0 || y % 8 === 0) ? 140 : 175 + ((x * 5 + y * 3) % 15) }
            break
          case 6: // Herringbone
            { const blockX = Math.floor(x / 4)
              const blockY = Math.floor(y / 4)
              const inner = ((blockX + blockY) % 2 === 0) ? (x % 4) : (y % 4)
              v = inner === 0 ? 145 : 180 }
            break
          default:
            v = 180
        }
        const hex = v.toString(16).padStart(2, '0')
        s.px(ox + x, y, `#${hex}${hex}${hex}`)
      }
    }
  }
  return s
}

// ── Main ─────────────────────────────────────────────────────

function main() {
  const baseDir = path.resolve(import.meta.dirname, '..', 'webview-ui', 'public', 'assets')
  const furnitureDir = path.join(baseDir, 'furniture')

  // Create category subdirectories
  const categories = ['desks', 'chairs', 'storage', 'electronics', 'decor', 'wall', 'misc']
  for (const cat of categories) {
    fs.mkdirSync(path.join(furnitureDir, cat), { recursive: true })
  }

  console.log('Generating furniture assets...')

  // Build catalog entries + write PNGs
  interface CatalogAsset {
    id: string; name: string; label: string; category: string; file: string
    width: number; height: number; footprintW: number; footprintH: number
    isDesk: boolean; canPlaceOnWalls?: boolean; canPlaceOnSurfaces?: boolean
    backgroundTiles?: number; groupId?: string; orientation?: string; state?: string
  }
  const catalogAssets: CatalogAsset[] = []

  for (const def of ASSETS) {
    const sprite = def.build()
    const relFile = `furniture/${def.category}/${def.name}.png`
    const absFile = path.join(baseDir, relFile)

    fs.writeFileSync(absFile, sprite.toPNG())

    const entry: CatalogAsset = {
      id: def.id,
      name: def.name,
      label: def.label,
      category: def.category,
      file: relFile,
      width: sprite.w,
      height: sprite.h,
      footprintW: def.footprintW,
      footprintH: def.footprintH,
      isDesk: def.isDesk,
    }
    if (def.canPlaceOnWalls) entry.canPlaceOnWalls = true
    if (def.canPlaceOnSurfaces) entry.canPlaceOnSurfaces = true
    if (def.backgroundTiles !== undefined) entry.backgroundTiles = def.backgroundTiles
    if (def.groupId) entry.groupId = def.groupId
    if (def.orientation) entry.orientation = def.orientation
    if (def.state) entry.state = def.state

    catalogAssets.push(entry)
    console.log(`  ✓ ${def.id} (${def.name}) — ${sprite.w}×${sprite.h}`)
  }

  // Write catalog JSON
  const catalog = {
    version: 1,
    timestamp: new Date().toISOString(),
    totalAssets: catalogAssets.length,
    categories,
    assets: catalogAssets,
  }
  const catalogPath = path.join(furnitureDir, 'furniture-catalog.json')
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2))
  console.log(`\nWrote furniture-catalog.json (${catalogAssets.length} assets)`)

  // ── Generate floors.png ──
  console.log('\nGenerating floors.png...')
  const floors = generateFloors()
  fs.writeFileSync(path.join(baseDir, 'floors.png'), floors.toPNG())
  console.log(`  ✓ floors.png (${floors.w}×${floors.h})`)

  console.log('\n✅ All assets generated!')
}

main()
