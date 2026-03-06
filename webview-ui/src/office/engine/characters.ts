import { CharacterState, Direction, TILE_SIZE } from '../types.js'
import type { Character, Seat, SpriteData, TileType as TileTypeVal, PlacedFurniture } from '../types.js'
import type { CharacterSprites } from '../sprites/spriteData.js'
import { findPath, isWalkable } from '../layout/tileMap.js'
import { getCatalogEntry } from '../layout/furnitureCatalog.js'
import { pokePet } from './pet.js'
import type { Pet } from './pet.js'
import {
  WALK_SPEED_PX_PER_SEC,
  WALK_FRAME_DURATION_SEC,
  TYPE_FRAME_DURATION_SEC,
  WANDER_PAUSE_MIN_SEC,
  WANDER_PAUSE_MAX_SEC,
  WANDER_MOVES_BEFORE_REST_MIN,
  WANDER_MOVES_BEFORE_REST_MAX,
  SEAT_REST_MIN_SEC,
  SEAT_REST_MAX_SEC,
  BREAK_VISIT_PAUSE_MIN_SEC,
  BREAK_VISIT_PAUSE_MAX_SEC,
  IDLE_DESTINATION_RANDOM_WEIGHT,
  IDLE_DESTINATION_BREAK_WEIGHT,
  PET_VISIT_PRE_POKE_PAUSE_SEC,
  PET_VISIT_POST_POKE_PAUSE_SEC,
  BREAK_FURNITURE_TYPES,
} from '../../constants.js'

/** Tools that show reading animation instead of typing */
const READING_TOOLS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'])

export function isReadingTool(tool: string | null): boolean {
  if (!tool) return false
  return READING_TOOLS.has(tool)
}

/** Pixel center of a tile */
function tileCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  }
}

/** Direction from one tile to an adjacent tile */
function directionBetween(fromCol: number, fromRow: number, toCol: number, toRow: number): Direction {
  const dc = toCol - fromCol
  const dr = toRow - fromRow
  if (dc > 0) return Direction.RIGHT
  if (dc < 0) return Direction.LEFT
  if (dr > 0) return Direction.DOWN
  return Direction.UP
}

export function createCharacter(
  id: number,
  palette: number,
  seatId: string | null,
  seat: Seat | null,
  hueShift = 0,
): Character {
  const col = seat ? seat.seatCol : 1
  const row = seat ? seat.seatRow : 1
  const center = tileCenter(col, row)
  return {
    id,
    state: CharacterState.TYPE,
    dir: seat ? seat.facingDir : Direction.DOWN,
    x: center.x,
    y: center.y,
    tileCol: col,
    tileRow: row,
    path: [],
    moveProgress: 0,
    currentTool: null,
    palette,
    hueShift,
    frame: 0,
    frameTimer: 0,
    wanderTimer: 0,
    wanderCount: 0,
    wanderLimit: randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX),
    isActive: true,
    seatId,
    bubbleType: null,
    bubbleTimer: 0,
    seatTimer: 0,
    isSubagent: false,
    parentAgentId: null,
    matrixEffect: null,
    matrixEffectTimer: 0,
    matrixEffectSeeds: [],
    idleVisitType: null,
    idleVisitTimer: 0,
    idleVisitPokedPet: false,
  }
}

/** Find an adjacent walkable tile next to a furniture footprint */
function findAdjacentWalkableTile(
  col: number,
  row: number,
  footprintW: number,
  footprintH: number,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): { col: number; row: number } | null {
  // Check tiles along the front (bottom) edge first, then sides, then back
  const candidates: Array<{ col: number; row: number }> = []
  // Front row (below furniture)
  for (let c = col; c < col + footprintW; c++) {
    candidates.push({ col: c, row: row + footprintH })
  }
  // Left and right sides
  for (let r = row; r < row + footprintH; r++) {
    candidates.push({ col: col - 1, row: r })
    candidates.push({ col: col + footprintW, row: r })
  }
  // Back row (above furniture)
  for (let c = col; c < col + footprintW; c++) {
    candidates.push({ col: c, row: row - 1 })
  }
  for (const t of candidates) {
    if (isWalkable(t.col, t.row, tileMap, blockedTiles)) {
      return t
    }
  }
  return null
}

