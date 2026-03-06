/**
 * Pet companion FSM — a cat that wanders the office, follows agents,
 * sleeps near warm electronics, and occasionally gets the zoomies.
 */

import { Direction, TILE_SIZE } from '../types.js'
import type { Character, SpriteData, TileType as TileTypeVal } from '../types.js'
import type { PetSprites } from '../sprites/petSprites.js'
import { findPath } from '../layout/tileMap.js'
import {
  PET_WALK_SPEED_PX_PER_SEC,
  PET_WALK_FRAME_DURATION_SEC,
  PET_WANDER_PAUSE_MIN_SEC,
  PET_WANDER_PAUSE_MAX_SEC,
  PET_WANDER_MOVES_BEFORE_CHANGE,
  PET_FOLLOW_DISTANCE_TILES,
  PET_FOLLOW_REPATH_SEC,
  PET_FOLLOW_DURATION_MIN_SEC,
  PET_FOLLOW_DURATION_MAX_SEC,
  PET_SLEEP_DURATION_MIN_SEC,
  PET_SLEEP_DURATION_MAX_SEC,
  PET_PLAY_DURATION_SEC,
  PET_PLAY_SPEED_PX_PER_SEC,
  PET_WAKE_DURATION_SEC,
} from '../../constants.js'

// ── Pet State Machine ────────────────────────────────────────────

export const PetState = {
  WANDER: 'wander',
  FOLLOW: 'follow',
  SLEEP: 'sleep',
  PLAY: 'play',
  SIT: 'sit',
  WALK: 'walk',
  WAKE: 'wake',
} as const
export type PetState = (typeof PetState)[keyof typeof PetState]

export interface Pet {
  x: number
  y: number
  tileCol: number
  tileRow: number
  dir: Direction
  state: PetState
  path: Array<{ col: number; row: number }>
  moveProgress: number
  frame: number
  frameTimer: number
  /** Timer for behavior transitions (counts down) */
  behaviorTimer: number
  /** How many wander moves completed */
  wanderCount: number
  /** Agent ID the pet is following, or null */
  followTargetId: number | null
  /** Timer for repathfinding to follow target */
  followRepathTimer: number
  /** Whether pet is visible (enabled by user) */
  enabled: boolean
  /** Internal: transition to sleep when current walk path completes */
  sleepOnArrival: boolean
}

// ── Helpers ──────────────────────────────────────────────────────

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function tileCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  }
}

function directionBetween(fromCol: number, fromRow: number, toCol: number, toRow: number): Direction {
  const dc = toCol - fromCol
  const dr = toRow - fromRow
  if (Math.abs(dc) >= Math.abs(dr)) {
    return dc > 0 ? Direction.RIGHT : Direction.LEFT
  }
  return dr > 0 ? Direction.DOWN : Direction.UP
}

function manhattanDist(c1: number, r1: number, c2: number, r2: number): number {
  return Math.abs(c1 - c2) + Math.abs(r1 - r2)
}

// ── Creation ─────────────────────────────────────────────────────

export function createPet(startCol: number, startRow: number): Pet {
  const center = tileCenter(startCol, startRow)
  return {
    x: center.x,
    y: center.y,
    tileCol: startCol,
    tileRow: startRow,
    dir: Direction.DOWN,
    state: PetState.SIT,
    path: [],
    moveProgress: 0,
    frame: 0,
    frameTimer: 0,
    behaviorTimer: randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC),
    wanderCount: 0,
    followTargetId: null,
    followRepathTimer: 0,
    enabled: true,
    sleepOnArrival: false,
  }
}

// ── Behavior transitions ─────────────────────────────────────────

/** Pick a random active agent to follow, or null if none active */
function pickFollowTarget(characters: Map<number, Character>): number | null {
  const active: number[] = []
  for (const ch of characters.values()) {
    if (ch.isActive && !ch.isSubagent && ch.matrixEffect === null) {
      active.push(ch.id)
    }
  }
  if (active.length === 0) return null
  return active[Math.floor(Math.random() * active.length)]
}

