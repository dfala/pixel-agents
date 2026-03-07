# Timeline View

**Status: Not yet implemented**

**Horizontal Gantt-style bar per agent showing activity over time at the bottom of the screen.**

A collapsible panel at the bottom of the office view showing one row per agent. Each row is a horizontal timeline bar color-coded by state: active (tool use), idle (waiting for input / wandering), and permission-needed. Time flows left to right. The panel gives an at-a-glance history of what every agent has been doing and when.

---

## Data Model

### New: `TimelineSegment`

Each contiguous period of agent activity becomes a segment:

```ts
interface TimelineSegment {
  startTime: number    // Date.now() when this state began
  endTime: number | null  // null = still ongoing
  state: 'active' | 'idle' | 'waiting'  // waiting = permission needed
  toolName?: string    // most recent tool name during an active segment
}
```

### New: `AgentTimeline`

Per-agent timeline data:

```ts
interface AgentTimeline {
  agentId: number
  segments: TimelineSegment[]  // ordered by startTime, max TIMELINE_MAX_SEGMENTS
  createdAt: number            // when the agent was first seen
}
```

### Server-Side State

Each `AgentState` gains:

```ts
timeline: TimelineSegment[]    // ring buffer, max TIMELINE_MAX_SEGMENTS
timelineCreatedAt: number      // Date.now() at agent creation
```

When a new segment would exceed the cap, the oldest segment is shifted off. The first segment's `startTime` is preserved as a reference point so the client can still compute the full time range.

---

## Server Changes

### `src/transcriptParser.ts`

State transitions that create new segments:

| Event | New state | Trigger |
|---|---|---|
| `agentToolStart` (any tool) | `active` | First tool_use in a turn |
| `agentToolDone` (last active tool clears) | `idle` | All tools finished, turn complete |
| `agentStatus: 'waiting'` | `idle` | Turn ended, agent waiting for input |
| `agentStatus: 'permission'` | `waiting` | Permission timer fired |
| `agentToolStart` after permission | `active` | User granted permission, tool resumes |
| `system` + `subtype: "turn_duration"` | `idle` | Reliable turn-end signal |

Logic: when the new state differs from the current segment's state, close the current segment (`endTime = Date.now()`) and push a new one. If the state is the same, no-op. On `agentToolStart` during an active segment, update `toolName` to the latest tool (the bar shows the most recent tool per segment).

After pushing a new segment, broadcast:

```ts
broadcast({ type: 'timelineSegment', agentId, segment })
```

### `src/server.ts`

**On client `webviewReady`**: After sending `existingAgents`, send current timelines:

```ts
for (const [id, agent] of agents) {
  send({
    type: 'timelineData',
    agentId: id,
    segments: agent.timeline,
    createdAt: agent.timelineCreatedAt
  })
}
```

**On `agentCreated`**: Initialize empty timeline, set `createdAt`.

**On `agentClosed`**: Send a final segment closing the last open segment, then leave the timeline in state so it remains visible (greyed out) until the panel is dismissed or the page reloads.

### `src/types.ts`

Add to `AgentState`:

```ts
timeline: TimelineSegment[]
timelineCreatedAt: number
```

---

## Client Changes

### `webview-ui/src/hooks/useExtensionMessages.ts`

New React state:

```ts
const [timelines, setTimelines] = useState<Record<number, AgentTimeline>>({})
```

New message handlers:

- `timelineData` — Replace entire timeline for an agent
- `timelineSegment` — Append or update the latest segment for an agent. If the segment's `startTime` matches the last segment, update it (endTime/toolName). Otherwise append.
- `agentClosed` — Mark the agent's timeline as ended (close last segment, keep data)

Return `timelines` from the hook.

### New: `webview-ui/src/components/TimelinePanel.tsx`

A bottom panel that shows agent timelines as horizontal bars.

**Layout:**
- Fixed to bottom of viewport, above the bottom toolbar
- Full width, height: `TIMELINE_PANEL_HEIGHT_PX` (120px collapsed header + rows)
- Each agent row: `TIMELINE_ROW_HEIGHT_PX` (28px)
- Header row with title "Timeline" and collapse toggle
- Z-index above canvas vignette but below modals and settings

**Left column (fixed width, ~100px):**
- Agent label (e.g., "Agent 1") with palette-colored dot
- Vertically centered in the row
- Greyed out for closed agents

