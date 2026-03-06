/**
 * Procedural pixel art sprites for the office pet (raccoon).
 *
 * Raccoon is 10×10 pixels per frame (smaller than 16×32 characters).
 * 4 directions: down (front), up (back), right (side). Left = flipped right.
 * Frames: walk1, walk2, idle (sit), sleep (curled), play (pounce)
 *
 * Key visual features:
 *  - Dark mask band across the eyes (THE defining raccoon trait)
 *  - White forehead + snout contrasting with mask
 *  - Gray body, lighter belly
 *  - Dark ear tips
 *  - Striped tail (alternating dark/gray rings)
 */

import type { SpriteData, Direction } from '../types.js'
import { Direction as Dir } from '../types.js'

const _ = '' // transparent

// ── Raccoon Colors ──────────────────────────────────────────────
const G = '#808890' // gray body
const D = '#2A2E38' // dark charcoal (mask, ear tips, tail rings)
const L = '#A0A8B0' // light gray (belly, chest)
const W = '#D8D8D8' // white (face, snout)
const E = '#1A1A1A' // eyes
const N = '#2D2D2D' // nose

// ── DOWN-FACING (front view) ────────────────────────────────────

const RACCOON_WALK_DOWN_1: SpriteData = [
  [_, _, D, G, G, G, G, D, _, _],
  [_, G, G, W, W, W, W, G, G, _],
  [_, G, D, E, W, W, E, D, G, _],
  [_, _, G, W, N, N, W, G, _, _],
  [_, _, G, L, G, G, L, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, L, L, G, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, _, G, G, _, G, _, _],
  [_, _, G, _, _, _, _, G, _, _],
]

const RACCOON_WALK_DOWN_2: SpriteData = [
  [_, _, D, G, G, G, G, D, _, _],
  [_, G, G, W, W, W, W, G, G, _],
  [_, G, D, E, W, W, E, D, G, _],
  [_, _, G, W, N, N, W, G, _, _],
  [_, _, G, L, G, G, L, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, L, L, G, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, _, G, G, G, G, _, _, _],
  [_, _, _, G, _, _, G, _, _, _],
]

const RACCOON_IDLE_DOWN: SpriteData = [
  [_, _, D, G, G, G, G, D, _, _],
  [_, G, G, W, W, W, W, G, G, _],
  [_, G, D, E, W, W, E, D, G, _],
  [_, _, G, W, N, N, W, G, _, _],
  [_, _, G, L, G, G, L, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, L, L, G, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, _, G, G, G, G, _, _, _],
  [_, _, _, _, _, _, _, _, _, _],
]

const RACCOON_SLEEP_DOWN: SpriteData = [
  [_, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, G, D, E, W, W, E, D, G, _],
  [_, G, G, G, N, G, G, G, G, _],
  [_, _, G, G, G, G, G, G, D, _],
  [_, _, G, L, L, L, L, G, G, _],
  [_, _, _, G, G, G, G, D, _, _],
]

const RACCOON_PLAY_DOWN: SpriteData = [
  [_, _, D, G, G, G, _, _, _, _],
  [_, G, G, W, W, W, G, _, _, _],
  [_, G, D, E, W, E, D, G, _, _],
  [_, G, G, W, N, W, G, G, _, _],
  [_, _, G, L, G, G, L, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, G, _, G, L, L, G, _, G, _],
  [_, G, _, _, _, _, _, _, G, _],
  [_, _, _, _, _, _, _, _, _, _],
]

// ── UP-FACING (back view) ───────────────────────────────────────

const RACCOON_WALK_UP_1: SpriteData = [
  [_, _, D, G, G, G, G, D, _, _],
  [_, _, G, D, G, G, D, G, _, _],
  [_, G, G, G, G, G, G, G, G, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, D, G, G, D, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, _, G, G, _, G, _, _],
  [_, _, G, _, _, _, _, G, _, _],
]

const RACCOON_WALK_UP_2: SpriteData = [
  [_, _, D, G, G, G, G, D, _, _],
  [_, _, G, D, G, G, D, G, _, _],
  [_, G, G, G, G, G, G, G, G, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, D, G, G, D, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, _, G, G, G, G, _, _, _],
  [_, _, _, G, _, _, G, _, _, _],
]

const RACCOON_IDLE_UP: SpriteData = [
  [_, _, D, G, G, G, G, D, _, _],
  [_, _, G, D, G, G, D, G, _, _],
  [_, G, G, G, G, G, G, G, G, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, D, G, G, D, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, _, G, G, G, G, _, _, _],
  [_, _, _, _, _, _, _, _, _, _],
]

const RACCOON_SLEEP_UP: SpriteData = [
  [_, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, G, D, G, G, G, G, D, G, _],
  [_, G, G, G, G, G, G, G, G, _],
  [_, _, G, G, G, G, G, G, D, _],
  [_, _, G, D, G, G, D, G, G, _],
  [_, _, _, G, G, G, G, D, _, _],
]

const RACCOON_PLAY_UP: SpriteData = [
  [_, _, D, G, G, G, G, D, _, _],
  [_, _, G, D, G, G, D, G, _, _],
  [_, G, G, G, G, G, G, G, G, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, D, G, G, D, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, G, _, G, G, G, G, _, G, _],
  [_, G, _, _, _, _, _, _, G, _],
  [_, _, _, _, _, _, _, _, _, _],
]

