# Character Behavior Upgrades

**Always-visible status labels, richer idle behaviors, and a hand-raise permission animation.**

Three improvements to how characters look and act in the office. The status label now floats above every character at all times instead of only appearing on hover. Idle agents wander more purposefully — visiting the water cooler or vending machine, and occasionally interacting with the pet raccoon. When an agent needs permission, the character raises its hand (animated) instead of showing a static amber dots bubble.

---

## Feature 1: Always-Visible Activity Label

### Current Behavior

The `ToolOverlay` component (React, HTML-based) only renders for the selected or hovered agent (`if (!isSelected && !isHovered) return null`). This means 90% of the time you can't tell what any agent is doing without hovering each one.

### New Behavior

Every character always shows a compact floating label above its head with the current activity. Selected/hovered agents get a more detailed version.

### Changes

#### `webview-ui/src/office/components/ToolOverlay.tsx`

**Remove the early return** at line 91. Replace the visibility gate with a styling distinction:

```ts
// All agents show a label; selected/hovered get a richer version
const isCompact = !isSelected && !isHovered
```

**Compact label** (when `isCompact` is true):
- No border, no background — just the text itself with a thin text shadow for readability
- Smaller font: `16px` (down from `22px`)
- No folder name row
- No status dot
- No pointer events
- No box shadow
- `opacity: 0.85` for subtlety

**Full label** (existing behavior, when selected or hovered):
- No changes — same border, background, dot, folder name, font size

**Hide compact labels in edit mode**: When the layout editor is open, compact labels clutter the view. Add an `isEditMode` prop and skip compact labels when true (`if (isCompact && isEditMode) return null`).

#### `webview-ui/src/App.tsx`

Pass `isEditMode` through to `<ToolOverlay>`.

#### Activity text for idle agents

Currently `getActivityText()` returns `'Idle'` for inactive agents with no tools. This is fine — no change needed. The compact label will show "Idle" which tells the user at a glance that the agent has finished.

---

## Feature 2: Rich Idle Behaviors

### Current Behavior

When inactive, characters follow a simple loop: stand in place (IDLE state, 2-20s timer) → walk to random walkable tile (WALK) → repeat 3-6 times → return to seat → rest 2-4 minutes → repeat.

### New Behavior

Idle characters now have varied destinations instead of only random tiles. They might visit a "break area" (water cooler, vending machine, fridge, coffee table) or walk over to the pet raccoon. These aren't new FSM states — they use the existing IDLE→WALK→IDLE loop but pick smarter targets.

### Idle Destination Selection

When the wander timer expires and the character picks a new destination (currently `walkableTiles[random]`), replace the random tile selection with a weighted choice:

| Destination | Weight | Description |
|---|---|---|
| **Random walkable tile** | 60% | Current behavior — aimless wandering |
| **Break furniture** | 25% | Walk to an adjacent tile of a break-area item |
| **Pet raccoon** | 15% | Walk to the tile the raccoon is currently on |

If a chosen destination isn't available (no break furniture exists, pet isn't enabled, pathfinding fails), fall back to random walkable tile.

### Break Furniture

"Break furniture" = any placed furniture whose type name is one of:

```ts
const BREAK_FURNITURE_TYPES = new Set([
  'WATER_COOLER',
  'VENDING_MACHINE',
  'FRIDGE',
  'COFFEE_TABLE_LG',
  'COFFEE_MUG',
])
```

Add this constant set to `webview-ui/src/constants.ts`.

When selecting a break furniture destination:
1. Collect all placed furniture instances whose type matches `BREAK_FURNITURE_TYPES`
2. Pick one at random
3. Find a walkable tile adjacent to the furniture's footprint (prefer the tile facing the front of the item)
4. Pathfind to that tile

When the character arrives at a break furniture tile, it faces the furniture and **pauses** for 3-5 seconds (standing still in IDLE state, timer set to `BREAK_VISIT_PAUSE_MIN_SEC` / `BREAK_VISIT_PAUSE_MAX_SEC`). Then it resumes normal wander logic.

### Pet Raccoon Visit

When selecting the raccoon as a destination:
1. Check `officeState.pet` exists and `pet.enabled === true`
2. Get the tile the pet is currently on: `col = floor(pet.x / TILE_SIZE)`, `row = floor(pet.y / TILE_SIZE)`
3. Find a walkable tile adjacent to the pet's tile
4. Pathfind to that tile

When the character arrives near the raccoon:
1. Face toward the raccoon
2. Pause 1 second
3. Call `pokePet()` — the raccoon reacts (wakes up or does zoomies)
4. Character pauses another 2 seconds watching the raccoon, then resumes normal wander

The pet interaction counts as one wander move. The character doesn't chase the raccoon if it moves away during the pause.

### Implementation

#### `webview-ui/src/constants.ts`

```ts
export const BREAK_VISIT_PAUSE_MIN_SEC = 3
export const BREAK_VISIT_PAUSE_MAX_SEC = 5
export const IDLE_DESTINATION_RANDOM_WEIGHT = 0.60
export const IDLE_DESTINATION_BREAK_WEIGHT = 0.25
export const IDLE_DESTINATION_PET_WEIGHT = 0.15
export const PET_VISIT_PRE_POKE_PAUSE_SEC = 1.0
export const PET_VISIT_POST_POKE_PAUSE_SEC = 2.0
```