/** Find a walkable tile near an active agent to sleep by */
function findWarmSpot(
  walkableTiles: Array<{ col: number; row: number }>,
  characters: Map<number, Character>,
): { col: number; row: number } | null {
  const activeSeated: Array<{ col: number; row: number }> = []
  for (const ch of characters.values()) {
    if (ch.isActive && ch.seatId) {
      activeSeated.push({ col: ch.tileCol, row: ch.tileRow })
    }
  }
  if (activeSeated.length === 0 || walkableTiles.length === 0) return null

  const target = activeSeated[Math.floor(Math.random() * activeSeated.length)]
  let bestTile: { col: number; row: number } | null = null
  let bestDist = Infinity
  for (const tile of walkableTiles) {
    const d = manhattanDist(tile.col, tile.row, target.col, target.row)
    if (d >= 1 && d <= 3 && d < bestDist) {
      bestDist = d
      bestTile = tile
    }
  }
  return bestTile
}

// ── FSM Update ───────────────────────────────────────────────────

export function updatePet(
  pet: Pet,
  dt: number,
  walkableTiles: Array<{ col: number; row: number }>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
  characters: Map<number, Character>,
): void {
  if (!pet.enabled) return
  pet.frameTimer += dt

  switch (pet.state) {
    case PetState.SIT: {
      pet.behaviorTimer -= dt
      if (pet.behaviorTimer <= 0) {
        transitionToNewBehavior(pet, walkableTiles, tileMap, blockedTiles, characters)
      }
      break
    }

    case PetState.WANDER: {
      pet.behaviorTimer -= dt
      if (pet.behaviorTimer <= 0) {
        if (pet.wanderCount >= PET_WANDER_MOVES_BEFORE_CHANGE) {
          transitionToNewBehavior(pet, walkableTiles, tileMap, blockedTiles, characters)
          break
        }
        // Pick a random nearby walkable tile
        if (walkableTiles.length > 0) {
          const nearby = walkableTiles.filter(
            (t) => manhattanDist(t.col, t.row, pet.tileCol, pet.tileRow) <= 4,
          )
          const pool = nearby.length > 0 ? nearby : walkableTiles
          const target = pool[Math.floor(Math.random() * pool.length)]
          const path = findPath(pet.tileCol, pet.tileRow, target.col, target.row, tileMap, blockedTiles)
          if (path.length > 0) {
            pet.path = path
            pet.moveProgress = 0
            pet.state = PetState.WALK
            pet.frame = 0
            pet.frameTimer = 0
            pet.wanderCount++
          }
        }
        pet.behaviorTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC)
      }
      break
    }

    case PetState.FOLLOW: {
      pet.behaviorTimer -= dt
      if (pet.behaviorTimer <= 0) {
        pet.followTargetId = null
        pet.state = PetState.SIT
        pet.behaviorTimer = randomRange(2, 5)
        break
      }

      const targetCh = pet.followTargetId !== null ? characters.get(pet.followTargetId) : null
      if (!targetCh || targetCh.matrixEffect === 'despawn') {
        pet.followTargetId = null
        pet.state = PetState.SIT
        pet.behaviorTimer = randomRange(2, 5)
        break
      }

      pet.followRepathTimer -= dt
      if (pet.followRepathTimer <= 0 && pet.path.length === 0) {
        pet.followRepathTimer = PET_FOLLOW_REPATH_SEC

        const dist = manhattanDist(pet.tileCol, pet.tileRow, targetCh.tileCol, targetCh.tileRow)
        if (dist > PET_FOLLOW_DISTANCE_TILES) {
          let bestTile: { col: number; row: number } | null = null
          let bestDist = Infinity
          for (const tile of walkableTiles) {
            const d = manhattanDist(tile.col, tile.row, targetCh.tileCol, targetCh.tileRow)
            if (d >= 1 && d <= PET_FOLLOW_DISTANCE_TILES) {
              const petD = manhattanDist(tile.col, tile.row, pet.tileCol, pet.tileRow)
              if (petD < bestDist) {
                bestDist = petD
                bestTile = tile
              }
            }
          }
          if (bestTile) {
            const path = findPath(pet.tileCol, pet.tileRow, bestTile.col, bestTile.row, tileMap, blockedTiles)
            if (path.length > 0) {
              pet.path = path
              pet.moveProgress = 0
              pet.state = PetState.WALK
              pet.frame = 0
              pet.frameTimer = 0
            }
          }
        }
      }
      break
    }

    case PetState.SLEEP: {
      pet.behaviorTimer -= dt
      if (pet.behaviorTimer <= 0) {
        // Wake up — small chance of zoomies!
        if (Math.random() < 0.3) {
          startPlay(pet, walkableTiles, tileMap, blockedTiles)
        } else {
          pet.state = PetState.SIT
          pet.behaviorTimer = randomRange(2, 5)
        }
      }
      break
    }

    case PetState.PLAY: {
      pet.behaviorTimer -= dt
      if (pet.behaviorTimer <= 0) {
        pet.state = PetState.SIT
        pet.behaviorTimer = randomRange(3, 8)
        pet.path = []
        break
      }
      if (pet.path.length === 0) {
        if (walkableTiles.length > 0) {
          const target = walkableTiles[Math.floor(Math.random() * walkableTiles.length)]
          const path = findPath(pet.tileCol, pet.tileRow, target.col, target.row, tileMap, blockedTiles)
          if (path.length > 0) {
            pet.path = path.slice(0, 5)
            pet.moveProgress = 0
          }
        }
      }
      updatePetMovement(pet, dt, true)
      break
    }

    case PetState.WAKE: {
      pet.behaviorTimer -= dt
      if (pet.behaviorTimer <= 0) {
        pet.state = PetState.WANDER
        pet.wanderCount = 0
        pet.behaviorTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC)
      }
      break
    }

    case PetState.WALK: {
      updatePetMovement(pet, dt, false)
      if (pet.path.length === 0) {
        const center = tileCenter(pet.tileCol, pet.tileRow)
        pet.x = center.x
        pet.y = center.y
        pet.moveProgress = 0

        // Check if we should sleep on arrival
        if (pet.sleepOnArrival) {
          pet.sleepOnArrival = false
          pet.state = PetState.SLEEP
          pet.frame = 0
          break
        }

        // Return to the behavior we were in before walking
        if (pet.followTargetId !== null) {
          pet.state = PetState.FOLLOW
        } else {
          pet.state = PetState.WANDER
          pet.behaviorTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC)
        }
      }
      break
    }
  }
}

