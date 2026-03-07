# Notification Center

**Status: Not yet implemented**

**A scrollable log of permission requests and turn completions, with timestamps and click-to-focus.**

A slide-out panel listing every "waiting for permission" and "turn complete" event across all agents, newest first. Each entry shows the agent name, event type, and timestamp. Clicking an entry selects that agent in the office (camera follows, outline appears). Unread entries get a badge count on the toolbar button.

---

## Data Model

### New: `NotificationEntry`

```ts
interface NotificationEntry {
  id: number                        // monotonic counter
  agentId: number                   // which agent triggered this
  type: 'permission' | 'turn_complete'
  timestamp: number                 // Date.now() when event occurred
  toolName?: string                 // for permission: which tool is requesting
  read: boolean                     // whether the user has seen this entry
}
```

### Server-Side State

Global (not per-agent) notification log:

```ts
notifications: NotificationEntry[]  // ring buffer, max NOTIFICATION_MAX_ENTRIES
notificationSeq: number             // monotonic counter for entry IDs
```

Notifications are global because the panel shows events from all agents in one unified list.

---

## Server Changes

### `src/transcriptParser.ts`

Two existing events now also generate notifications:

| Existing event | Notification type | Content |
|---|---|---|
| `agentStatus: 'permission'` (permission timer fires) | `permission` | `toolName` = the tool awaiting permission (from `activeToolStatuses`) |
| `agentStatus: 'waiting'` (turn ended, system turn_duration received) | `turn_complete` | No extra fields |

On each event, push a new `NotificationEntry` to the global buffer and broadcast:

```ts
broadcast({ type: 'notification', entry })
```

