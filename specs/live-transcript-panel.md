# Live Transcript Panel

**Click agent → see what it's doing in real-time.**

When you click an agent character, a panel slides in from the right showing the last ~20 transcript entries — assistant text, tool calls, tool results — auto-scrolling as new activity arrives. Click away or click another agent to switch.

---

## Data Model

### New: `TranscriptEntry`

Each parsed JSONL record becomes a `TranscriptEntry` sent to the client:

```ts
interface TranscriptEntry {
  id: string           // unique (e.g. counter per agent)
  timestamp: number    // Date.now() when line was read
  type: 'assistant_text' | 'tool_call' | 'tool_result' | 'turn_end'
  // For assistant_text:
  text?: string        // the assistant's prose (truncated to ~500 chars)
  // For tool_call:
  toolName?: string    // "Read", "Edit", "Bash", etc.
  toolArgs?: string    // formatted summary — filename, command, etc. (truncated ~200 chars)
  // For tool_result:
  toolName?: string
  output?: string      // truncated result (~300 chars)
  isError?: boolean    // tool_result with is_error
  // For turn_end:
  // (no extra fields — visual separator "Waiting for input...")
}
```

### Server-Side Buffer

Each `AgentState` gains:

```ts
transcriptBuffer: TranscriptEntry[]   // ring buffer, max 30 entries
transcriptSeq: number                 // monotonic counter for entry IDs
```

When the buffer exceeds 30 entries, oldest entries are shifted off. This bounds server memory per agent.

---

## Server Changes

### `src/transcriptParser.ts`

`processTranscriptLine()` currently fires messages like `agentToolStart` and `agentToolDone`. Extend it to **also** build `TranscriptEntry` objects from parsed JSONL records and push them to the agent's buffer.

Mapping from JSONL record types to entries:

| JSONL record | Entry type | Content |
|---|---|---|
| `assistant` with text blocks | `assistant_text` | Concatenated text content (no tool_use blocks, no thinking). Truncate to 500 chars. Skip if empty. |
| `assistant` with `tool_use` blocks | `tool_call` | One entry per tool_use. `toolName` = tool name. `toolArgs` = formatted summary from existing `formatToolStatus()` logic. |
| `user` with `tool_result` blocks | `tool_result` | One entry per result. `toolName` from matching active tool. `output` = text content truncated to 300 chars. `isError` from `is_error` flag. |
| `system` with `subtype: "turn_duration"` | `turn_end` | Marker entry. No content. |
| `progress` with `agent_progress` | (skip) | Sub-agent activity already shown via sub-agent characters. |
| `progress` with `bash_progress` | `tool_result` | Streaming bash output. `toolName = "Bash"`. `output` = last chunk truncated. Update existing entry if same tool. |

After pushing to the buffer, broadcast to all clients:

```ts
broadcast({ type: 'transcriptEntry', agentId, entry })
```

### `src/server.ts`

**On client `webviewReady`**: After sending `existingAgents`, also send current transcript buffers for all active agents:

```ts
// For each active agent, send its buffer
for (const [id, agent] of agents) {
  send({ type: 'transcriptBuffer', agentId: id, entries: agent.transcriptBuffer })
}
```

**On `agentClosed`**: Clear the buffer (agent is removed anyway).

### `src/types.ts`

Add to `AgentState`:

```ts
transcriptBuffer: TranscriptEntry[]
transcriptSeq: number
```

---

## Client Changes

### `webview-ui/src/hooks/useExtensionMessages.ts`

New React state:

```ts
const [transcriptBuffers, setTranscriptBuffers] = useState<Record<number, TranscriptEntry[]>>({})
```

New message handlers:

- `transcriptBuffer` — Replace entire buffer for an agent: `setTranscriptBuffers(prev => ({ ...prev, [msg.agentId]: msg.entries }))`
- `transcriptEntry` — Append single entry: push to agent's array, cap at 30
- `agentClosed` — Delete agent's buffer from state

Return `transcriptBuffers` from the hook.

### New: `webview-ui/src/components/TranscriptPanel.tsx`

A right-side panel that slides in when an agent is selected.

**Layout:**
- Fixed position: right edge, full height minus bottom toolbar area
- Width: 320px (or ~30% of viewport, whichever is smaller)
- Z-index above canvas vignette but below modals
- Semi-transparent dark background matching pixel art theme (`var(--pixel-bg)` with `var(--pixel-border)`)

**Header:**
- Agent name/label (e.g., "Agent 1" or folder name if available)
- Status dot (reuse logic from ToolOverlay — green active, amber permission, etc.)
- Close button (X)