function updatePetMovement(pet: Pet, dt: number, isPlaying: boolean): void {
  const speed = isPlaying ? PET_PLAY_SPEED_PX_PER_SEC : PET_WALK_SPEED_PX_PER_SEC

  if (pet.frameTimer >= PET_WALK_FRAME_DURATION_SEC) {
    pet.frameTimer -= PET_WALK_FRAME_DURATION_SEC
    pet.frame = (pet.frame + 1) % 2
  }

  if (pet.path.length === 0) {
    const center = tileCenter(pet.tileCol, pet.tileRow)
    pet.x = center.x
    pet.y = center.y
    return
  }

  const nextTile = pet.path[0]
  pet.dir = directionBetween(pet.tileCol, pet.tileRow, nextTile.col, nextTile.row)
  pet.moveProgress += (speed / TILE_SIZE) * dt

  const fromCenter = tileCenter(pet.tileCol, pet.tileRow)
  const toCenter = tileCenter(nextTile.col, nextTile.row)
  const t = Math.min(pet.moveProgress, 1)
  pet.x = fromCenter.x + (toCenter.x - fromCenter.x) * t
  pet.y = fromCenter.y + (toCenter.y - fromCenter.y) * t

  if (pet.moveProgress >= 1) {
    pet.tileCol = nextTile.col
    pet.tileRow = nextTile.row
    pet.x = toCenter.x
    pet.y = toCenter.y
    pet.path.shift()
    pet.moveProgress = 0
  }
}

