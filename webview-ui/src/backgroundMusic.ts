/**
 * Background music player — loops tracks with volume control.
 * Supports multiple tracks and switching between them.
 * Requires a user gesture to start (browser autoplay policy).
 */

export interface MusicTrack {
  id: string
  name: string
  src: string
}

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'pixelated-hearth', name: 'Pixelated Hearth', src: '/assets/Pixelated_Hearth.mp3' },
  { id: 'chiptune-loop', name: 'Chiptune Loop', src: '/assets/background-music.wav' },
]

let audio: HTMLAudioElement | null = null
let musicEnabled = false
let musicVolume = 0.3 // 0–1
let currentTrackId = MUSIC_TRACKS[0].id

function getTrackSrc(trackId: string): string {
  const track = MUSIC_TRACKS.find((t) => t.id === trackId)
  return track ? track.src : MUSIC_TRACKS[0].src
}

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(getTrackSrc(currentTrackId))
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

export function getCurrentTrackId(): string {
  return currentTrackId
}

export function setTrack(trackId: string): void {
  if (trackId === currentTrackId) return
  currentTrackId = trackId
  if (audio) {
    const wasPlaying = musicEnabled && !audio.paused
    audio.pause()
    audio.src = getTrackSrc(trackId)
    audio.load()
    if (wasPlaying) {
      audio.play().catch(() => { /* autoplay blocked */ })
    }
  }
}

/** Cycle to the next track. Returns the new track id. */
export function nextTrack(): string {
  const idx = MUSIC_TRACKS.findIndex((t) => t.id === currentTrackId)
  const nextIdx = (idx + 1) % MUSIC_TRACKS.length
  setTrack(MUSIC_TRACKS[nextIdx].id)
  return MUSIC_TRACKS[nextIdx].id
}

/** Call from any user-gesture handler to retry playback if enabled but blocked */
export function unlockMusic(): void {
  if (musicEnabled && audio && audio.paused) {
    audio.play().catch(() => { /* still blocked */ })
  }
}
