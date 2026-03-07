# Character Expressions

**Status: Implemented**

**Tiny pixel-art speech bubbles with contextual emoji that react to what the agent is doing.**

Characters show small speech bubbles containing pixel-art icons that reflect their current activity: a lightbulb when reading code, a pencil when editing, an angry face on errors, sparkles on successful task completion, a magnifying glass when searching, and a gear when running commands. These expression bubbles are transient — they pop in when the activity starts and fade after a few seconds, giving the office a lively, reactive feel.

---

## Core Concept

Expression bubbles are a third bubble layer, independent of the existing permission (amber dots) and waiting (green checkmark) bubbles. They appear below the existing bubbles (or in their place when no status bubble is active) and convey what the agent is currently doing or just experienced.

Expressions are **cosmetic only** — they don't affect agent state, pathfinding, or any functional behavior. They're driven entirely by tool events that the client already receives.

---

## Expression Types

| Expression | Icon | Trigger | Duration |
|---|---|---|---|
| `reading` | Lightbulb (yellow) | `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch` tool starts | Stays while tool is active |
| `writing` | Pencil (blue) | `Write`, `Edit` tool starts | Stays while tool is active |
| `running` | Gear (gray) | `Bash` tool starts | Stays while tool is active |
| `tasking` | Arrow/fork (teal) | `Task` tool starts (sub-agent spawned) | 3 seconds |
| `error` | Angry face (red) | `tool_result` with `isError: true` | 3 seconds |
| `success` | Sparkles (green) | Turn completes (`agentStatus: 'waiting'`) after a turn that had tools | 3 seconds |
| `thinking` | Ellipsis (white) | Assistant text output with no tools (thinking/planning) | Stays while active |

---

## Sprite Design

Each expression is an 11x13 pixel sprite (same dimensions as existing bubbles) with the same speech-bubble frame: border, fill, icon, and tail pointer.

### Bubble Frame (shared)

```
[B, B, B, B, B, B, B, B, B, B, B],  // row 0: top border
[B, F, F, F, F, F, F, F, F, F, B],  // row 1-8: fill area (icon goes here)
...
[B, B, B, B, B, B, B, B, B, B, B],  // row 9: bottom border
[_, _, _, _, B, B, B, _, _, _, _],   // row 10: tail
[_, _, _, _, _, B, _, _, _, _, _],   // row 11: tail point
[_, _, _, _, _, _, _, _, _, _, _],   // row 12: empty
```

### Icon Pixels (inside the 9x8 fill area, rows 1-8, cols 1-9)

**Lightbulb** (reading):
```
Y = '#DDCC44'  // yellow
D = '#AA9922'  // dark yellow
    [_, _, _, _, Y, _, _, _, _],
    [_, _, _, Y, Y, Y, _, _, _],
    [_, _, Y, Y, _, Y, Y, _, _],
    [_, _, Y, _, _, _, Y, _, _],
    [_, _, _, Y, _, Y, _, _, _],
    [_, _, _, Y, Y, Y, _, _, _],
    [_, _, _, _, D, _, _, _, _],
    [_, _, _, D, D, D, _, _, _],
```

**Pencil** (writing):
```
L = '#5599DD'  // light blue
D = '#3366AA'  // dark blue
T = '#DDCC88'  // tip
    [_, _, _, _, _, _, _, L, _],
    [_, _, _, _, _, _, L, L, _],
    [_, _, _, _, _, L, L, _, _],
    [_, _, _, _, L, L, _, _, _],
    [_, _, _, D, L, _, _, _, _],
    [_, _, D, D, _, _, _, _, _],
    [_, D, D, _, _, _, _, _, _],
    [T, D, _, _, _, _, _, _, _],
```

**Gear** (running):
```
G = '#999999'  // gray
D = '#666666'  // dark gray
    [_, _, _, G, G, G, _, _, _],
    [_, _, G, D, D, D, G, _, _],
    [_, G, D, G, G, G, D, G, _],
    [G, D, G, G, _, G, G, D, G],
    [G, D, G, _, _, _, G, D, G],
    [G, D, G, G, _, G, G, D, G],
    [_, G, D, G, G, G, D, G, _],
    [_, _, G, D, D, D, G, _, _],
```