function startPlay(
  pet: Pet,
  walkableTiles: Array<{ col: number; row: number }>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): void {
  pet.state = PetState.PLAY
  pet.behaviorTimer = PET_PLAY_DURATION_SEC
  pet.frame = 0
  pet.frameTimer = 0
  if (walkableTiles.length > 0) {
    const target = walkableTiles[Math.floor(Math.random() * walkableTiles.length)]
    const path = findPath(pet.tileCol, pet.tileRow, target.col, target.row, tileMap, blockedTiles)
    if (path.length > 0) {
      pet.path = path.slice(0, 5)
      pet.moveProgress = 0
    }
  }
}

/** Poke the pet — wake it from sleep or startle it into zoomies */
export function pokePet(
  pet: Pet,
  walkableTiles: Array<{ col: number; row: number }>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): void {
  if (pet.state === PetState.PLAY || pet.state === PetState.WAKE) return // already reacting
  if (pet.state === PetState.SLEEP) {
    // Wake up: brief pause before moving
    pet.state = PetState.WAKE
    pet.behaviorTimer = PET_WAKE_DURATION_SEC
    pet.path = []
    pet.moveProgress = 0
    pet.sleepOnArrival = false
  } else {
    // Any other state: startled → zoomies
    startPlay(pet, walkableTiles, tileMap, blockedTiles)
  }
}

function transitionToNewBehavior(
  pet: Pet,
  walkableTiles: Array<{ col: number; row: number }>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
  characters: Map<number, Character>,
): void {
  const roll = Math.random()

  if (roll < 0.35) {
    // Follow an active agent
    const targetId = pickFollowTarget(characters)
    if (targetId !== null) {
      pet.state = PetState.FOLLOW
      pet.followTargetId = targetId
      pet.followRepathTimer = 0
      pet.behaviorTimer = randomRange(PET_FOLLOW_DURATION_MIN_SEC, PET_FOLLOW_DURATION_MAX_SEC)
      return
    }
  }

  if (roll < 0.6) {
    // Sleep near warm electronics
    const warmSpot = findWarmSpot(walkableTiles, characters)
    if (warmSpot) {
      const path = findPath(pet.tileCol, pet.tileRow, warmSpot.col, warmSpot.row, tileMap, blockedTiles)
      if (path.length > 0) {
        pet.path = path
        pet.moveProgress = 0
        pet.state = PetState.WALK
        pet.followTargetId = null
        pet.frame = 0
        pet.frameTimer = 0
        pet.behaviorTimer = randomRange(PET_SLEEP_DURATION_MIN_SEC, PET_SLEEP_DURATION_MAX_SEC)
        pet.sleepOnArrival = true
        return
      }
    }
    // No warm spot reachable — sleep in place
    pet.state = PetState.SLEEP
    pet.behaviorTimer = randomRange(PET_SLEEP_DURATION_MIN_SEC, PET_SLEEP_DURATION_MAX_SEC)
    pet.frame = 0
    return
  }

  if (roll < 0.75) {
    // Zoomies!
    startPlay(pet, walkableTiles, tileMap, blockedTiles)
    return
  }

  // Default: wander
  pet.state = PetState.WANDER
  pet.wanderCount = 0
  pet.behaviorTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC)
}

// ── Sprite Selection ─────────────────────────────────────────────

export function getPetSprite(pet: Pet, sprites: PetSprites): SpriteData {
  switch (pet.state) {
    case PetState.WALK:
      return sprites.walk[pet.dir][pet.frame % 2]
    case PetState.PLAY:
      return sprites.walk[pet.dir][pet.frame % 2]
    case PetState.SLEEP:
      return sprites.sleep[pet.dir]
    case PetState.WAKE:
    case PetState.SIT:
    case PetState.WANDER:
    case PetState.FOLLOW:
    default:
      return sprites.idle[pet.dir]
  }
}
