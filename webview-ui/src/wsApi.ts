type MessageHandler = (msg: MessageEvent) => void

const handlers = new Set<MessageHandler>()
let ws: WebSocket | null = null
let queue: unknown[] = []
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function getWsUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  // In dev (Vite HMR on 5173), connect directly to backend on port 4800
  if (import.meta.env.DEV) {
    return `${protocol}//${location.hostname}:4800`
  }
  return `${protocol}//${location.host}`
}

function connect(): void {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return

  ws = new WebSocket(getWsUrl())

  ws.onopen = () => {
    // Flush queued messages
    for (const msg of queue) {
      ws!.send(JSON.stringify(msg))
    }
    queue = []
  }

  ws.onmessage = (raw) => {
    try {
      const data = JSON.parse(raw.data as string)
      // Wrap in MessageEvent-like object for compatibility with existing handler code
      const event = { data } as MessageEvent
      for (const handler of handlers) {
        handler(event)
      }
    } catch (err) {
      console.error('[wsApi] Failed to parse message:', err)
    }
  }

  ws.onclose = () => {
    ws = null
    // Auto-reconnect after 2s
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
        // Re-send webviewReady on reconnect
        vscode.postMessage({ type: 'webviewReady' })
      }, 2000)
    }
  }

  ws.onerror = () => {
    // onclose will fire after this
  }
}

// Start connection immediately
connect()

/** Drop-in replacement for acquireVsCodeApi() */
export const vscode = {
  postMessage(msg: unknown): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    } else {
      queue.push(msg)
    }
  },
}

/** Register a message listener (replaces window.addEventListener('message', ...)) */
export function addMessageListener(handler: MessageHandler): void {
  handlers.add(handler)
}

/** Remove a message listener (replaces window.removeEventListener('message', ...)) */
export function removeMessageListener(handler: MessageHandler): void {
  handlers.delete(handler)
}
