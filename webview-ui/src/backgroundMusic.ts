/**
 * Background music player — loops an mp3 with volume control.
 * Requires a user gesture to start (browser autoplay policy).
 */

let audio: HTMLAudioElement | null = null
let musicEnabled = false
let musicVolume = 0.3 // 0–1

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    // In dev mode Vite serves from /assets/, in prod the server does too
    audio = new Audio('/assets/Pixelated_Hearth.mp3')
    audio.loop = true
    audio.volume = musicVolume
  }
  return audio
}

export function setMusicEnabled(enabled: boolean): void {
  musicEnabled = enabled
  const a = ensureAudio()
  if (enabled) {
    a.volume = musicVolume
    a.play().catch(() => {
      // Autoplay blocked — will retry on next user gesture
    })
  } else {
    a.pause()
  }
}

export function isMusicEnabled(): boolean {
  return musicEnabled
}

export function setMusicVolume(vol: number): void {
  musicVolume = Math.max(0, Math.min(1, vol))
  if (audio) {
    audio.volume = musicVolume
  }
}

export function getMusicVolume(): number {
  return musicVolume
}

/** Call from any user-gesture handler to retry playback if enabled but blocked */
export function unlockMusic(): void {
  if (musicEnabled && audio && audio.paused) {
    audio.play().catch(() => { /* still blocked */ })
  }
}