// ── RIGHT-FACING (side profile) ─────────────────────────────────

const RACCOON_WALK_RIGHT_1: SpriteData = [
  [_, _, _, _, G, D, _, _, _, _],
  [_, _, _, G, G, G, G, _, _, _],
  [_, _, _, D, D, E, W, _, _, _],
  [_, _, _, G, W, N, _, _, _, _],
  [_, _, _, G, G, G, G, _, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, G, G, G, G, D, _],
  [_, _, G, G, G, G, G, G, G, _],
  [_, _, _, G, _, _, G, _, D, _],
  [_, _, _, G, _, _, G, _, _, _],
]

const RACCOON_WALK_RIGHT_2: SpriteData = [
  [_, _, _, _, G, D, _, _, _, _],
  [_, _, _, G, G, G, G, _, _, _],
  [_, _, _, D, D, E, W, _, _, _],
  [_, _, _, G, W, N, _, _, _, _],
  [_, _, _, G, G, G, G, _, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, G, G, G, G, D, _],
  [_, _, G, G, G, G, G, G, G, _],
  [_, _, G, _, _, _, _, G, D, _],
  [_, _, G, _, _, _, _, G, _, _],
]

const RACCOON_IDLE_RIGHT: SpriteData = [
  [_, _, _, _, G, D, _, _, _, _],
  [_, _, _, G, G, G, G, _, _, _],
  [_, _, _, D, D, E, W, _, _, _],
  [_, _, _, G, W, N, _, _, _, _],
  [_, _, _, G, G, G, G, _, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, _, G, G, G, G, _, _, _],
  [_, _, _, _, _, _, _, _, D, _],
]

const RACCOON_SLEEP_RIGHT: SpriteData = [
  [_, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _],
  [_, _, _, G, D, _, _, _, _, _],
  [_, _, G, D, E, W, _, _, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, _, G, G, G, G, G, D, _],
  [_, _, _, _, G, G, G, D, _, _],
]

const RACCOON_PLAY_RIGHT: SpriteData = [
  [_, _, _, _, G, D, _, _, _, _],
  [_, _, _, G, G, G, G, _, _, _],
  [_, _, _, D, D, E, W, _, _, _],
  [_, _, _, G, W, N, _, _, _, _],
  [_, _, G, G, G, G, G, _, _, _],
  [_, _, G, G, G, G, G, G, _, _],
  [_, _, _, G, G, G, G, G, _, _],
  [_, G, _, G, G, G, G, _, G, _],
  [_, G, _, _, _, _, _, _, G, _],
  [_, _, _, _, _, _, _, _, _, _],
]

// ── ZZZ bubble sprite (tiny) ────────────────────────────────────

const Z = '#AACCFF'
export const PET_SLEEP_BUBBLE: SpriteData = [
  [_, _, _, _, _, Z, _],
  [_, _, _, _, Z, _, _],
  [_, _, Z, Z, _, _, _],
  [_, _, _, Z, _, _, _],
  [_, Z, Z, _, _, _, _],
  [_, _, Z, _, _, _, _],
]

// ── Sprite flipping ─────────────────────────────────────────────

function flipH(sprite: SpriteData): SpriteData {
  return sprite.map((row) => [...row].reverse())
}

// ── Exported sprite set interface ───────────────────────────────

export interface PetSprites {
  walk: Record<Direction, [SpriteData, SpriteData]>
  idle: Record<Direction, SpriteData>
  sleep: Record<Direction, SpriteData>
  play: Record<Direction, SpriteData>
}

export function getPetSprites(): PetSprites {
  return {
    walk: {
      [Dir.DOWN]: [RACCOON_WALK_DOWN_1, RACCOON_WALK_DOWN_2],
      [Dir.UP]: [RACCOON_WALK_UP_1, RACCOON_WALK_UP_2],
      [Dir.RIGHT]: [RACCOON_WALK_RIGHT_1, RACCOON_WALK_RIGHT_2],
      [Dir.LEFT]: [flipH(RACCOON_WALK_RIGHT_1), flipH(RACCOON_WALK_RIGHT_2)],
    },
    idle: {
      [Dir.DOWN]: RACCOON_IDLE_DOWN,
      [Dir.UP]: RACCOON_IDLE_UP,
      [Dir.RIGHT]: RACCOON_IDLE_RIGHT,
      [Dir.LEFT]: flipH(RACCOON_IDLE_RIGHT),
    },
    sleep: {
      [Dir.DOWN]: RACCOON_SLEEP_DOWN,
      [Dir.UP]: RACCOON_SLEEP_UP,
      [Dir.RIGHT]: RACCOON_SLEEP_RIGHT,
      [Dir.LEFT]: flipH(RACCOON_SLEEP_RIGHT),
    },
    play: {
      [Dir.DOWN]: RACCOON_PLAY_DOWN,
      [Dir.UP]: RACCOON_PLAY_UP,
      [Dir.RIGHT]: RACCOON_PLAY_RIGHT,
      [Dir.LEFT]: flipH(RACCOON_PLAY_RIGHT),
    },
  }
}
