import { useState, useRef, useEffect } from 'react'
import { SettingsModal } from './SettingsModal.js'
import { isMusicEnabled, setMusicEnabled, getMusicVolume, setMusicVolume, unlockMusic } from '../backgroundMusic.js'
import { vscode } from '../wsApi.js'
import type { WorkspaceInfo } from '../hooks/useExtensionMessages.js'

interface BottomToolbarProps {
  isEditMode: boolean
  onToggleEditMode: () => void
  isDebugMode: boolean
  onToggleDebugMode: () => void
  petEnabled: boolean
  onTogglePet: () => void
  workspaces: WorkspaceInfo[]
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 10,
  left: 10,
  zIndex: 'var(--pixel-controls-z)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'var(--pixel-bg)',
  border: '2px solid var(--pixel-border)',
  borderRadius: 0,
  padding: '4px 6px',
  boxShadow: 'var(--pixel-shadow)',
}

const btnBase: React.CSSProperties = {
  padding: '5px 10px',
  fontSize: '24px',
  color: 'var(--pixel-text)',
  background: 'var(--pixel-btn-bg)',
  border: '2px solid transparent',
  borderRadius: 0,
  cursor: 'pointer',
}

const btnActive: React.CSSProperties = {
  ...btnBase,
  background: 'var(--pixel-active-bg)',
  border: '2px solid var(--pixel-accent)',
}


export function BottomToolbar({
  isEditMode,
  onToggleEditMode,
  isDebugMode,
  onToggleDebugMode,
  petEnabled,
  onTogglePet,
  workspaces,
}: BottomToolbarProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [musicOn, setMusicOn] = useState(isMusicEnabled)
  const [volume, setVolume] = useState(getMusicVolume)
  const [showVolume, setShowVolume] = useState(false)
  const volumeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hide volume slider after inactivity
  useEffect(() => {
    if (showVolume) {
      if (volumeTimeout.current) clearTimeout(volumeTimeout.current)
      volumeTimeout.current = setTimeout(() => setShowVolume(false), 3000)
    }
    return () => { if (volumeTimeout.current) clearTimeout(volumeTimeout.current) }
  }, [showVolume, volume])

  const handleMusicToggle = () => {
    const next = !musicOn
    setMusicOn(next)
    setMusicEnabled(next)
    if (next) {
      setShowVolume(true)
      unlockMusic()
    }
    vscode.postMessage({ type: 'setMusicEnabled', enabled: next, volume })
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    setMusicVolume(v)
    setShowVolume(true)
    vscode.postMessage({ type: 'setMusicEnabled', enabled: musicOn, volume: v })
  }

  return (
    <div style={panelStyle}>
      <button
        onClick={onToggleEditMode}
        onMouseEnter={() => setHovered('edit')}
        onMouseLeave={() => setHovered(null)}
        style={
          isEditMode
            ? { ...btnActive }
            : {
                ...btnBase,
                background: hovered === 'edit' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
              }
        }
        title="Edit office layout"
      >
        Layout
      </button>
      <button
        onClick={handleMusicToggle}
        onMouseEnter={() => { setHovered('music'); if (musicOn) setShowVolume(true) }}
        onMouseLeave={() => setHovered(null)}
        style={
          musicOn
            ? { ...btnActive }
            : {
                ...btnBase,
                background: hovered === 'music' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
              }
        }
        title={musicOn ? 'Turn music off' : 'Turn music on'}
      >
        {musicOn ? '\u266B' : '\u266A'}
      </button>
      {showVolume && musicOn && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 4px',
          }}
          onMouseEnter={() => setShowVolume(true)}
          onMouseLeave={() => {}}
        >
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            style={{
              width: 80,
              height: 4,
              accentColor: 'var(--pixel-accent)',
              cursor: 'pointer',
            }}
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsSettingsOpen((v) => !v)}
          onMouseEnter={() => setHovered('settings')}
          onMouseLeave={() => setHovered(null)}
          style={
            isSettingsOpen
              ? { ...btnActive }
              : {
                  ...btnBase,
                  background: hovered === 'settings' ? 'var(--pixel-btn-hover-bg)' : btnBase.background,
                }
          }
          title="Settings"
        >
          Settings
        </button>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          isDebugMode={isDebugMode}
          onToggleDebugMode={onToggleDebugMode}
          petEnabled={petEnabled}
          onTogglePet={onTogglePet}
          workspaces={workspaces}
        />
      </div>
    </div>
  )
}