#### `webview-ui/src/office/types.ts`

Add to the `Character` interface:

```ts
/** When set, the character is visiting something specific during idle */
idleVisitType: 'break' | 'pet' | null
/** Timer for special idle visit pauses (break furniture dwell, pet interaction) */
idleVisitTimer: number
/** Whether the character has poked the pet during this visit */
idleVisitPokedPet: boolean
```

Initialize all to `null` / `0` / `false` in `createCharacter()`.

#### `webview-ui/src/office/engine/characters.ts`

**New: `pickIdleDestination()` function**

Called when the wander timer expires (replacing the current random tile selection). Takes `walkableTiles`, `furnitureInstances`, `pet`, `tileMap`, `blockedTiles` as parameters.

Returns `{ path, visitType }` or null.

**Modified: `updateCharacter()`**

1. Accepts new parameters: `furnitureInstances`, `pet`
2. In the IDLE case, when `wanderTimer <= 0`:
   - Before returning to seat check, call `pickIdleDestination()`
   - If it returns a path with `visitType`, set `ch.idleVisitType` and start walking
3. In the WALK case, when path completes and `!ch.isActive`:
   - If `ch.idleVisitType === 'break'`: face the furniture, set state to IDLE, set `wanderTimer` to break pause duration, clear `idleVisitType`
   - If `ch.idleVisitType === 'pet'`: face the pet, set `idleVisitTimer` to pre-poke pause, keep `idleVisitType`
4. In the IDLE case, when `ch.idleVisitType === 'pet'`:
   - Count down `idleVisitTimer`
   - If timer expires and `!idleVisitPokedPet`: call `pokePet()`, set `idleVisitPokedPet = true`, set `idleVisitTimer = PET_VISIT_POST_POKE_PAUSE_SEC`
   - If timer expires and `idleVisitPokedPet`: clear `idleVisitType`, `idleVisitPokedPet`, resume normal wander

#### `webview-ui/src/office/engine/officeState.ts`

Pass `furnitureInstances` and `pet` through to `updateCharacter()` call.

---

## Feature 3: Permission Hand-Raise Animation

### Current Behavior

When an agent needs permission, a static canvas-drawn amber dots bubble (11x13 sprite) appears above the character. It stays until the permission is cleared.

### New Behavior

Replace the amber dots bubble with an animated hand-raise. The character's sprite switches to a "hand up" pose that alternates between two frames — the hand bobs gently up and down to draw attention. This replaces the bubble entirely for the permission state.

### New Sprite Frames

Add 2 new frames per direction to the character sprite sheet:

**`handRaise1`** — Character standing with one arm (right arm) raised straight up. The hand is at the top of the sprite (row 0-1 of the 16x24 visible area).

**`handRaise2`** — Same pose but hand shifted 1 pixel higher (arm fully extended). The alternation between these two frames creates a gentle "waving" motion.

These frames are generated alongside the existing character sprites in `scripts/export-characters.ts` using the same palette system. Each frame is 16x32 (matching existing sprite dimensions).

### Sprite Sheet Extension

The character PNG expands from 7 to 9 frames wide (112px → 144px):

```
Frame: 0      1      2      3      4      5      6      7         8
       walk1  walk2  walk3  type1  type2  read1  read2  handUp1   handUp2
```

Each row (down/up/right) gains the 2 new frames.

### Animation

- Frame duration: `HAND_RAISE_FRAME_DURATION_SEC = 0.4` (slower than walk, gentle bobbing)
- 2-frame ping-pong: frame 0 → 1 → 0 → 1 ...
- Character faces their current direction (whatever direction they were facing when permission triggered)
- If the character was sitting (TYPE state), they remain in the sitting offset position but switch to the hand-raise sprite

### FSM Integration

No new CharacterState is needed. The hand-raise is a **visual override** — when `ch.bubbleType === 'permission'`, the sprite selection in `getCharacterSprite()` returns the hand-raise frames instead of the normal state sprite. The underlying state (TYPE, IDLE, WALK) continues to drive position/pathfinding as normal.

### Changes

#### `webview-ui/src/constants.ts`

```ts
export const HAND_RAISE_FRAME_DURATION_SEC = 0.4
```

#### `webview-ui/src/office/sprites/spriteData.ts`

Extend `CharacterSprites` interface:

```ts
export interface CharacterSprites {
  walk: SpriteData[][]      // [dir][frame]  4 frames
  typing: SpriteData[][]    // [dir][frame]  2 frames
  reading: SpriteData[][]   // [dir][frame]  2 frames
  handRaise: SpriteData[][] // [dir][frame]  2 frames  ← NEW
}
```

Update `parseCharacterPNG()` to extract frames 7-8 from each row.

#### `webview-ui/src/office/engine/characters.ts`

**`getCharacterSprite()`** — Add permission override at the top:

