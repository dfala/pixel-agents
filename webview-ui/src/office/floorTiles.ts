/**
 * Floor tile pattern storage and caching.
 *
 * Stores 8 grayscale floor patterns loaded from floors.png.
 * Uses shared colorize module for HSL tinting (Photoshop-style Colorize).
 * Caches colorized SpriteData by (pattern, h, s, b, c) key.
 *
 * TileType values: FLOOR_1-7 = 1-7, VOID = 8, FLOOR_8 = 9.
 * The VOID gap is handled by tileToSpriteIndex().
 */

import { TileType } from './types.js'
import type { SpriteData, FloorColor } from './types.js'
import { getColorizedSprite, clearColorizeCache } from './colorize.js'
import { TILE_SIZE, FALLBACK_FLOOR_COLOR } from '../constants.js'

/** Ordered list of floor tile type values (for editor palette iteration) */
const FLOOR_TILE_VALUES = [
  TileType.FLOOR_1, TileType.FLOOR_2, TileType.FLOOR_3, TileType.FLOOR_4,
  TileType.FLOOR_5, TileType.FLOOR_6, TileType.FLOOR_7, TileType.FLOOR_8,
] as const

/** Default solid gray 16×16 tile used when floors.png is not loaded */
const DEFAULT_FLOOR_SPRITE: SpriteData = Array.from(
  { length: TILE_SIZE },
  () => Array(TILE_SIZE).fill(FALLBACK_FLOOR_COLOR) as string[],
)

/** Module-level storage for floor tile sprites (set once on load) */
let floorSprites: SpriteData[] = []

/** Wall color constant */
export const WALL_COLOR = '#3A3A5C'

/** Set floor tile sprites (called once when extension sends floorTilesLoaded) */
export function setFloorSprites(sprites: SpriteData[]): void {
  floorSprites = sprites
  clearColorizeCache()
}

/** Map tile type value to floor sprite array index.
 *  FLOOR_1-7 (values 1-7) → indices 0-6, FLOOR_8 (value 9, skipping VOID=8) → index 7. */
function tileToSpriteIndex(tileValue: number): number {
  if (tileValue <= 7) return tileValue - 1
  // Values above VOID (8): subtract 2 to account for the gap
  return tileValue - 2
}

/** Get the raw (grayscale) floor sprite for a tile type value.
 *  Falls back to the default solid gray tile when floors.png is not loaded. */
export function getFloorSprite(patternIndex: number): SpriteData | null {
  const idx = tileToSpriteIndex(patternIndex)
  if (idx < 0) return null
  if (idx < floorSprites.length) return floorSprites[idx]
  // No PNG sprites loaded — return default solid tile for any valid pattern index
  if (floorSprites.length === 0 && patternIndex >= 1) return DEFAULT_FLOOR_SPRITE
  return null
}

/** Check if floor sprites are available (always true — falls back to default solid tile) */
export function hasFloorSprites(): boolean {
  return true
}

/** Get count of available floor patterns (at least 1 for the default solid tile) */
export function getFloorPatternCount(): number {
  return floorSprites.length > 0 ? floorSprites.length : 1
}

/** Get the ordered list of floor tile type values (for editor palette) */
export function getFloorTileValues(): readonly number[] {
  return FLOOR_TILE_VALUES
}

/** Get all floor sprites (for preview rendering, falls back to default solid tile) */
export function getAllFloorSprites(): SpriteData[] {
  return floorSprites.length > 0 ? floorSprites : [DEFAULT_FLOOR_SPRITE]
}

/**
 * Get a colorized version of a floor sprite.
 * Uses Photoshop-style Colorize: grayscale -> HSL with given hue/saturation,
 * then brightness/contrast adjustment.
 */
export function getColorizedFloorSprite(patternIndex: number, color: FloorColor): SpriteData {
  const key = `floor-${patternIndex}-${color.h}-${color.s}-${color.b}-${color.c}`

  const base = getFloorSprite(patternIndex)
  if (!base) {
    // Return a 16x16 magenta error tile
    const err: SpriteData = Array.from({ length: 16 }, () => Array(16).fill('#FF00FF'))
    return err
  }

  // Floor tiles are always colorized (grayscale patterns need Photoshop-style Colorize)
  return getColorizedSprite(key, base, { ...color, colorize: true })
}