Sub-agent permission events should reference the **parent** agent ID (since clicking should focus the parent's terminal), but include the sub-agent's tool name for context.

### `src/server.ts`

**On client `webviewReady`**: After sending existing agents and timelines, send the current notification buffer:

```ts
send({ type: 'notificationBuffer', entries: notifications })
```

**On `agentClosed`**: No special handling — notifications for closed agents remain in the log (they just can't be focused anymore). The click handler on the client gracefully no-ops if the agent is gone.

### `src/types.ts`

Add `NotificationEntry` interface. Add global notification state fields (or add them to whatever server state object manages cross-agent data).

### `src/constants.ts`

```ts
export const NOTIFICATION_MAX_ENTRIES = 50
```

---

## Client Changes

### `webview-ui/src/hooks/useExtensionMessages.ts`

New React state:

```ts
const [notifications, setNotifications] = useState<NotificationEntry[]>([])
const [unreadCount, setUnreadCount] = useState(0)
```

New message handlers:

- `notificationBuffer` — Replace entire list, compute unread count from `entry.read === false`
- `notification` — Prepend new entry to list (newest first), cap at `NOTIFICATION_MAX_ENTRIES`, increment `unreadCount`

Expose a `markNotificationsRead` callback that sets all entries' `read` to `true` and resets `unreadCount` to 0. This is called when the panel is opened.

Return `notifications`, `unreadCount`, and `markNotificationsRead` from the hook.

### New: `webview-ui/src/components/NotificationPanel.tsx`

A right-side panel (same position/style as the transcript panel) showing the notification log.

**Layout:**
- Fixed position: right edge, full height minus bottom toolbar
- Width: `NOTIFICATION_PANEL_WIDTH_PX` (300px)
- Z-index same layer as transcript panel (they don't coexist — opening one closes the other, or they stack)
- Scrollable, newest entries at top

**Header:**
- Title: "Notifications"
- Close button (X)
- "Clear all" button (empties the client-side list)

**Entry rendering:**

Each entry is a clickable row:

| Element | Detail |
|---|---|
| **Agent dot** | Small circle in the agent's palette color |
| **Agent name** | "Agent 1", "Agent 2", etc. |
| **Event icon** | Permission: amber dot. Turn complete: green checkmark. Reuse existing bubble sprite colors. |
| **Event text** | Permission: "Needs permission — {toolName}". Turn complete: "Turn complete" |
| **Timestamp** | Relative: "just now", "2m ago", "1h ago". Updates on a 30s interval. |
| **Unread indicator** | Unread entries have a brighter background (`var(--pixel-bg-light)`) or a small accent-colored left border |

**Click behavior:**
- Click an entry → select that agent in the office (set `selectedAgentId`, camera follows)
- If the agent has been closed, the click does nothing (row is visually dimmed)
- Clicking does NOT close the notification panel

**Empty state:** "No notifications yet" centered in the panel.

### `webview-ui/src/components/BottomToolbar.tsx`

New button: bell icon (or "Notifications" text label) next to the existing Layout and Settings buttons.

**Badge:** When `unreadCount > 0`, show a small accent-colored badge with the count on the button corner. Badge uses `var(--pixel-accent)` background, white text, `min-width: 16px`, no border-radius (pixel style, square badge).

**Click:** Toggles the notification panel open/closed. Opening calls `markNotificationsRead()`.

### `webview-ui/src/App.tsx`

- Destructure `notifications`, `unreadCount`, `markNotificationsRead` from `useExtensionMessages`
- Track `isNotificationPanelOpen` state
- Render `<NotificationPanel>` when open
- Pass: `notifications`, `onSelectAgent`, `onClose`
- When notification panel opens, close transcript panel (and vice versa) — or allow both if there's room. Simplest: mutually exclusive.

### `webview-ui/src/constants.ts`

New constants:

```ts
export const NOTIFICATION_PANEL_WIDTH_PX = 300
export const NOTIFICATION_MAX_ENTRIES = 50
export const NOTIFICATION_TIMESTAMP_REFRESH_MS = 30000
```

---

## Interaction Design

1. **Agent needs permission**: An entry appears in the notification log. If the panel is closed, the badge count increments on the toolbar button. The existing sound notification still plays independently.
2. **Agent turn completes**: Same — entry appears, badge increments if panel is closed.
3. **Open panel**: Click the notification button in the bottom toolbar. Badge clears. All entries marked as read.
4. **Click an entry**: Camera pans to that agent, agent gets selected (white outline). Transcript panel could open for that agent if desired.
5. **Multiple permission events**: Each one is its own entry. If Agent 1 needs permission 3 times, there are 3 entries (not collapsed).
6. **Agent closed**: Existing entries for that agent remain but are dimmed. Click does nothing.
7. **Clear all**: Empties the client-side list. Does not affect server buffer (new events will still arrive).
8. **Panel already open when event arrives**: New entry slides in at the top of the list. No badge — the user is already looking at the panel.
9. **Sub-agent permission**: Entry shows "Agent 1 (subtask) — Needs permission — Edit". Click focuses the parent agent.
10. **50 entry cap**: Oldest entries are dropped when the cap is reached. Typical usage (a few agents over a work session) won't hit this.

---

## Performance

- **Entry cap**: 50 entries max. DOM list is bounded.
- **Message size**: Each `notification` message is ~150 bytes. One per event — these are infrequent (seconds to minutes apart).
- **Timestamp refresh**: 30s `setInterval` to update relative times. Only runs when the panel is open.
- **No polling**: Events pushed via WebSocket on state transitions.
- **Badge update**: Simple counter increment — no DOM cost when panel is closed.

---

## Styling

Follows existing pixel art aesthetic:

- `borderRadius: 0` on panel, entries, badge, buttons
- `var(--pixel-bg)` background, `var(--pixel-border)` border (2px solid)
- `var(--pixel-shadow)` hard offset box shadow
- Pixel font (FS Pixel Sans) for all text
- Entry rows: `padding: 8px 12px`, bottom border `1px solid var(--pixel-border)`
- Hover: `var(--pixel-bg-light)` background
- Unread entries: `2px solid var(--pixel-accent)` left border
- Badge: `var(--pixel-accent)` background, white text, square, `font-size: 11px`, positioned top-right of button
- Slide-in animation: CSS transform `translateX(100%) -> translateX(0)` over 200ms (same as transcript panel)
- Permission entry accent: amber tint on the event icon
- Turn complete entry accent: green tint on the event icon

---

## Files Modified

| File | Change |
|---|---|
| `src/types.ts` | `NotificationEntry` interface, global notification state fields |
| `src/constants.ts` | `NOTIFICATION_MAX_ENTRIES` |
| `src/transcriptParser.ts` | Generate notification entries on permission and turn-complete events |
| `src/server.ts` | Send `notificationBuffer` on init, manage global notification buffer |
| `webview-ui/src/constants.ts` | Panel width, entry cap, timestamp refresh interval |
| `webview-ui/src/hooks/useExtensionMessages.ts` | `notifications` + `unreadCount` state, handlers, `markNotificationsRead` |
| `webview-ui/src/components/NotificationPanel.tsx` | New component: scrollable entry list, click-to-focus, clear all |
| `webview-ui/src/components/BottomToolbar.tsx` | Notification button with unread badge |
| `webview-ui/src/App.tsx` | Wire panel, mutual exclusion with transcript panel, pass state |

---

## Implementation Order

1. **Data model** — Add `NotificationEntry` to `src/types.ts`, add global buffer + counter
2. **Server generation** — Emit notification entries from `transcriptParser.ts` on permission/turn-complete
3. **Server messaging** — Broadcast `notification`, send `notificationBuffer` on init
4. **Client state** — Add `notifications`/`unreadCount` to `useExtensionMessages`
5. **NotificationPanel component** — Entry list rendering, click-to-focus, timestamps, empty state
6. **Bottom toolbar button** — Bell/label button with unread badge
7. **App integration** — Wire panel, mutual exclusion with transcript panel
8. **Polish** — Slide animation, dimmed closed-agent entries, clear all, timestamp refresh

---

## Not In Scope (Future)

- Filtering by event type (permission only, turn complete only)
- Filtering by agent
- Desktop/OS-level notifications (outside the webview)
- Notification sounds per event type (currently one shared sound)
- Collapsing repeated events from the same agent ("Agent 1 — 3 permissions")
- Persisting notifications across page reloads
- Notification preferences (mute specific agents or event types)
- Linking notification entries to specific transcript lines