**Angry face** (error):
```
R = '#DD4444'  // red
D = '#AA2222'  // dark red
    [_, _, _, _, _, _, _, _, _],
    [_, _, R, _, _, _, R, _, _],
    [_, R, _, R, _, R, _, R, _],
    [_, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _],
    [_, _, _, D, D, D, _, _, _],
    [_, _, D, _, _, _, D, _, _],
    [_, _, _, _, _, _, _, _, _],
```

**Sparkles** (success):
```
G = '#44DD88'  // green
L = '#88FFBB'  // light green
    [_, _, _, _, L, _, _, _, _],
    [_, L, _, _, G, _, _, L, _],
    [_, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _],
    [_, L, _, _, G, _, _, _, _],
    [_, _, _, _, L, _, _, L, _],
```

**Arrow/fork** (tasking):
```
T = '#4ec9b0'  // teal
D = '#2a9a84'  // dark teal
    [_, _, _, _, T, _, _, _, _],
    [_, _, _, T, T, T, _, _, _],
    [_, _, _, _, T, _, _, _, _],
    [_, _, _, _, T, _, _, _, _],
    [_, _, _, T, _, T, _, _, _],
    [_, _, T, _, _, _, T, _, _],
    [_, T, _, _, _, _, _, T, _],
    [_, _, _, _, _, _, _, _, _],
```

**Ellipsis** (thinking):
```
W = '#CCCCDD'  // white-ish
    [_, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _],
    [_, _, W, _, W, _, W, _, _],
    [_, _, W, _, W, _, W, _, _],
    [_, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _, _, _],
```

---

## Data Model

### Extended: `Character`

Add to the `Character` interface:

```ts
/** Current expression bubble type, or null */
expressionType: 'reading' | 'writing' | 'running' | 'tasking' | 'error' | 'success' | 'thinking' | null
/** Countdown timer for timed expressions (3s types count down to 0, tool-active types ignored) */
expressionTimer: number
```

Initialize both to `null` / `0` in `createCharacter()`.

---

## No Server Changes

Expressions are derived entirely from events the client already receives:

- `agentToolStart` → set expression based on tool name
- `agentToolDone` → clear tool-active expression (if it matches)
- `agentToolClear` → clear all tool-active expressions
- `agentStatus: 'waiting'` → show `success` expression (if the turn had tools)
- Tool result with `isError` → show `error` expression

No new messages needed. All logic lives in the client.

---

## Client Changes

### `webview-ui/src/office/sprites/spriteData.ts`

Add the 7 expression sprites as exported constants:

```ts
export const EXPRESSION_READING_SPRITE: SpriteData = ...
export const EXPRESSION_WRITING_SPRITE: SpriteData = ...
export const EXPRESSION_RUNNING_SPRITE: SpriteData = ...
export const EXPRESSION_TASKING_SPRITE: SpriteData = ...
export const EXPRESSION_ERROR_SPRITE: SpriteData = ...
export const EXPRESSION_SUCCESS_SPRITE: SpriteData = ...
export const EXPRESSION_THINKING_SPRITE: SpriteData = ...
```

Also export a lookup map:

```ts
export const EXPRESSION_SPRITES: Record<string, SpriteData> = {
  reading: EXPRESSION_READING_SPRITE,
  writing: EXPRESSION_WRITING_SPRITE,
  running: EXPRESSION_RUNNING_SPRITE,
  tasking: EXPRESSION_TASKING_SPRITE,
  error: EXPRESSION_ERROR_SPRITE,
  success: EXPRESSION_SUCCESS_SPRITE,
  thinking: EXPRESSION_THINKING_SPRITE,
}
```

### `webview-ui/src/office/engine/characters.ts`

**New: `setExpression(ch, type, timed)`**

Helper that sets `ch.expressionType` and `ch.expressionTimer`:

```ts
export function setExpression(
  ch: Character,
  type: Character['expressionType'],
  timed: boolean
): void {
  ch.expressionType = type
  ch.expressionTimer = timed ? EXPRESSION_TIMED_DURATION_SEC : 0
}
```

**Modified: `updateCharacter()`**

Add expression timer countdown:

```ts
if (ch.expressionTimer > 0) {
  ch.expressionTimer -= dt
  if (ch.expressionTimer <= 0) {
    ch.expressionType = null
    ch.expressionTimer = 0
  }
}
```

### `webview-ui/src/office/engine/officeState.ts`

**Tool start handler** — when a tool starts on a character, map tool name to expression:

```ts
const TOOL_TO_EXPRESSION: Record<string, Character['expressionType']> = {
  Read: 'reading',
  Grep: 'reading',
  Glob: 'reading',
  WebFetch: 'reading',
  WebSearch: 'reading',
  Write: 'writing',
  Edit: 'writing',
  Bash: 'running',
  Task: 'tasking',
}
```

On `agentToolStart`: look up the tool name, call `setExpression(ch, type, isTimed)`. `tasking` is timed (3s), all others are persistent (cleared when the tool ends).

On `agentToolDone`: if the character's current expression matches the done tool's category, clear it (set `expressionType = null`). Don't clear if there are other active tools in the same category.

On `agentToolClear` / turn end: clear any active expression.

On `agentStatus: 'waiting'`: if the turn had tools (check via existing `hadToolsInTurn` or tool count), set `success` expression (timed, 3s).

**Error detection**: When processing `transcriptEntry` of type `tool_result` with `isError: true`, set `error` expression (timed, 3s). This overrides any current expression.

**Thinking detection**: When processing `transcriptEntry` of type `assistant_text` and no tools are active, set `thinking` expression (persistent, cleared when a tool starts or turn ends).

### `webview-ui/src/office/engine/renderer.ts`

**Modified: `renderBubbles()`**

After rendering status bubbles (permission/waiting), render expression bubbles for characters that have one:

```ts
for (const ch of characters) {
  if (!ch.expressionType) continue
  if (ch.matrixEffect === 'despawn') continue

  const sprite = EXPRESSION_SPRITES[ch.expressionType]
  if (!sprite) continue

  const cached = getCachedSprite(sprite, zoom)

  // Position: above the character, below any status bubble
  const sittingOff = ch.state === CharacterState.TYPE ? BUBBLE_SITTING_OFFSET_PX : 0
  let bubbleY = Math.round(offsetY + (ch.y + sittingOff - EXPRESSION_VERTICAL_OFFSET_PX) * zoom - cached.height)

  // If a status bubble is also showing, shift expression bubble down
  if (ch.bubbleType) {
    bubbleY += Math.round(EXPRESSION_STATUS_BUBBLE_GAP_PX * zoom)
  }

  const bubbleX = Math.round(offsetX + ch.x * zoom + (TILE_SIZE * zoom - cached.width) / 2)

  // Fade out timed expressions in the last second
  let alpha = 1
  if (ch.expressionTimer > 0 && ch.expressionTimer < EXPRESSION_FADE_DURATION_SEC) {
    alpha = ch.expressionTimer / EXPRESSION_FADE_DURATION_SEC
  }

  if (alpha < 1) ctx.globalAlpha = alpha
  ctx.drawImage(cached, bubbleX, bubbleY)
  if (alpha < 1) ctx.globalAlpha = 1
}
```

**Priority**: If both a status bubble (permission/waiting) and an expression bubble exist, the status bubble renders in its normal position (higher) and the expression renders slightly lower. If only an expression exists, it renders at the normal bubble height.

### `webview-ui/src/constants.ts`

New constants:

```ts
export const EXPRESSION_TIMED_DURATION_SEC = 3
export const EXPRESSION_FADE_DURATION_SEC = 0.5
export const EXPRESSION_VERTICAL_OFFSET_PX = 28    // above character head
export const EXPRESSION_STATUS_BUBBLE_GAP_PX = -14  // shift down when status bubble is also showing
```

### `webview-ui/src/office/types.ts`

Add `expressionType` and `expressionTimer` to the `Character` interface (as described in Data Model above).

---

## Expression Priority

When multiple expressions could apply simultaneously, the highest-priority one wins:

1. `error` — always shown immediately, overrides everything
2. `success` — turn completion sparkles
3. `writing` — active write/edit tool
4. `running` — active bash tool
5. `reading` — active read/search tool
6. `tasking` — sub-agent spawned
7. `thinking` — assistant text with no tools

