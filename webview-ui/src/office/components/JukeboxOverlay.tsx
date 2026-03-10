import { useState, useEffect } from 'react'
import type { OfficeState } from '../engine/officeState.js'
import { TILE_SIZE } from '../types.js'
import {
  isMusicEnabled,
  setMusicEnabled,
  getMusicVolume,
  setMusicVolume,
  getCurrentTrackId,
  nextTrack,
  MUSIC_TRACKS,
  unlockMusic,
} from '../../backgroundMusic.js'
import { vscode } from '../../wsApi.js'
import { getCatalogEntry } from '../layout/furnitureCatalog.js'

interface JukeboxOverlayProps {
  officeState: OfficeState
  containerRef: React.RefObject<HTMLDivElement | null>
  zoom: number
  panRef: React.RefObject<{ x: number; y: number }>
}

export function JukeboxOverlay({ officeState, containerRef, zoom, panRef }: JukeboxOverlayProps) {
  const [, setTick] = useState(0)
  const [volume, setVolume] = useState(getMusicVolume)
  const [trackId, setTrackId] = useState(getCurrentTrackId)

  // Read music state directly each frame (synced via tick re-render)
  const musicOn = isMusicEnabled()

  // Re-render each frame to track position
  useEffect(() => {
    let rafId = 0
    const tick = () => {
      setTick((n) => n + 1)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  const uid = officeState.activeJukeboxUid
  if (!uid) return null

  const jukebox = officeState.getJukeboxByUid(uid)
  if (!jukebox) return null

  const entry = getCatalogEntry(jukebox.type)
  if (!entry) return null

  const el = containerRef.current
  if (!el) return null

  const rect = el.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const canvasW = Math.round(rect.width * dpr)
  const canvasH = Math.round(rect.height * dpr)
  const layout = officeState.getLayout()
  const mapW = layout.cols * TILE_SIZE * zoom
  const mapH = layout.rows * TILE_SIZE * zoom
  const deviceOffsetX = Math.floor((canvasW - mapW) / 2) + Math.round(panRef.current.x)
  const deviceOffsetY = Math.floor((canvasH - mapH) / 2) + Math.round(panRef.current.y)

  // Position above the jukebox center
  const centerX = (jukebox.col + entry.footprintW / 2) * TILE_SIZE
  const topY = jukebox.row * TILE_SIZE
  const screenX = (deviceOffsetX + centerX * zoom) / dpr
  const screenY = (deviceOffsetY + topY * zoom) / dpr

  const currentTrack = MUSIC_TRACKS.find((t) => t.id === trackId)

  const handleToggle = () => {
    const next = !musicOn
    setMusicEnabled(next)
    if (next) unlockMusic()
    vscode.postMessage({ type: 'setMusicEnabled', enabled: next, volume })
  }

  const handleNextTrack = () => {
    const newId = nextTrack()
    setTrackId(newId)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    setMusicVolume(v)
    vscode.postMessage({ type: 'setMusicEnabled', enabled: musicOn, volume: v })
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY - 8,
        transform: 'translateX(-50%) translateY(-100%)',
        zIndex: 'var(--pixel-overlay-selected-z)',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          background: 'var(--pixel-bg)',
          border: '2px solid var(--pixel-border-light)',
          borderRadius: 0,
          padding: '6px 10px',
          boxShadow: 'var(--pixel-shadow)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minWidth: 140,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span style={{ fontSize: '20px', color: 'var(--pixel-text)', fontWeight: 'bold' }}>
            Jukebox
          </span>
          <button
            onClick={() => { officeState.activeJukeboxUid = null }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--pixel-close-text)',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '0 2px',
            }}
          >
            x
          </button>
        </div>

        {/* Track name + next button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: '18px',
              color: musicOn ? 'var(--pixel-green)' : 'var(--pixel-text-dim)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentTrack?.name ?? 'Unknown'}
          </span>
          <button
            onClick={handleNextTrack}
            style={{
              padding: '2px 6px',
              fontSize: '18px',
              background: 'var(--pixel-btn-bg)',
              color: 'var(--pixel-text)',
              border: '2px solid transparent',
              borderRadius: 0,
              cursor: 'pointer',
            }}
            title="Next track"
          >
            {'\u23ED'}
          </button>
        </div>

        {/* Play/Pause + Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handleToggle}
            style={{
              padding: '2px 8px',
              fontSize: '20px',
              background: musicOn ? 'var(--pixel-active-bg)' : 'var(--pixel-btn-bg)',
              color: 'var(--pixel-text)',
              border: musicOn ? '2px solid var(--pixel-accent)' : '2px solid transparent',
              borderRadius: 0,
              cursor: 'pointer',
            }}
            title={musicOn ? 'Pause' : 'Play'}
          >
            {musicOn ? '\u23F8' : '\u25B6'}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            style={{
              flex: 1,
              height: 4,
              accentColor: 'var(--pixel-accent)',
              cursor: 'pointer',
            }}
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        </div>
      </div>

      {/* Arrow pointing down to jukebox */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid var(--pixel-border-light)',
          margin: '0 auto',
        }}
      />
    </div>
  )
}