**Transcript list:**
- Scrollable container, auto-scrolls to bottom on new entries (unless user has scrolled up)
- Each `TranscriptEntry` rendered as a styled block:

  | Entry type | Rendering |
  |---|---|
  | `assistant_text` | White/light text, normal weight. Represents Claude's prose output. |
  | `tool_call` | Accent-colored tool name badge (e.g., `[Read]`, `[Bash]`), followed by args in dimmer text. Monospace for commands. |
  | `tool_result` | Indented, dimmer text, monospace. Green text for success, red for `isError`. Truncated with "..." |
  | `turn_end` | Thin horizontal divider line + dim "Waiting for input..." text |

- Timestamps shown as relative ("2s ago", "1m ago") on hover or in margin

**Empty state:** "No activity yet" when buffer is empty.

**Auto-scroll behavior:**
- Track whether user has scrolled up (e.g., `scrollTop + clientHeight < scrollHeight - threshold`)
- If user scrolled up: don't auto-scroll, show a "↓ New activity" pill at bottom
- Clicking the pill scrolls to bottom and re-enables auto-scroll
- New entries while at bottom: auto-scroll

### `webview-ui/src/App.tsx`

- Destructure `transcriptBuffers` from `useExtensionMessages`
- Render `<TranscriptPanel>` when `selectedAgent !== null`
- Pass: `agentId={selectedAgent}`, `entries={transcriptBuffers[selectedAgent] ?? []}`, `onClose` (deselects agent)
- Agent info (folder name, status) from existing state

### `webview-ui/src/constants.ts`

New constants:

```ts
TRANSCRIPT_PANEL_WIDTH_PX = 320
TRANSCRIPT_MAX_ENTRIES = 30
TRANSCRIPT_ASSISTANT_TEXT_MAX_CHARS = 500
TRANSCRIPT_TOOL_ARGS_MAX_CHARS = 200
TRANSCRIPT_TOOL_OUTPUT_MAX_CHARS = 300
```

---

## Interaction Design

1. **Click agent character** → panel slides in from right showing that agent's transcript
2. **Click different agent** → panel content swaps to new agent (no slide animation, instant swap)
3. **Click same agent again** (deselect) → panel slides out
4. **Click empty space** → agent deselected, panel slides out
5. **Agent closes** (terminal ends) → if that agent's panel was open, panel closes
6. **Panel close button (X)** → deselects agent, panel slides out
7. **Scroll up** in transcript → auto-scroll pauses, "↓ New activity" pill appears on new entries
8. **Click "↓ New activity" pill** → scrolls to bottom, resumes auto-scroll

Panel does NOT steal focus or keyboard input — canvas pan/zoom and editor shortcuts continue to work.

---

## Performance

- **Server buffer cap**: 30 entries per agent. Older entries are discarded. Memory bounded.
- **Message size**: Each `transcriptEntry` message is small (~1KB max with truncation). No concern for WebSocket throughput.
- **Truncation**: All text fields are truncated server-side before sending. Client never receives multi-KB tool outputs.
- **React rendering**: Transcript list uses keys on entry IDs. Only new entries cause DOM additions. `useRef` for scroll container avoids re-renders on scroll.
- **No polling**: Entries are pushed via WebSocket as they're parsed. Zero additional I/O.

---

## Styling

Follows existing pixel art aesthetic:
- `borderRadius: 0` everywhere
- `var(--pixel-bg)` background, `var(--pixel-border)` borders
- `2px solid` borders, `var(--pixel-shadow)` box shadow
- Pixel font (FS Pixel Sans) for headers, monospace for code/output
- Tool name badges: small colored tags using `var(--pixel-accent)` tones
- Slide-in animation: CSS transform `translateX(100%) → translateX(0)` over 200ms

---

## Implementation Order

1. **Data model** — Add `TranscriptEntry` type to `src/types.ts`, add buffer fields to `AgentState`
2. **Server parsing** — Extend `processTranscriptLine()` to build entries and push to buffer
3. **Server messaging** — Add `transcriptEntry` broadcast + `transcriptBuffer` on init
4. **Client state** — Add `transcriptBuffers` to `useExtensionMessages` with handlers
5. **TranscriptPanel component** — Build the panel UI with entry rendering + auto-scroll
6. **App integration** — Wire panel into `App.tsx` based on selection state
7. **Polish** — Slide animation, "new activity" pill, relative timestamps, empty state

---

## Not In Scope (Future)

- Searching/filtering transcript entries
- Clicking a tool_call entry to expand full args
- Copying transcript text to clipboard
- Persisting transcript history across page reloads
- Showing thinking blocks (currently stripped by the parser)