```ts
export function getCharacterSprite(ch: Character, sprites: CharacterSprites): SpriteData {
  // Permission hand-raise overrides normal sprite
  if (ch.bubbleType === 'permission') {
    return sprites.handRaise[ch.dir][ch.frame % 2]
  }
  // ... existing switch
}
```

**`updateCharacter()`** — When `ch.bubbleType === 'permission'`, use `HAND_RAISE_FRAME_DURATION_SEC` for frame timing instead of the current state's frame duration. Add before the state switch:

```ts
if (ch.bubbleType === 'permission') {
  if (ch.frameTimer >= HAND_RAISE_FRAME_DURATION_SEC) {
    ch.frameTimer -= HAND_RAISE_FRAME_DURATION_SEC
    ch.frame = (ch.frame + 1) % 2
  }
}
```

#### `webview-ui/src/office/engine/renderer.ts`

**`renderBubbles()`** — Skip rendering the `BUBBLE_PERMISSION_SPRITE` canvas bubble entirely. The hand-raise animation replaces it. Keep the waiting (green checkmark) bubble unchanged:

```ts
if (ch.bubbleType === 'permission') continue  // handled by hand-raise sprite
```

#### `scripts/export-characters.ts`

Generate the 2 new hand-raise frames for each palette. The hand-raise pose:
- Base: standing pose (walk frame 1)
- Modification: right arm pixels shifted up, hand pixels added at top of sprite
- Frame 1: hand at height Y
- Frame 2: hand at height Y-1 (1 pixel higher)

#### `webview-ui/src/office/sprites/petSprites.ts` (no change)

The existing `PET_SLEEP_BUBBLE` and waiting bubble continue to work as before. Only the permission bubble on characters changes.

---

## Files Modified

| File | Change |
|---|---|
| `webview-ui/src/constants.ts` | Break visit timers, idle weights, hand-raise frame duration, break furniture types |
| `webview-ui/src/office/types.ts` | `idleVisitType`, `idleVisitTimer`, `idleVisitPokedPet` on Character |
| `webview-ui/src/office/engine/characters.ts` | `pickIdleDestination()`, idle visit logic, pet poke during idle, hand-raise sprite override + animation |
| `webview-ui/src/office/engine/officeState.ts` | Pass furniture + pet to `updateCharacter()` |
| `webview-ui/src/office/components/ToolOverlay.tsx` | Remove hover/select gate, add compact vs full label styling, hide compact in edit mode |
| `webview-ui/src/App.tsx` | Pass `isEditMode` to ToolOverlay |
| `webview-ui/src/office/engine/renderer.ts` | Skip permission bubble (replaced by hand-raise sprite) |
| `webview-ui/src/office/sprites/spriteData.ts` | `handRaise` frames in CharacterSprites, parse from extended PNG |
| `scripts/export-characters.ts` | Generate hand-raise frames (2 per direction per palette) |
| `assets/characters/char_0.png` – `char_5.png` | Extended from 112px to 144px wide (2 new frame columns) |

---

## Interaction Design

1. **Always-visible labels**: Every character shows "Idle", "Reading file.ts", "Editing utils.ts", etc. at all times in a compact no-background style. Hover/select shows the full bordered label with folder name and status dot.
2. **Idle wander to water cooler**: Agent finishes a task → stands up → wanders → walks to the water cooler → stands facing it for 4 seconds → wanders elsewhere.
3. **Idle visit to raccoon**: Agent wanders → walks to the raccoon → pauses 1 second → raccoon does zoomies → agent watches for 2 seconds → resumes wandering.
4. **Permission hand raise**: Agent's terminal asks "Allow Edit?" → character immediately starts bobbing its raised hand up and down → continues until user responds in terminal → hand lowers and normal animation resumes.
5. **Click agent with raised hand**: Agent is selected, transcript panel opens — same as clicking any other agent. The hand-raise animation continues while selected.
6. **Agent becomes active while visiting water cooler**: Immediately pathfinds back to seat (existing behavior — `isActive` check in WALK/IDLE states already handles this).
7. **No break furniture in layout**: The 25% break-furniture weight falls back to random tile. Effectively 85% random + 15% pet.
8. **No pet enabled**: The 15% pet weight falls back to random tile. Effectively 85% random + 25% break (if break furniture exists).
9. **Edit mode**: Compact labels hidden. Full labels still show for selected/hovered agents.

---

## Performance

- **Always-visible labels**: More DOM elements (one per agent instead of 0-1). Bounded by agent count (typically 1-6). The RAF-based positioning loop is already running; no new cost per element.
- **Idle destination picking**: One random + one pathfind call per wander move. Negligible — same cost as current random wander.
- **Hand-raise animation**: Uses the existing frame timer and sprite cache. Zero new render cost — just picks a different cached sprite.
- **No new WebSocket messages**: All three features are entirely client-side.

---

## Not In Scope (Future)

- Characters sitting down at break furniture (would need chair-like seating for non-chair items)
- Characters chatting with each other when they meet
- Different hand-raise poses per character palette
- Thought bubbles ("I need a coffee!") during idle visits
- Characters picking up/carrying items (coffee mugs)
- Custom break area designation in the editor
- Hand-raise with speech bubble showing the specific permission needed
