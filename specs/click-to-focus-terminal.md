# Click-to-Focus Terminal

**Status: Implemented**

**Click an agent character to focus the terminal window where that Claude session is running.**

When the user clicks an agent in the office, the app identifies which terminal process owns that agent's JSONL session file and brings that terminal window to the foreground. Works with any terminal emulator (iTerm2, Terminal.app, Hyper, Alacritty, etc.) — no VS Code dependency.

---

## How It Works

### The Chain

```
Agent character (webview)
  → agentId
  → JSONL file path (server already knows this)
  → PID of the `claude` process writing to that file (cached on discovery)
  → Walk process tree up to terminal emulator PID
  → OS-level "focus this window" command
```

### PID Discovery

When the server discovers a new JSONL session, it finds the PID of the process that has the file open:

```bash
# macOS / Linux
lsof -t <jsonl-path>
```

This returns the PID of the `claude` process that owns the session. If multiple PIDs are returned (rare), pick the one that's a direct `claude` process by checking the command name.

The PID is cached on `AgentState` so click-to-focus is instant (no `lsof` at click time). If the cached PID becomes stale (process exited), re-resolve on next click.

### Process Tree Walking

The `claude` process runs inside a terminal emulator. The process hierarchy typically looks like:

```
Terminal.app (or iTerm2, etc.)
  └── zsh / bash
        └── claude --session-id <uuid>
```

Walk up the parent PID chain using `ps -o ppid=` until we find a process whose command name matches a known terminal emulator. Cache the terminal PID alongside the claude PID.

### Window Focusing

Once we have the terminal emulator's PID:

**macOS** (primary target):
```bash
osascript -e 'tell application "System Events" to set frontmost of (first process whose unix id is <PID>) to true'
```

Or for more precise tab/window targeting in iTerm2:
```bash
osascript -e 'tell application "iTerm2" to activate'
# Then match window by tty or session
```

**Linux** (future):
```bash
xdotool search --pid <terminal-pid> --name "" windowactivate
# or
wmctrl -ia <window-id>
```

**Windows** (future):
```powershell
# PowerShell: Activate window by PID
(Get-Process -Id <PID>).MainWindowHandle | ForEach-Object {
  [Win32]::SetForegroundWindow($_)
}
```

Start with macOS. Other platforms return a graceful no-op with a console warning.

---

## Data Model

### Changes to `AgentState`

```ts
interface AgentState {
  // ... existing fields ...

  /** PID of the `claude` process writing to the JSONL file, or null if not yet resolved */
  claudePid: number | null;
  /** PID of the terminal emulator (parent of the shell that runs claude), or null */
  terminalPid: number | null;
  /** Name of the terminal emulator process (e.g., 'iTerm2', 'Terminal', 'alacritty') */
  terminalApp: string | null;
}
```

---

## Server Changes

### New: `src/processFocus.ts`

Core module with three exported functions:

```ts
/** Find the PID that has a file open. Returns null if not found. */
export function findPidForFile(filePath: string): Promise<number | null>

/** Walk process tree from PID up to find the terminal emulator.
    Returns { pid, appName } or null. */
export function findTerminalAncestor(pid: number): Promise<{ pid: number; appName: string } | null>

/** Bring the terminal window to the foreground. */
export function focusTerminalWindow(terminalPid: number, terminalApp: string): Promise<boolean>
```

**`findPidForFile`**: Runs `lsof -t <path>` via `child_process.execFile`. Parses output, filters to processes whose command is `claude` (via `ps -o comm=`). Returns first match or null.

**`findTerminalAncestor`**: Starting from the given PID, repeatedly calls `ps -o ppid=,comm=` to walk up. Stops when it finds a process matching a known terminal set:

```ts
const KNOWN_TERMINALS = new Set([
  'Terminal',        // macOS Terminal.app
  'iTerm2',          // iTerm2
  'Alacritty',       // Alacritty
  'kitty',           // Kitty
  'WezTerm',         // WezTerm
  'Hyper',           // Hyper
  'tmux: server',    // tmux (special case)
  'screen',          // GNU Screen
  'warp',            // Warp
  'ghostty',         // Ghostty
  'WindowsTerminal', // Windows Terminal
  'Code',            // VS Code integrated terminal
  'Cursor',          // Cursor integrated terminal
]);
```

Also stops if PID reaches 1 (init) — return null (terminal not found).

**`focusTerminalWindow`**: Platform switch:
- `darwin`: Uses `osascript` to activate the process by PID
- `linux`: Attempts `xdotool` (warns if not installed)
- `win32`: Attempts PowerShell window activation
- Other: No-op, returns false

**Error handling**: All functions catch and log errors, never throw. If `lsof` isn't available, PID resolution silently fails. The feature degrades gracefully — click still selects the agent in the office, just doesn't focus a terminal.

### `src/server.ts`

**Agent creation**: After creating an agent, asynchronously resolve its PID:

```ts
// In createAgent(), after agents.set(id, agent):
resolveAgentPids(agent);
```

Where `resolveAgentPids` is:

