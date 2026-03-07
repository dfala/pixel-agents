# Multi-Workspace Support

**Status: Not yet implemented**

**Monitor Claude sessions across multiple project directories, color-coded by workspace.**

Instead of only tracking agents in the current workspace, Pixel Agents can watch Claude sessions from multiple project directories simultaneously. Each workspace gets a distinct color badge so you can tell at a glance which project an agent belongs to. Agents from different workspaces coexist in the same office — you can see your entire fleet of Claude sessions in one view.

---

## Core Concept

Currently, the extension watches one JSONL directory: `~/.claude/projects/<current-project-hash>/`. Multi-workspace extends this to watch N directories, one per registered workspace. Each workspace has a short label and a color. Agent characters show their workspace color as a small badge, and the transcript/notification panels include workspace context.

---

## Data Model

### New: `Workspace`

```ts
interface Workspace {
  id: string              // stable identifier (hash of the absolute path)
  path: string            // absolute directory path (e.g., "/Users/me/code/my-app")
  label: string           // short display name (defaults to directory basename)
  color: string           // hex color for the workspace badge
  jsonlDir: string        // resolved ~/.claude/projects/<hash>/ path
}
```

### New: `WorkspaceConfig`

Persisted to `~/.pixel-agents/workspaces.json`:

```ts
interface WorkspaceConfig {
  version: 1
  workspaces: Array<{
    path: string
    label?: string        // user override; defaults to basename
    color?: string        // user override; defaults to auto-assigned
  }>
}
```

The current workspace is always implicitly included (no need to add it manually).

### Extended: `AgentState`

Add to each agent:

```ts
workspaceId: string       // which workspace this agent belongs to
```

### Extended: `PersistedAgent`

Add:

```ts
workspaceId: string
```

---

## Workspace Colors

Auto-assigned from a fixed palette of 8 distinct colors, cycling as workspaces are added:

```ts
const WORKSPACE_COLORS = [
  '#4ec9b0', // teal (current workspace default)
  '#ce9178', // orange
  '#c586c0', // purple
  '#9cdcfe', // light blue
  '#dcdcaa', // yellow
  '#f48771', // red
  '#89d185', // green
  '#d4d4d4', // gray
]
```

The current workspace always gets index 0 (teal). Additional workspaces are assigned colors in order. Users can override via the workspace manager UI.

Add to `webview-ui/src/constants.ts`:

```ts
export const WORKSPACE_COLORS = [
  '#4ec9b0', '#ce9178', '#c586c0', '#9cdcfe',
  '#dcdcaa', '#f48771', '#89d185', '#d4d4d4',
]
```

---

## Server Changes

### New: `src/workspaceManager.ts`

Manages the set of watched workspaces.

**Responsibilities:**
- Load/save `~/.pixel-agents/workspaces.json`
- Resolve each workspace path to its JSONL directory (`~/.claude/projects/<hash>/`)
- Provide the list of active workspaces to the file watcher and agent manager
- Handle add/remove workspace commands from the webview

**Key functions:**

```ts
loadWorkspaces(): Workspace[]
addWorkspace(path: string, label?: string): Workspace
removeWorkspace(id: string): void
updateWorkspace(id: string, updates: { label?: string; color?: string }): void
getJsonlDir(workspacePath: string): string  // compute project hash → dir
```

