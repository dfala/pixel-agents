import { useState } from 'react'
import type { WorkspaceInfo } from '../hooks/useExtensionMessages.js'
import { vscode } from '../wsApi.js'
import { WORKSPACE_COLORS } from '../constants.js'

interface WorkspaceManagerProps {
  workspaces: WorkspaceInfo[]
}

export function WorkspaceManager({ workspaces }: WorkspaceManagerProps) {
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  if (workspaces.length === 0) {
    return (
      <div style={{ padding: '6px 10px', fontSize: '20px', color: 'var(--pixel-text-dim)' }}>
        No agents active
      </div>
    )
  }

  const handleLabelClick = (projectLabel: string, currentLabel: string) => {
    setEditingLabel(projectLabel)
    setEditValue(currentLabel)
    setColorPickerOpen(null)
  }

  const handleLabelSubmit = (projectLabel: string) => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== workspaces.find((w) => w.projectLabel === projectLabel)?.label) {
      vscode.postMessage({ type: 'updateWorkspace', projectLabel, label: trimmed })
    }
    setEditingLabel(null)
  }

  const handleColorClick = (projectLabel: string) => {
    setColorPickerOpen((prev) => (prev === projectLabel ? null : projectLabel))
    setEditingLabel(null)
  }

  const handleColorSelect = (projectLabel: string, color: string) => {
    vscode.postMessage({ type: 'updateWorkspace', projectLabel, color })
    setColorPickerOpen(null)
  }

  return (
    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
      {workspaces.map((ws) => (
        <div
          key={ws.projectLabel}
          onMouseEnter={() => setHovered(ws.projectLabel)}
          onMouseLeave={() => setHovered(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            background: hovered === ws.projectLabel ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
          }}
        >
          {/* Color swatch */}
          <button
            onClick={() => handleColorClick(ws.projectLabel)}
            style={{
              width: 14,
              height: 14,
              background: ws.color,
              border: colorPickerOpen === ws.projectLabel ? '2px solid #fff' : '2px solid var(--pixel-border)',
              borderRadius: 0,
              cursor: 'pointer',
              flexShrink: 0,
              padding: 0,
            }}
            title="Change color"
          />

          {/* Label (inline editable) */}
          {editingLabel === ws.projectLabel ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleLabelSubmit(ws.projectLabel)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLabelSubmit(ws.projectLabel)
                if (e.key === 'Escape') setEditingLabel(null)
              }}
              style={{
                flex: 1,
                fontSize: '20px',
                color: '#fff',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--pixel-border-light)',
                borderRadius: 0,
                padding: '1px 4px',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          ) : (
            <span
              onClick={() => handleLabelClick(ws.projectLabel, ws.label)}
              style={{
                flex: 1,
                fontSize: '20px',
                color: 'rgba(255, 255, 255, 0.8)',
                cursor: 'text',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={ws.projectLabel}
            >
              {ws.label}
            </span>
          )}
        </div>
      ))}

      {/* Color picker dropdown */}
      {colorPickerOpen && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '6px 10px',
            flexWrap: 'wrap',
          }}
        >
          {WORKSPACE_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleColorSelect(colorPickerOpen, color)}
              style={{
                width: 18,
                height: 18,
                background: color,
                border: workspaces.find((w) => w.projectLabel === colorPickerOpen)?.color === color
                  ? '2px solid #fff'
                  : '2px solid var(--pixel-border)',
                borderRadius: 0,
                cursor: 'pointer',
                padding: 0,
              }}
              title={color}
            />
          ))}
        </div>
      )}
    </div>
  )
}
