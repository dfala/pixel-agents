import { useState, useEffect, useCallback } from 'react'
import type { NotificationEntry } from '../office/types.js'
import {
  NOTIFICATION_PANEL_WIDTH_PX,
  NOTIFICATION_TIMESTAMP_REFRESH_MS,
} from '../constants.js'

interface NotificationPanelProps {
  notifications: NotificationEntry[]
  agents: number[]
  onSelectAgent: (agentId: number) => void
  onClose: () => void
  onClear: () => void
}

function formatRelativeTime(timestamp: number): string {
  const delta = Math.floor((Date.now() - timestamp) / 1000)
  if (delta < 5) return 'just now'
  if (delta < 60) return `${delta}s ago`
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`
  return `${Math.floor(delta / 3600)}h ago`
}

function NotificationRow({
  entry,
  isAgentAlive,
  onClick,
}: {
  entry: NotificationEntry
  isAgentAlive: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [timeStr, setTimeStr] = useState(() => formatRelativeTime(entry.timestamp))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeStr(formatRelativeTime(entry.timestamp))
    }, NOTIFICATION_TIMESTAMP_REFRESH_MS)
    return () => clearInterval(interval)
  }, [entry.timestamp])

  const isPermission = entry.type === 'permission'
  const dimmed = !isAgentAlive

  return (
    <div
      onClick={isAgentAlive ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid var(--pixel-border)',
        borderLeft: entry.read ? '2px solid transparent' : '2px solid var(--pixel-accent)',
        cursor: isAgentAlive ? 'pointer' : 'default',
        background: hovered && isAgentAlive ? 'var(--pixel-btn-hover-bg)' : 'transparent',
        opacity: dimmed ? 0.4 : 1,
      }}
    >
      {/* Event icon */}
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: isPermission ? '#d4a843' : '#4ade80',
        flexShrink: 0,
      }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
        }}>
          <span style={{
            fontSize: '17px',
            color: 'var(--pixel-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            Agent {entry.agentId}
          </span>
          <span style={{
            fontSize: '12px',
            color: 'var(--pixel-text-dim)',
            flexShrink: 0,
          }}>
            {timeStr}
          </span>
        </div>
        <div style={{
          fontSize: '12px',
          color: isPermission ? '#d4a843' : '#4ade80',
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {isPermission
            ? `Needs permission${entry.toolName ? ` \u2014 ${entry.toolName}` : ''}`
            : 'Turn complete'}
        </div>
      </div>
    </div>
  )
}

export function NotificationPanel({
  notifications,
  agents,
  onSelectAgent,
  onClose,
  onClear,
}: NotificationPanelProps) {
  const agentSet = new Set(agents)

  const handleEntryClick = useCallback((agentId: number) => {
    onSelectAgent(agentId)
  }, [onSelectAgent])

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: NOTIFICATION_PANEL_WIDTH_PX,
      maxWidth: '30vw',
      height: '100%',
      zIndex: 45,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--pixel-bg)',
      borderLeft: '2px solid var(--pixel-border)',
      boxShadow: '-2px 0 0px #0a0a14',
      animation: 'transcript-slide-in 200ms ease-out',
      pointerEvents: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 10px',
        borderBottom: '2px solid var(--pixel-border)',
        flexShrink: 0,
      }}>
        <span style={{
          flex: 1,
          fontSize: '17px',
          color: 'var(--pixel-text)',
        }}>
          Notifications
        </span>
        {notifications.length > 0 && (
          <button
            onClick={onClear}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--pixel-text-dim)',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '0 4px',
              borderRadius: 0,
            }}
            title="Clear all notifications"
          >
            Clear
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '17px',
            cursor: 'pointer',
            padding: '0 4px',
            borderRadius: 0,
          }}
          title="Close panel"
        >
          X
        </button>
      </div>

      {/* Notification entries */}
      <div
        className="transcript-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {notifications.length === 0 ? (
          <div style={{
            color: 'var(--pixel-text-dim)',
            fontSize: '17px',
            textAlign: 'center',
            padding: '20px 0',
          }}>
            No notifications yet
          </div>
        ) : (
          notifications.map((entry) => (
            <NotificationRow
              key={entry.id}
              entry={entry}
              isAgentAlive={agentSet.has(entry.agentId)}
              onClick={() => handleEntryClick(entry.agentId)}
            />
          ))
        )}
      </div>
    </div>
  )
}