**Timeline bars (scrollable, remaining width):**
- Horizontal axis = time. Right edge = now (auto-advancing). Left edge = oldest visible time.
- Default visible window: last `TIMELINE_DEFAULT_WINDOW_MIN` minutes (10 min). Scroll horizontally to see older history.
- Each segment is a colored rectangle:

| State | Color | Description |
|---|---|---|
| `active` | `var(--pixel-accent)` / bright green | Agent is running tools |
| `idle` | `var(--pixel-bg-light)` / dark gray | Agent is between turns |
| `waiting` | `var(--pixel-warning)` / amber | Agent needs permission |

- Minimum segment render width: 2px (so very short segments are still visible)
- Ongoing segments (endTime === null) extend to the right edge and grow in real-time

**Time axis:**
- Tick marks at regular intervals along the bottom (every 1min, 5min, or 30min depending on zoom)
- Labels: relative times ("5m ago", "10m ago") or clock times ("2:35 PM") — whichever fits better
- Current time marker at the right edge

**Hover tooltip:**
- Hovering a segment shows: state name, tool name (if active), duration, start/end times
- Styled as pixel-art tooltip: `var(--pixel-bg)`, `2px solid var(--pixel-border)`, no border-radius

**Click interaction:**
- Click an agent's row label to select that agent (same as clicking the character in the office)
- Click a segment to select the agent and scroll the transcript panel (if open) to that time range

**Collapse/expand:**
- Header has a toggle arrow. Collapsed: just the header bar (24px) with a summary ("3 agents, 2 active"). Expanded: full panel with rows.
- Collapse state stored in React state (not persisted).

### `webview-ui/src/App.tsx`

- Destructure `timelines` from `useExtensionMessages`
- Render `<TimelinePanel>` when timeline data exists
- Pass: `timelines`, `agents` (for names/colors), `selectedAgentId`, `onSelectAgent`
- When timeline panel is expanded, offset the canvas bottom padding so the office view doesn't get occluded

### `webview-ui/src/constants.ts`

New constants:

```ts
export const TIMELINE_PANEL_HEIGHT_PX = 120
export const TIMELINE_ROW_HEIGHT_PX = 28
export const TIMELINE_HEADER_HEIGHT_PX = 24
export const TIMELINE_LABEL_WIDTH_PX = 100
export const TIMELINE_DEFAULT_WINDOW_MIN = 10
export const TIMELINE_MAX_SEGMENTS = 200
export const TIMELINE_MIN_SEGMENT_WIDTH_PX = 2
export const TIMELINE_TICK_INTERVALS = [60, 300, 1800] // seconds: 1min, 5min, 30min
```

---

## Rendering

The timeline bars are rendered on a **dedicated canvas** (not the office canvas). This avoids complicating the office renderer's z-sort pipeline and allows independent refresh rates.

**Refresh rate:** The timeline canvas redraws at `TIMELINE_REFRESH_RATE_MS = 1000` (1 FPS) via `setInterval`. This is enough — segments change on the order of seconds, and the "now" edge only needs per-second precision. No need for rAF.

**Drawing:**
1. Clear canvas
2. For each agent row:
   a. Draw label area (agent name + colored dot) — or use DOM overlay for labels
   b. Compute pixel range for visible time window
   c. For each segment overlapping the visible window:
      - Map `startTime`/`endTime` to x-coordinates
      - Fill rect with state color
      - Clamp to minimum 2px width
3. Draw time axis ticks and labels along the bottom
4. Draw "now" line at right edge (thin vertical line, `var(--pixel-accent)`)

**Horizontal scroll:** Track `viewStartTime` and `viewEndTime`. Mouse wheel (with shift or on the timeline canvas) scrolls horizontally. Optionally: pinch-to-zoom changes the visible time window width.

---

## Interaction Design

