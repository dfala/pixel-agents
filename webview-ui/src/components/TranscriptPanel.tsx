import { useRef, useEffect, useState, useCallback } from 'react'
import type { TranscriptEntry } from '../office/types.js'
import {
  TRANSCRIPT_PANEL_WIDTH_PX,
  TRANSCRIPT_SLIDE_DURATION_MS,
  TRANSCRIPT_AUTOSCROLL_THRESHOLD_PX,
} from '../constants.js'

interface TranscriptPanelProps {
  agentId: number
  entries: TranscriptEntry[]
  agentLabel: string
  hasActiveTools: boolean
  hasPermission: boolean
  onClose: () => void
}

function formatRelativeTime(timestamp: number): string {
  const delta = Math.floor((Date.now() - timestamp) / 1000)
  if (delta < 5) return 'just now'
  if (delta < 60) return `${delta}s ago`
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`
  return `${Math.floor(delta / 3600)}h ago`
}

function TranscriptEntryRow({ entry }: { entry: TranscriptEntry }) {
  const [showTime, setShowTime] = useState(false)

  if (entry.type === 'turn_end') {
    return (
      <div style={{
        borderTop: '1px solid var(--pixel-border)',
        margin: '6px 0',
        padding: '4px 0 0',
        fontSize: '24px',
        color: 'var(--pixel-text-dim)',
        opacity: 0.6,
      }}>
        Waiting for input...
      </div>
    )
  }

  if (entry.type === 'assistant_text') {
    return (
      <div
        onMouseEnter={() => setShowTime(true)}
        onMouseLeave={() => setShowTime(false)}
        style={{ margin: '4px 0', position: 'relative' }}
      >
        <div style={{
          fontSize: '24px',
          color: 'var(--pixel-text)',
          lineHeight: 1.3,
          wordBreak: 'break-word',
        }}>
          {entry.text}
        </div>
        {showTime && (
          <span style={{
            position: 'absolute',
            top: 0,
            right: 0,
            fontSize: '14px',
            color: 'var(--pixel-text-dim)',
            opacity: 0.7,
          }}>
            {formatRelativeTime(entry.timestamp)}
          </span>
        )}
      </div>
    )
  }

  if (entry.type === 'tool_call') {
    return (
      <div
        onMouseEnter={() => setShowTime(true)}
        onMouseLeave={() => setShowTime(false)}
        style={{ margin: '4px 0', position: 'relative' }}
      >
        <span style={{
          display: 'inline-block',
          background: 'rgba(90, 140, 255, 0.2)',
          border: '1px solid var(--pixel-accent)',
          padding: '1px 5px',
          fontSize: '14px',
          color: 'var(--pixel-accent)',
          marginRight: 5,
          fontFamily: 'monospace',
        }}>
          {entry.toolName}
        </span>
        <span style={{
          fontSize: '14px',
          color: 'var(--pixel-text-dim)',
          fontFamily: 'monospace',
          wordBreak: 'break-word',
        }}>
          {entry.toolArgs}
        </span>
        {showTime && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            fontSize: '14px', color: 'var(--pixel-text-dim)', opacity: 0.7,
          }}>
            {formatRelativeTime(entry.timestamp)}
          </span>
        )}
      </div>
    )
  }

  if (entry.type === 'tool_result') {
    return (
      <div
        onMouseEnter={() => setShowTime(true)}
        onMouseLeave={() => setShowTime(false)}
        style={{
          margin: '2px 0 4px 12px',
          position: 'relative',
        }}
      >
        <div style={{
          fontSize: '14px',
          color: entry.isError ? '#e55' : 'var(--pixel-text-dim)',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          opacity: 0.8,
          maxHeight: 120,
          overflow: 'hidden',
          maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
        }}>
          {entry.output || (entry.isError ? 'Error (no output)' : '(empty result)')}
        </div>
        {showTime && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            fontSize: '14px', color: 'var(--pixel-text-dim)', opacity: 0.7,
          }}>
            {formatRelativeTime(entry.timestamp)}
          </span>
        )}
      </div>
    )
  }

  return null
}

export function TranscriptPanel({
  agentId,
  entries,
  agentLabel,
  hasActiveTools,
  hasPermission,
  onClose,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [showNewPill, setShowNewPill] = useState(false)
  const prevEntryCountRef = useRef(entries.length)

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - TRANSCRIPT_AUTOSCROLL_THRESHOLD_PX
    setIsAtBottom(atBottom)
    if (atBottom) setShowNewPill(false)
  }, [])

  // Auto-scroll on new entries (only if at bottom)
  useEffect(() => {
    if (entries.length > prevEntryCountRef.current) {
      if (isAtBottom) {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      } else {
        setShowNewPill(true)
      }
    }
    prevEntryCountRef.current = entries.length
  }, [entries.length, isAtBottom])

  // Scroll to bottom when agent changes
  useEffect(() => {
    setIsAtBottom(true)
    setShowNewPill(false)
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    })
  }, [agentId])

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    setIsAtBottom(true)
    setShowNewPill(false)
  }

  // Status dot color
  let dotColor: string | null = null
  if (hasPermission) {
    dotColor = '#d4a843' // amber for permission
  } else if (hasActiveTools) {
    dotColor = '#4ade80' // green for active
  }

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: TRANSCRIPT_PANEL_WIDTH_PX,
      maxWidth: '30vw',
      height: '100%',
      zIndex: 45,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--pixel-bg)',
      borderLeft: '2px solid var(--pixel-border)',
      boxShadow: '-2px 0 0px #0a0a14',
      animation: `transcript-slide-in ${TRANSCRIPT_SLIDE_DURATION_MS}ms ease-out`,
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
        {dotColor && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: dotColor, flexShrink: 0,
          }} />
        )}
        <span style={{
          flex: 1,
          fontSize: '24px',
          color: 'var(--pixel-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {agentLabel}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0 4px',
            borderRadius: 0,
          }}
          title="Close panel"
        >
          X
        </button>
      </div>

      {/* Transcript entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="transcript-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '6px 8px',
        }}
      >
        {entries.length === 0 ? (
          <div style={{
            color: 'var(--pixel-text-dim)',
            fontSize: '24px',
            textAlign: 'center',
            padding: '20px 0',
          }}>
            No activity yet
          </div>
        ) : (
          entries.map((entry) => (
            <TranscriptEntryRow key={entry.id} entry={entry} />
          ))
        )}
      </div>

      {/* New activity pill */}
      {showNewPill && (
        <button
          onClick={scrollToBottom}
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--pixel-accent)',
            color: '#fff',
            border: '2px solid var(--pixel-border)',
            borderRadius: 0,
            padding: '3px 10px',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: 'var(--pixel-shadow)',
            zIndex: 1,
          }}
        >
          {'\u2193'} New activity
        </button>
      )}
    </div>
  )
}
