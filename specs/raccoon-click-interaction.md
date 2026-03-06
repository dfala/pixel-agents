# Raccoon Click Interaction

**Status: Implemented**

**Tap the raccoon to wake it up, startle it, or get its attention.**

Clicking the pet raccoon interrupts its current behavior and triggers a reaction based on what it was doing. A sleeping raccoon wakes up and walks around. A wandering raccoon gets startled and does zoomies. The raccoon always reacts — it never ignores you.

---

## Behavior Matrix

What happens when you click the raccoon depends on its current state:

| Current state | Reaction | Why |
|---|---|---|
| **SLEEP** | Wake up → short stretch pause → WANDER | Tapping a sleeping pet wakes it up |
| **SIT** | Startled → PLAY (zoomies) | Idle pet gets spooked, runs around |
| **WANDER** | Startled → PLAY (zoomies) | Moving pet gets spooked mid-walk |
| **WALK** | Startled → PLAY (zoomies) | Same as wander — interrupt the walk |
| **FOLLOW** | Switch to PLAY (zoomies) | Breaks out of follow mode briefly |
| **PLAY** | (Ignore — already reacting) | Already in zoomies, don't restart |

After every click reaction finishes, the raccoon returns to normal behavior (SIT → random transition as usual). The raccoon never gets stuck in a post-click state.

---

## New State: WAKE

A brief transitional state (0.8s) that plays when the raccoon wakes from sleep. The raccoon sits still facing down (or its current direction), then transitions to WANDER.

```
SLEEP → (click) → WAKE (0.8s) → WANDER
```

The WAKE state uses the idle sprite (same as SIT) — it's a visual pause that makes the wake-up feel natural rather than snapping instantly to walking. During WAKE, clicking again has no effect (same as PLAY — already reacting).

---

## Click Detection

### Hit Testing

Add `getPetAt(worldX, worldY)` to `OfficeState`, mirroring the existing `getCharacterAt()` pattern:

```ts
getPetAt(worldX: number, worldY: number): boolean {
  if (!this.pet || !this.pet.enabled) return false
  const left   = this.pet.x - PET_HIT_HALF_WIDTH    // pet.x - 5
  const right  = this.pet.x + PET_HIT_HALF_WIDTH    // pet.x + 5
  const top    = this.pet.y - PET_HIT_HEIGHT         // pet.y - 10
  const bottom = this.pet.y
  return worldX >= left && worldX <= right && worldY >= top && worldY <= bottom
}
```

Constants `PET_HIT_HALF_WIDTH = 5` and `PET_HIT_HEIGHT = 10` already exist in `constants.ts`. The hit box exactly covers the 10×10 sprite, bottom-anchored at `(pet.x, pet.y)`.

### Click Priority

In `OfficeCanvas.tsx` `handleClick`, test pet clicks **after** character clicks but **before** empty-space deselection:

```
1. Character hit → select/deselect agent (existing behavior)
2. Pet hit → trigger raccoon reaction (NEW)
3. Seat click when agent selected → reassign seat (existing)
4. Empty space → deselect agent (existing)
```

This ensures agents always take priority (you can click an agent standing near the raccoon without accidentally poking the pet). The pet click does NOT affect agent selection — clicking the raccoon with an agent selected keeps the agent selected (and the transcript panel open).

### Hover Cursor

In `handleMouseMove`, add pet hover detection after character hover:

```ts
if (!hoveredAgent && officeState.getPetAt(worldX, worldY)) {
  canvas.style.cursor = 'pointer'
}
```

No tooltip or overlay — just the pointer cursor to signal clickability.

---

## FSM Changes

### New State

Add `WAKE` to the `PetState` object:

```ts
export const PetState = {
  WANDER: 'wander',
  FOLLOW: 'follow',
  SLEEP:  'sleep',
  PLAY:   'play',
  SIT:    'sit',
  WALK:   'walk',
  WAKE:   'wake',    // NEW
} as const
```

### New Function: `pokePet()`

Exported from `pet.ts`, called by `OfficeCanvas.tsx` on click:

```ts
export function pokePet(pet: Pet): void {
  if (pet.state === PetState.PLAY || pet.state === PetState.WAKE) return  // already reacting

  if (pet.state === PetState.SLEEP) {
    // Wake up: brief pause before moving
    pet.state = PetState.WAKE
    pet.behaviorTimer = PET_WAKE_DURATION_SEC   // 0.8s
    pet.path = []
    pet.moveProgress = 0
    pet.sleepOnArrival = false
  } else {
    // Any other state: startled → zoomies
    startPlay(pet)
  }
}
```

### WAKE State Update Logic

In `updatePet()`, add a case for `WAKE`:

```ts
case PetState.WAKE:
  pet.behaviorTimer -= dt
  if (pet.behaviorTimer <= 0) {
    pet.state = PetState.WANDER
    pet.wanderCount = 0
    pet.behaviorTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC)
  }
  break
```

### Sprite Selection

`getPetSprite()` returns the idle sprite for WAKE (raccoon sits still while "waking up"):

```ts
case PetState.WAKE:
  return sprites.idle[pet.dir]
```

---

## New Constants

Add to `webview-ui/src/constants.ts`:

```ts
export const PET_WAKE_DURATION_SEC = 0.8
```

---

## Files Modified

| File | Change |
|---|---|
| `webview-ui/src/constants.ts` | Add `PET_WAKE_DURATION_SEC` |
| `webview-ui/src/office/engine/pet.ts` | Add `WAKE` state, `pokePet()` function, WAKE update logic, sprite case |
| `webview-ui/src/office/engine/officeState.ts` | Add `getPetAt()` method |
| `webview-ui/src/office/components/OfficeCanvas.tsx` | Add pet hit-test in `handleClick` + `handleMouseMove` |

---

## Interaction Design

1. **Click sleeping raccoon** → sleep bubble disappears, raccoon sits still for 0.8s (wake), then starts wandering
2. **Click sitting/wandering raccoon** → raccoon immediately does fast zoomies (3s), then returns to sitting
3. **Click raccoon during zoomies** → nothing (already reacting, prevents spam)
4. **Click raccoon during wake** → nothing (already reacting)
5. **Hover over raccoon** → pointer cursor (no tooltip)
6. **Click agent near raccoon** → agent is selected (character click takes priority), raccoon unaffected
7. **Click raccoon with agent selected** → raccoon reacts, agent stays selected, transcript panel stays open

---

## Visual Feedback

No additional sprites or animations needed for v1. The WAKE state reuses the idle sprite (a brief pause). The existing PLAY state already provides satisfying visual feedback (fast movement with walk animation). The sleep bubble (`PET_SLEEP_BUBBLE`) naturally disappears when the state changes from SLEEP since the renderer only draws it for `state === PetState.SLEEP`.

---

## Performance

- Zero cost when not clicking — only runs on mouse events
- `getPetAt()` is a single bounding-box check (4 comparisons)
- No new WebSocket messages or server changes — entirely client-side
- No new sprites or assets to load

---

## Not In Scope (Future)

- Click reaction sprites (startled jump frame, stretch animation, yawn)
- Particle effects on click (hearts, stars, exclamation marks)
- Click counter / affection system
- Sound effects on raccoon interaction
- Raccoon following your cursor after being clicked
- Different reactions based on click count (double-click, rapid tapping)