1. **Open timeline**: Click a toggle button in the bottom toolbar (next to existing Layout/Settings buttons). Panel slides up from bottom.
2. **Multiple agents**: Each agent gets its own row. Rows ordered by agent creation time (oldest at top).
3. **Agent starts working**: A green segment begins growing from the "now" edge in that agent's row.
4. **Agent finishes turn**: Green segment ends, gray idle segment begins.
5. **Permission needed**: Amber segment appears. Visually distinct — draws attention to which agent is blocked.
6. **Permission granted**: Amber ends, green resumes.
7. **Agent closed**: Row remains visible but grayed out. Last segment is closed. Row label dims.
8. **Hover segment**: Tooltip shows "Active: Edit (45s)" or "Waiting for permission (12s)" etc.
9. **Click agent label**: Selects agent in the office view (camera follows, outline appears).
10. **Scroll back**: Shift+scroll on the timeline to pan back in time. Right edge is "now" by default.
11. **Collapse panel**: Click the header toggle. Collapsed view shows just the header bar with a summary count.
12. **Sub-agents**: Sub-agent rows are indented slightly and grouped under their parent. They share the parent's palette color but at reduced opacity.

---

## Performance

- **Segment cap**: 200 segments per agent. At ~10 state changes per minute (heavy tool use), this covers ~20 minutes of history. Older segments are dropped server-side.
- **1 FPS canvas redraw**: Minimal CPU. No animation frames needed — the timeline is not animated, just periodically refreshed.
- **Message size**: Each `timelineSegment` message is tiny (~100 bytes). One message per state transition.
- **DOM elements**: The labels column can be DOM (one div per agent, typically 1-6). The bars are canvas-rendered — no DOM cost per segment.
- **No polling**: Segments are pushed via WebSocket on state transitions. The 1s canvas refresh only redraws existing data.
- **Collapsed panel**: When collapsed, the canvas is not rendered (skip `setInterval` callback).

---

## Styling

Follows existing pixel art aesthetic:

- `borderRadius: 0` on the panel and all elements
- `var(--pixel-bg)` background, `var(--pixel-border)` top border (2px solid)
- `var(--pixel-shadow)` box shadow on top edge
- Pixel font (FS Pixel Sans) for labels, tick marks, header
- Segment colors: solid fills, no gradients, no rounded ends
- Tooltip: `var(--pixel-bg)`, `2px solid var(--pixel-border)`, hard offset shadow
- Header: slightly lighter background (`var(--pixel-bg-light)`), collapse arrow is a simple triangle character
- Slide-up animation: CSS transform `translateY(100%) -> translateY(0)` over 200ms

---

## Files Modified

| File | Change |
|---|---|
| `src/types.ts` | `TimelineSegment` interface, `timeline` + `timelineCreatedAt` on `AgentState` |
| `src/constants.ts` | `TIMELINE_MAX_SEGMENTS` |
| `src/transcriptParser.ts` | State transition detection, segment creation, broadcast `timelineSegment` |
| `src/server.ts` | Send `timelineData` on init, initialize timeline on agent creation |
| `webview-ui/src/constants.ts` | Timeline panel dimensions, row height, time window, tick intervals, refresh rate |
| `webview-ui/src/hooks/useExtensionMessages.ts` | `timelines` state, `timelineData`/`timelineSegment` handlers |
| `webview-ui/src/components/TimelinePanel.tsx` | New component: canvas timeline bars, labels, time axis, tooltips, scroll |
| `webview-ui/src/components/BottomToolbar.tsx` | Timeline toggle button |
| `webview-ui/src/App.tsx` | Wire `TimelinePanel`, pass timelines + agents, canvas bottom offset |

---

## Implementation Order

1. **Data model** — Add `TimelineSegment` type to `src/types.ts`, add timeline fields to `AgentState`
2. **Server tracking** — Detect state transitions in `transcriptParser.ts`, build segments, broadcast
3. **Server init** — Send `timelineData` on client connect, initialize on agent creation
4. **Client state** — Add `timelines` to `useExtensionMessages` with handlers
5. **TimelinePanel component** — Canvas rendering, labels, time axis, horizontal scroll
6. **Bottom toolbar toggle** — Add Timeline button, collapse/expand state
7. **App integration** — Wire panel, canvas offset when expanded
8. **Interactions** — Hover tooltips, click-to-select, sub-agent row grouping
9. **Polish** — Slide animation, collapsed summary, greyed-out closed agents

---

## Not In Scope (Future)

- Zooming the time axis (pinch or scroll-wheel zoom)
- Exporting timeline data as JSON/CSV
- Persisting timeline across page reloads
- Aggregate statistics (total active time, idle %, etc.)
- Color-coding active segments by tool type (e.g., different greens for Read vs Edit vs Bash)
- Vertical "event markers" for specific moments (errors, permission prompts)
- Timeline for the pet raccoon
- Minimap / overview bar for very long sessions