**Project hash computation**: Reuse the existing logic that converts a workspace path to the `~/.claude/projects/` subdirectory name (replacing `:`/`\`/`/` with `-`).

### Modified: `src/fileWatcher.ts`

Currently watches one directory. Change to watch N directories (one per workspace):

- `startWatching(workspaces: Workspace[])` — creates a watcher per workspace JSONL dir
- Each watcher's scan loop tags discovered sessions with the `workspaceId`
- `stopWatching(workspaceId: string)` — tears down a single workspace's watcher
- JSONL file discovery and adoption logic unchanged per-workspace, just multiplied

**File watcher lifecycle:**
- On startup: watch all configured workspaces
- On `addWorkspace`: start watching the new directory
- On `removeWorkspace`: stop watching, close agents from that workspace (or keep them as orphaned/read-only)

### Modified: `src/agentManager.ts`

- `createAgent()` accepts `workspaceId` parameter
- `launchTerminal()` sets the terminal `cwd` to the workspace path (not the current VS Code workspace)
- Agent creation message includes `workspaceId`
- Terminal adoption scan runs per-workspace JSONL directory

### Modified: `src/server.ts`

New messages:

| Message | Direction | Content |
|---|---|---|
| `workspacesLoaded` | server → client | Full list of `Workspace[]` on init |
| `addWorkspace` | client → server | `{ path: string }` |
| `removeWorkspace` | client → server | `{ workspaceId: string }` |
| `updateWorkspace` | client → server | `{ workspaceId: string, label?: string, color?: string }` |
| `workspaceAdded` | server → client | Single `Workspace` after successful add |
| `workspaceRemoved` | server → client | `{ workspaceId: string }` |
| `workspaceUpdated` | server → client | Updated `Workspace` |

**On `addWorkspace`**: Validate the path exists and is a directory. Compute the JSONL dir. If the JSONL dir doesn't exist, warn but still add (the user may not have run Claude there yet). Start watching. Broadcast `workspaceAdded`.

**On `removeWorkspace`**: Stop watching. Optionally close agents from that workspace (or mark them as disconnected). Remove from config. Broadcast `workspaceRemoved`.

**Agent creation**: `agentCreated` message now includes `workspaceId`. `existingAgents` includes `workspaceId` per agent.

### `src/types.ts`

Add `Workspace` and `WorkspaceConfig` interfaces. Add `workspaceId` to `AgentState` and `PersistedAgent`.

### `src/constants.ts`

```ts
export const WORKSPACES_FILE = 'workspaces.json'
export const MAX_WORKSPACES = 10
```

---

## Client Changes

### `webview-ui/src/hooks/useExtensionMessages.ts`

New React state:

```ts
const [workspaces, setWorkspaces] = useState<Workspace[]>([])
```

New message handlers:

- `workspacesLoaded` — Set full workspace list
- `workspaceAdded` — Append to list
- `workspaceRemoved` — Filter out by ID
- `workspaceUpdated` — Replace matching entry

Existing `agentCreated` / `existingAgents` handlers extract `workspaceId` and store it on the agent.

Return `workspaces` from the hook.

### Modified: `webview-ui/src/office/engine/renderer.ts`

**Workspace badge on characters:**

Below or beside the character's activity label, render a small colored rectangle (workspace badge):
- Size: 4x2 sprite pixels (scaled by zoom), rendered as a filled rect
- Color: the workspace's assigned color
- Position: bottom-left of the character sprite, offset 1px from edge
- Only rendered when more than one workspace is active (no badge needed for single-workspace use)

This is canvas-rendered, not DOM, to stay consistent with character rendering.

### Modified: `webview-ui/src/office/components/ToolOverlay.tsx`

When multiple workspaces are active, the full (non-compact) label includes the workspace label:

```
[teal dot] my-app
Reading file.ts
Agent 1
```

The workspace name appears as the top line in a dimmer color, with a small colored dot matching the workspace color. Compact labels remain unchanged (just the activity text).

### New: `webview-ui/src/components/WorkspaceManager.tsx`

Accessed from the Settings modal (new tab/section: "Workspaces").

**Layout:**
- List of current workspaces, each showing:
  - Color swatch (clickable to change)
  - Label (editable inline)
  - Path (dimmed, truncated with ellipsis)
  - Remove button (X) — disabled for the current workspace
- "Add Workspace" button at the bottom
  - Opens a path input field (text input with browse button if available)
  - On confirm: sends `addWorkspace` message

**Current workspace** is listed first with a "(current)" suffix and cannot be removed.

**Color picker:** Clicking the color swatch shows the 8 workspace colors as a small grid of squares. Click to assign.

### Modified: `webview-ui/src/components/SettingsModal.tsx`

Add a "Workspaces" section/tab that renders `<WorkspaceManager>`.

### Modified: `webview-ui/src/components/BottomToolbar.tsx`

The "+ Agent" button gains a workspace selector when multiple workspaces are configured:

- Single workspace: button works exactly as today (creates agent in current workspace)
- Multiple workspaces: clicking "+ Agent" shows a small dropdown listing workspaces (color dot + label). Clicking a workspace creates the agent there.

### Modified: `webview-ui/src/components/NotificationPanel.tsx` (if implemented)

Notification entries include the workspace color dot before the agent name.

### Modified: `webview-ui/src/components/TimelinePanel.tsx` (if implemented)

Timeline rows include a workspace color dot in the label column.

### `webview-ui/src/constants.ts`

```ts
export const WORKSPACE_BADGE_W = 4   // sprite pixels
export const WORKSPACE_BADGE_H = 2   // sprite pixels
export const MAX_WORKSPACES = 10
```

---

## Terminal Working Directory

When launching a terminal for a non-current workspace, the terminal's `cwd` must be set to that workspace's path. This ensures `claude` starts in the correct project context.

```ts
const terminal = vscode.window.createTerminal({
  name: `Claude ${index}`,
  cwd: workspace.path,  // not vscode.workspace.rootPath
})
```

For the current workspace this is unchanged. For external workspaces, the user needs to have the target directory accessible from their machine (no remote/container support needed initially).

---

## JSONL Directory Resolution

The Claude CLI stores sessions at `~/.claude/projects/<hash>/`. The hash is the workspace path with `:`/`\`/`/` replaced by `-`. This logic already exists in the codebase for the current workspace — `workspaceManager.ts` reuses it for arbitrary paths:

```ts
function projectHash(workspacePath: string): string {
  return workspacePath.replace(/[:\\/]/g, '-')
}

function getJsonlDir(workspacePath: string): string {
  return path.join(os.homedir(), '.claude', 'projects', projectHash(workspacePath))
}
```

If the computed directory doesn't exist, the workspace is still tracked but shows no agents until the user runs Claude there.

---

## Interaction Design

1. **Single workspace (default)**: No visible change. No badges, no workspace labels. Everything works as today.
2. **Add second workspace**: Open Settings → Workspaces → Add Workspace → enter/browse path. Workspace appears in the list with auto-assigned color. File watcher starts scanning. Existing agents from that project appear in the office with spawn effects.
3. **Agents from different workspaces**: Characters coexist in the office. Each has a small colored badge at their feet. Hovering/selecting shows the workspace label in the full overlay.
4. **Create agent in specific workspace**: Click "+ Agent" → dropdown appears → pick workspace → terminal opens with `cwd` set to that workspace path.
5. **Remove workspace**: Settings → Workspaces → click X on a workspace. Its agents are removed from the office (despawn effects). File watcher stops.
6. **Rename workspace**: Click the label in the workspace manager, type a new name. Updates everywhere.
7. **Change workspace color**: Click the color swatch, pick from the 8-color palette. Badge and overlay dot update immediately.
8. **Workspace has no agents yet**: It appears in the workspace list but no characters are shown. When the user runs Claude in that directory, agents appear automatically (existing terminal adoption logic).
9. **Same agent appears in two VS Code windows**: No conflict — each window manages its own agent state. The JSONL files are shared but read-only watching is safe.
10. **Path doesn't exist**: Validation error when adding. "Directory not found."
11. **JSONL dir doesn't exist**: Workspace is added but shows "(no sessions)" in the manager. Watcher starts but finds nothing until Claude is run there.

---

## Persistence

- `~/.pixel-agents/workspaces.json` stores the workspace list (shared across VS Code windows, like the layout file)
- Agent seat assignments persist per agent (including `workspaceId`) in VS Code `workspaceState`
- Workspace colors/labels persist in the config file
- On startup: load workspaces → start watchers → discover agents → restore seats

---

## Performance

- **File watchers**: One `fs.watch` + polling pair per workspace. Typically 1-3 workspaces. Each watcher is independent and lightweight.
- **Agent cap**: No hard limit on total agents, but the office practically fits ~10-15 characters before it gets crowded. This is a UX limit, not a technical one.
- **Message overhead**: `workspacesLoaded` sent once on init. Workspace changes are rare (user-initiated). No ongoing cost.
- **Badge rendering**: One small filled rect per character per frame. Negligible canvas cost.
- **Config file I/O**: Read on startup, written on workspace add/remove/update. Atomic write via `.tmp` + rename (same as layout persistence).

---

## Styling

Follows existing pixel art aesthetic:

- Workspace manager list: `var(--pixel-bg)` rows, `var(--pixel-border)` dividers
- Color swatches: 16x16px squares, `2px solid var(--pixel-border)`, selected swatch has `var(--pixel-accent)` border
- Add Workspace button: same style as "+ Agent" button
- Remove button: red X, same style as furniture delete button
- Path text: `var(--pixel-text-dim)`, monospace, truncated with ellipsis
- Workspace dropdown on "+ Agent": `var(--pixel-bg)`, `2px solid var(--pixel-border)`, hard shadow, each row has color dot + label
- Character badge: solid color rect, no border (small enough that a border would obscure it)

---

## Files Modified

| File | Change |
|---|---|
| `src/types.ts` | `Workspace`, `WorkspaceConfig` interfaces, `workspaceId` on `AgentState`/`PersistedAgent` |
| `src/constants.ts` | `WORKSPACES_FILE`, `MAX_WORKSPACES` |
| `src/workspaceManager.ts` | New file: load/save/add/remove/update workspaces, project hash resolution |
| `src/fileWatcher.ts` | Watch N directories, tag discoveries with `workspaceId`, per-workspace start/stop |
| `src/agentManager.ts` | Accept `workspaceId`, set terminal `cwd` to workspace path |
| `src/server.ts` | Workspace messages, init with `workspacesLoaded`, wire workspace commands |
| `webview-ui/src/constants.ts` | `WORKSPACE_COLORS`, badge dimensions, `MAX_WORKSPACES` |
| `webview-ui/src/hooks/useExtensionMessages.ts` | `workspaces` state, workspace message handlers |
| `webview-ui/src/office/engine/renderer.ts` | Workspace color badge on characters |
| `webview-ui/src/office/components/ToolOverlay.tsx` | Workspace label + dot in full overlay |
| `webview-ui/src/components/WorkspaceManager.tsx` | New component: workspace list, add/remove/edit/color |
| `webview-ui/src/components/SettingsModal.tsx` | "Workspaces" section rendering WorkspaceManager |
| `webview-ui/src/components/BottomToolbar.tsx` | Workspace dropdown on "+ Agent" when multi-workspace |

---

## Implementation Order

1. **Data model** — `Workspace`/`WorkspaceConfig` types, `workspaceId` on agent types
2. **Workspace manager** — New `workspaceManager.ts`: load/save config, project hash, CRUD
3. **File watcher** — Refactor to watch N directories, per-workspace lifecycle
4. **Agent manager** — Accept `workspaceId`, set terminal `cwd`
5. **Server messaging** — `workspacesLoaded` on init, add/remove/update handlers
6. **Client state** — `workspaces` in `useExtensionMessages`
7. **Workspace manager UI** — Settings modal section with list, add, remove, color picker
8. **Character badges** — Canvas-rendered workspace color badge when multi-workspace
9. **ToolOverlay** — Workspace label in full overlay
10. **"+ Agent" dropdown** — Workspace selector on the toolbar button
11. **Polish** — Integrate with notification/timeline panels if present, empty states

---

## Not In Scope (Future)

- Remote workspace support (SSH, containers, WSL)
- Per-workspace office layouts (separate rooms/floors)
- Workspace grouping or folders
- Auto-discovering workspaces from recent VS Code history
- Workspace-level agent limits
- Cross-workspace sub-agent tracking (sub-agent in workspace A spawned by agent in workspace B)
- Syncing workspace config across machines
- Workspace-specific notification preferences