```ts
async function resolveAgentPids(agent: AgentState): Promise<void> {
  const pid = await findPidForFile(agent.jsonlFile);
  if (pid === null) return;
  agent.claudePid = pid;
  const terminal = await findTerminalAncestor(pid);
  if (terminal) {
    agent.terminalPid = terminal.pid;
    agent.terminalApp = terminal.appName;
  }
}
```

**New client message handler**: `focusAgent`

```ts
case 'focusAgent': {
  const id = data.agentId as number;
  const agent = agents.get(id);
  if (!agent) break;

  // Re-resolve if cached PID is stale
  if (agent.claudePid !== null) {
    const alive = await isProcessAlive(agent.claudePid);
    if (!alive) {
      await resolveAgentPids(agent);
    }
  } else {
    await resolveAgentPids(agent);
  }

  if (agent.terminalPid && agent.terminalApp) {
    const success = await focusTerminalWindow(agent.terminalPid, agent.terminalApp);
    if (!success) {
      console.log(`[Server] Could not focus terminal for agent ${id}`);
    }
  }
  break;
}
```

### `src/constants.ts`

```ts
/** Timeout for lsof/ps subprocess calls (ms) */
export const PID_RESOLVE_TIMEOUT_MS = 3000;
```

---

## Client Changes

### `webview-ui/src/office/components/OfficeCanvas.tsx`

The click handler already calls `onClick(agentId)`. No changes needed to the canvas — just need the parent to send `focusAgent` to the server.

### `webview-ui/src/App.tsx`

Update the click handler to send `focusAgent`:

```ts
const handleClick = useCallback((agentId: number) => {
  vscode.postMessage({ type: 'focusAgent', agentId });
}, []);
```

(The `vscode.postMessage` is actually the WebSocket send in standalone mode — same API.)

### Notification Panel

Clicking a notification entry already calls `onSelectAgent`, which selects + follows the agent. Optionally, a **double-click** on a notification entry could also send `focusAgent` to open the terminal. Or add a small "open terminal" icon button on each entry.

---

## Interaction Design

1. **Single click on agent**: Select agent (white outline, camera follows), open transcript panel. **Also** send `focusAgent` to bring terminal to foreground.
2. **Agent not yet resolved**: If PID hasn't been found yet (just spawned), the click still selects the agent. Terminal focus silently fails. Next click may succeed after async resolution completes.
3. **Terminal closed**: If the user closed the terminal but the JSONL file is still recent, the PID check will fail. Agent remains visible but click can't focus anything. Graceful no-op.
4. **Multiple monitors**: `osascript` raises the window but doesn't move it between monitors. The terminal appears on whichever monitor it's already on.
5. **tmux/screen**: If Claude runs inside tmux, the terminal ancestor is the terminal running tmux — we focus that. We don't switch tmux panes (that would require `tmux select-window`, which is possible but out of scope for v1).

---

## Performance

- **PID resolution**: `lsof` + `ps` calls take ~50-100ms. Done once at agent discovery time, not on click.
- **Stale PID check**: `kill(pid, 0)` (signal 0 = test if process exists) is instant. Done on click before focusing.
- **osascript**: Window focus takes ~50ms. Imperceptible.
- **No polling**: PIDs are resolved once and cached. Re-resolved only if stale on click.

---

## Platform Support

| Platform | PID Discovery | Terminal Detection | Window Focus | Status |
|---|---|---|---|---|
| macOS | `lsof` + `ps` | Process tree walk | `osascript` | v1 |
| Linux | `lsof` + `ps` | Process tree walk | `xdotool` / `wmctrl` | Future |
| Windows | `handle.exe` or `Get-Process` | Process tree walk | PowerShell | Future |

The feature is **macOS-first**. On unsupported platforms, clicks still select the agent in the office — terminal focusing is silently skipped.

---

## Files Modified

| File | Change |
|---|---|
| `src/types.ts` | Add `claudePid`, `terminalPid`, `terminalApp` to `AgentState` |
| `src/constants.ts` | `PID_RESOLVE_TIMEOUT_MS` |
| `src/processFocus.ts` | New module: `findPidForFile`, `findTerminalAncestor`, `focusTerminalWindow` |
| `src/server.ts` | PID resolution on agent creation, `focusAgent` message handler |
| `webview-ui/src/App.tsx` | Send `focusAgent` message on agent click |

---

## Implementation Order

1. **`processFocus.ts`** — Core PID resolution and window focus functions (macOS only)
2. **`AgentState` changes** — Add PID fields, initialize to null
3. **Server integration** — Resolve PIDs on agent creation, handle `focusAgent` message
4. **Client wiring** — Send `focusAgent` on agent click
5. **Testing** — Verify with Terminal.app, iTerm2, VS Code integrated terminal
6. **Polish** — Handle edge cases (stale PIDs, tmux, multiple claude processes)

---

## Not In Scope (Future)

- Linux / Windows support (straightforward to add per-platform)
- tmux pane / screen window switching
- Embedded terminal tabs in the Pixel Agents app (would bypass all PID logic)
- Launching new Claude sessions from the app
- Tab-level focusing within terminal emulators (e.g., focus specific iTerm2 tab, not just the app)
- Showing terminal name/type in the agent UI