If a higher-priority expression arrives while a lower one is showing, it replaces it. If a lower-priority one arrives while a higher one is active, it's ignored.

---

## Interaction Design

1. **Agent starts reading a file**: Lightbulb bubble pops in above the character. Character is in reading animation at their desk. Bubble stays until the Read tool completes.
2. **Agent edits a file**: Pencil bubble appears. Character is in typing animation. Bubble stays until Edit completes.
3. **Agent runs a Bash command**: Gear bubble. Stays until Bash completes.
4. **Tool returns an error**: Angry face bubble pops in immediately, replacing whatever expression was showing. Fades after 3 seconds.
5. **Agent's turn completes successfully**: Sparkles bubble for 3 seconds. Character stands up and starts wandering.
6. **Agent spawns a sub-agent**: Fork/arrow bubble for 3 seconds on the parent character.
7. **Agent is thinking (text output, no tools)**: Ellipsis bubble. Clears when a tool starts or the turn ends.
8. **Permission bubble + expression**: Both show. Permission (amber dots) is higher, expression is slightly below it. The status bubble always takes visual priority.
9. **Waiting bubble + success expression**: Both can coexist briefly — the waiting checkmark fades over 2s while the success sparkles show for 3s. This is fine; they're visually distinct.
10. **Rapid tool switching**: Expression updates immediately to match the latest tool. No animation delay between expression changes — instant swap.
11. **Sub-agent characters**: Sub-agents show expressions too, driven by the forwarded `agent_progress` events.

---

## Performance

- **7 new sprites**: Each 11x13 pixels. Cached via `getCachedSprite()` per zoom level. Negligible memory.
- **Render cost**: One additional `drawImage` per character per frame (when expression is active). Same cost as existing status bubbles.
- **No new messages**: All expression logic derives from events already sent to the client.
- **Timer updates**: One float decrement per character per frame. Negligible.
- **No DOM elements**: Expressions are canvas-rendered like status bubbles.

---

## Styling

Follows existing bubble aesthetic:

- Same 11x13 pixel dimensions as permission and waiting bubbles
- Same border color (`#555566`) and fill (`#EEEEFF`)
- Same speech-bubble tail pointing down
- Icon colors are intentionally muted pixel-art tones (not saturated emoji colors)
- Fade-out over the last 0.5s of timed expressions (same technique as waiting bubble fade)

---

## Files Modified

| File | Change |
|---|---|
| `webview-ui/src/constants.ts` | Expression timing, offset, fade, and gap constants |
| `webview-ui/src/office/types.ts` | `expressionType` and `expressionTimer` on `Character` |
| `webview-ui/src/office/sprites/spriteData.ts` | 7 expression sprite constants + `EXPRESSION_SPRITES` map |
| `webview-ui/src/office/engine/characters.ts` | `setExpression()` helper, expression timer countdown in `updateCharacter()` |
| `webview-ui/src/office/engine/officeState.ts` | `TOOL_TO_EXPRESSION` map, expression triggers on tool start/done/clear/status/error |
| `webview-ui/src/office/engine/renderer.ts` | Render expression bubbles in `renderBubbles()`, position below status bubbles |

---

## Implementation Order

1. **Data model** — Add `expressionType`/`expressionTimer` to `Character`, constants
2. **Sprites** — Create the 7 expression sprite arrays in `spriteData.ts`
3. **Expression logic** — `setExpression()` helper, timer countdown in `updateCharacter()`
4. **Triggers** — Wire tool start/done/clear/status events to expression changes in `officeState.ts`
5. **Rendering** — Draw expression bubbles in `renderBubbles()`, handle dual-bubble positioning
6. **Priority** — Implement expression priority so error/success override tool expressions
7. **Polish** — Fade-out timing, verify visual stacking with status bubbles, test rapid tool switching

---

## Not In Scope (Future)

- Animated expression icons (e.g., spinning gear, pulsing sparkles)
- Character-specific expression preferences
- Expression history/log
- Custom expression sprites (user-defined)
- Expressions for idle behaviors (coffee cup when visiting water cooler, heart when visiting raccoon)
- Expressions visible in the transcript panel
- Sound effects per expression type
- Expressions for sub-agent completion (parent shows reaction to sub-agent result)