/** Pick an idle destination with weighted selection: random tile, break furniture, or pet */
function pickIdleDestination(
  ch: Character,
  walkableTiles: Array<{ col: number; row: number }>,
  furnitureList: PlacedFurniture[],
  pet: Pet | null,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): { path: Array<{ col: number; row: number }>; visitType: 'break' | 'pet' | null } | null {
  const roll = Math.random()

  if (roll < IDLE_DESTINATION_RANDOM_WEIGHT) {
    // 60% — random walkable tile (existing behavior)
    return pickRandomTile(ch, walkableTiles, tileMap, blockedTiles)
  }

  if (roll < IDLE_DESTINATION_RANDOM_WEIGHT + IDLE_DESTINATION_BREAK_WEIGHT) {
    // 25% — break furniture
    const breakItems = furnitureList.filter((item) => BREAK_FURNITURE_TYPES.has(item.type))
    if (breakItems.length > 0) {
      const target = breakItems[Math.floor(Math.random() * breakItems.length)]
      const entry = getCatalogEntry(target.type)
      if (entry) {
        const adj = findAdjacentWalkableTile(
          target.col, target.row, entry.footprintW, entry.footprintH,
          tileMap, blockedTiles,
        )
        if (adj) {
          const path = findPath(ch.tileCol, ch.tileRow, adj.col, adj.row, tileMap, blockedTiles)
          if (path.length > 0) {
            return { path, visitType: 'break' }
          }
        }
      }
    }
    // Fallback to random tile
    return pickRandomTile(ch, walkableTiles, tileMap, blockedTiles)
  }

  // 15% — pet raccoon
  if (pet && pet.enabled) {
    const petCol = Math.floor(pet.x / TILE_SIZE)
    const petRow = Math.floor(pet.y / TILE_SIZE)
    const adj = findAdjacentWalkableTile(petCol, petRow, 1, 1, tileMap, blockedTiles)
    if (adj) {
      const path = findPath(ch.tileCol, ch.tileRow, adj.col, adj.row, tileMap, blockedTiles)
      if (path.length > 0) {
        return { path, visitType: 'pet' }
      }
    }
  }
  // Fallback to random tile
  return pickRandomTile(ch, walkableTiles, tileMap, blockedTiles)
}

/** Pick a random walkable tile as an idle destination */
function pickRandomTile(
  ch: Character,
  walkableTiles: Array<{ col: number; row: number }>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): { path: Array<{ col: number; row: number }>; visitType: null } | null {
  if (walkableTiles.length === 0) return null
  const target = walkableTiles[Math.floor(Math.random() * walkableTiles.length)]
  const path = findPath(ch.tileCol, ch.tileRow, target.col, target.row, tileMap, blockedTiles)
  if (path.length > 0) {
    return { path, visitType: null }
  }
  return null
}

export function updateCharacter(
  ch: Character,
  dt: number,
  walkableTiles: Array<{ col: number; row: number }>,
  seats: Map<string, Seat>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
  furnitureList: PlacedFurniture[],
  pet: Pet | null,
): void {
  ch.frameTimer += dt

  switch (ch.state) {
    case CharacterState.TYPE: {
      if (ch.frameTimer >= TYPE_FRAME_DURATION_SEC) {
        ch.frameTimer -= TYPE_FRAME_DURATION_SEC
        ch.frame = (ch.frame + 1) % 2
      }
      // If no longer active, stand up and start wandering (after seatTimer expires)
      if (!ch.isActive) {
        if (ch.seatTimer > 0) {
          ch.seatTimer -= dt
          break
        }
        ch.seatTimer = 0 // clear sentinel
        ch.state = CharacterState.IDLE
        ch.frame = 0
        ch.frameTimer = 0
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC)
        ch.wanderCount = 0
        ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX)
      }
      break
    }

    case CharacterState.IDLE: {
      // No idle animation — static pose
      ch.frame = 0
      if (ch.seatTimer < 0) ch.seatTimer = 0 // clear turn-end sentinel
      // If became active, pathfind to seat
      if (ch.isActive) {
        if (!ch.seatId) {
          // No seat assigned — type in place
          ch.state = CharacterState.TYPE
          ch.frame = 0
          ch.frameTimer = 0
          break
        }
        const seat = seats.get(ch.seatId)
        if (seat) {
          const path = findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, tileMap, blockedTiles)
          if (path.length > 0) {
            ch.path = path
            ch.moveProgress = 0
            ch.state = CharacterState.WALK
            ch.frame = 0
            ch.frameTimer = 0
          } else {
            // Already at seat or no path — sit down
            ch.state = CharacterState.TYPE
            ch.dir = seat.facingDir
            ch.frame = 0
            ch.frameTimer = 0
          }
        }
        break
      }
      // Pet visit interaction timer
      if (ch.idleVisitType === 'pet') {
        ch.idleVisitTimer -= dt
        if (ch.idleVisitTimer <= 0) {
          if (!ch.idleVisitPokedPet) {
            // Poke the pet
            if (pet && pet.enabled) {
              pokePet(pet, walkableTiles, tileMap, blockedTiles)
            }
            ch.idleVisitPokedPet = true
            ch.idleVisitTimer = PET_VISIT_POST_POKE_PAUSE_SEC
          } else {
            // Done watching — resume normal wander
            ch.idleVisitType = null
            ch.idleVisitPokedPet = false
            ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC)
          }
        }
        break // Skip normal wander logic while visiting pet
      }
      // Countdown wander timer
      ch.wanderTimer -= dt
      if (ch.wanderTimer <= 0) {
        // Check if we've wandered enough — return to seat for a rest
        if (ch.wanderCount >= ch.wanderLimit && ch.seatId) {
          const seat = seats.get(ch.seatId)
          if (seat) {
            const path = findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, tileMap, blockedTiles)
            if (path.length > 0) {
              ch.path = path
              ch.moveProgress = 0
              ch.state = CharacterState.WALK
              ch.frame = 0
              ch.frameTimer = 0
              break
            }
          }
        }
        const dest = pickIdleDestination(ch, walkableTiles, furnitureList, pet, tileMap, blockedTiles)
        if (dest) {
          ch.path = dest.path
          ch.moveProgress = 0
          ch.state = CharacterState.WALK
          ch.frame = 0
          ch.frameTimer = 0
          ch.wanderCount++
          ch.idleVisitType = dest.visitType
        }
        ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC)
      }
      break
    }

    case CharacterState.WALK: {
      // Walk animation
      if (ch.frameTimer >= WALK_FRAME_DURATION_SEC) {
        ch.frameTimer -= WALK_FRAME_DURATION_SEC
        ch.frame = (ch.frame + 1) % 4
      }

      if (ch.path.length === 0) {
        // Path complete — snap to tile center and transition
        const center = tileCenter(ch.tileCol, ch.tileRow)
        ch.x = center.x
        ch.y = center.y

        if (ch.isActive) {
          if (!ch.seatId) {
            // No seat — type in place
            ch.state = CharacterState.TYPE
          } else {
            const seat = seats.get(ch.seatId)
            if (seat && ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
              ch.state = CharacterState.TYPE
              ch.dir = seat.facingDir
            } else {
              ch.state = CharacterState.IDLE
            }
          }
        } else {
          // Check if arrived at assigned seat — sit down for a rest before wandering again
          if (ch.seatId) {
            const seat = seats.get(ch.seatId)
            if (seat && ch.tileCol === seat.seatCol && ch.tileRow === seat.seatRow) {
              ch.state = CharacterState.TYPE
              ch.dir = seat.facingDir
              // seatTimer < 0 is a sentinel from setAgentActive(false) meaning
              // "turn just ended" — skip the long rest so idle transition is immediate
              if (ch.seatTimer < 0) {
                ch.seatTimer = 0
              } else {
                ch.seatTimer = randomRange(SEAT_REST_MIN_SEC, SEAT_REST_MAX_SEC)
              }
              ch.wanderCount = 0
              ch.wanderLimit = randomInt(WANDER_MOVES_BEFORE_REST_MIN, WANDER_MOVES_BEFORE_REST_MAX)
              ch.frame = 0
              ch.frameTimer = 0
              break
            }
          }
          // Handle break furniture visit arrival
          if (ch.idleVisitType === 'break') {
            ch.state = CharacterState.IDLE
            ch.wanderTimer = randomRange(BREAK_VISIT_PAUSE_MIN_SEC, BREAK_VISIT_PAUSE_MAX_SEC)
            ch.idleVisitType = null
            ch.frame = 0
            ch.frameTimer = 0
            break
          }
          // Handle pet visit arrival
          if (ch.idleVisitType === 'pet') {
            ch.state = CharacterState.IDLE
            ch.idleVisitTimer = PET_VISIT_PRE_POKE_PAUSE_SEC
            ch.idleVisitPokedPet = false
            ch.frame = 0
            ch.frameTimer = 0
            break
          }
          ch.state = CharacterState.IDLE
          ch.wanderTimer = randomRange(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC)
        }
        ch.frame = 0
        ch.frameTimer = 0
        break
      }

      // Move toward next tile in path
      const nextTile = ch.path[0]
      ch.dir = directionBetween(ch.tileCol, ch.tileRow, nextTile.col, nextTile.row)

      ch.moveProgress += (WALK_SPEED_PX_PER_SEC / TILE_SIZE) * dt

      const fromCenter = tileCenter(ch.tileCol, ch.tileRow)
      const toCenter = tileCenter(nextTile.col, nextTile.row)
      const t = Math.min(ch.moveProgress, 1)
      ch.x = fromCenter.x + (toCenter.x - fromCenter.x) * t
      ch.y = fromCenter.y + (toCenter.y - fromCenter.y) * t

      if (ch.moveProgress >= 1) {
        // Arrived at next tile
        ch.tileCol = nextTile.col
        ch.tileRow = nextTile.row
        ch.x = toCenter.x
        ch.y = toCenter.y
        ch.path.shift()
        ch.moveProgress = 0
      }

      // If became active while wandering, repath to seat
      if (ch.isActive && ch.seatId) {
        const seat = seats.get(ch.seatId)
        if (seat) {
          const lastStep = ch.path[ch.path.length - 1]
          if (!lastStep || lastStep.col !== seat.seatCol || lastStep.row !== seat.seatRow) {
            const newPath = findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, tileMap, blockedTiles)
            if (newPath.length > 0) {
              ch.path = newPath
              ch.moveProgress = 0
            }
          }
        }
      }
      break
    }
  }
}

/** Get the correct sprite frame for a character's current state and direction */
export function getCharacterSprite(ch: Character, sprites: CharacterSprites): SpriteData {
  switch (ch.state) {
    case CharacterState.TYPE:
      if (isReadingTool(ch.currentTool)) {
        return sprites.reading[ch.dir][ch.frame % 2]
      }
      return sprites.typing[ch.dir][ch.frame % 2]
    case CharacterState.WALK:
      return sprites.walk[ch.dir][ch.frame % 4]
    case CharacterState.IDLE:
      return sprites.walk[ch.dir][1]
    default:
      return sprites.walk[ch.dir][1]
  }
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}
