/**
 * Generate a simple lo-fi chiptune background loop as a WAV file.
 * Replaces the privately licensed Pixelated_Hearth.mp3.
 *
 * Run: node scripts/generate-music.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_RATE = 22050; // lo-fi sample rate
const BPM = 75;
const BEAT = 60 / BPM; // seconds per beat
const LOOP_BARS = 8;
const BEATS_PER_BAR = 4;
const LOOP_DURATION = LOOP_BARS * BEATS_PER_BAR * BEAT;
const TOTAL_SAMPLES = Math.floor(LOOP_DURATION * SAMPLE_RATE);

// Note frequencies (Hz)
const NOTES = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
};

// Simple square wave with envelope
function squareWave(t, freq) {
  return Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
}

// Triangle wave
function triWave(t, freq) {
  const p = (t * freq) % 1;
  return 4 * Math.abs(p - 0.5) - 1;
}

// Simple ADSR envelope
function envelope(t, duration, attack = 0.02, decay = 0.1, sustain = 0.4, release = 0.15) {
  const releaseStart = duration - release;
  if (t < attack) return t / attack;
  if (t < attack + decay) return 1 - (1 - sustain) * ((t - attack) / decay);
  if (t < releaseStart) return sustain;
  if (t < duration) return sustain * (1 - (t - releaseStart) / release);
  return 0;
}

// Bass envelope (plucky)
function bassEnv(t, duration) {
  if (t < 0.005) return t / 0.005;
  const decay = Math.exp(-t * 4);
  if (t > duration - 0.05) return decay * ((duration - t) / 0.05);
  return decay;
}

// Melody pattern (pentatonic, dreamy)
const melodyPattern = [
  // Bar 1-2: ascending
  { note: 'E4', start: 0, dur: 1.5 },
  { note: 'G4', start: 2, dur: 1 },
  { note: 'A4', start: 3, dur: 1 },
  { note: 'C5', start: 4, dur: 2 },
  { note: 'B4', start: 6, dur: 1 },
  { note: 'G4', start: 7, dur: 1 },
  // Bar 3-4: gentle descent
  { note: 'A4', start: 8, dur: 1.5 },
  { note: 'E4', start: 10, dur: 1 },
  { note: 'G4', start: 11, dur: 1 },
  { note: 'D4', start: 12, dur: 2 },
  { note: 'E4', start: 14, dur: 2 },
  // Bar 5-6: variation
  { note: 'C5', start: 16, dur: 1 },
  { note: 'D5', start: 17, dur: 1 },
  { note: 'E5', start: 18, dur: 2 },
  { note: 'D5', start: 20, dur: 1 },
  { note: 'C5', start: 21, dur: 1 },
  { note: 'A4', start: 22, dur: 2 },
  // Bar 7-8: resolve
  { note: 'G4', start: 24, dur: 1.5 },
  { note: 'E4', start: 26, dur: 1 },
  { note: 'D4', start: 27, dur: 1 },
  { note: 'C4', start: 28, dur: 3 },
  { note: 'E4', start: 31, dur: 1 },
];

// Bass pattern (root notes)
const bassPattern = [
  // Bars 1-2: C-G
  { note: 'C3', start: 0, dur: 0.8 },
  { note: 'C3', start: 2, dur: 0.8 },
  { note: 'G3', start: 4, dur: 0.8 },
  { note: 'G3', start: 6, dur: 0.8 },
  // Bars 3-4: A-D
  { note: 'A3', start: 8, dur: 0.8 },
  { note: 'A3', start: 10, dur: 0.8 },
  { note: 'D3', start: 12, dur: 0.8 },
  { note: 'D3', start: 14, dur: 0.8 },
  // Bars 5-6: C-A
  { note: 'C3', start: 16, dur: 0.8 },
  { note: 'C3', start: 18, dur: 0.8 },
  { note: 'A3', start: 20, dur: 0.8 },
  { note: 'A3', start: 22, dur: 0.8 },
  // Bars 7-8: G-C
  { note: 'G3', start: 24, dur: 0.8 },
  { note: 'G3', start: 26, dur: 0.8 },
  { note: 'C3', start: 28, dur: 0.8 },
  { note: 'C3', start: 30, dur: 0.8 },
];

// Arpeggio pattern (gentle background texture)
const arpPattern = [];
for (let bar = 0; bar < 8; bar++) {
  const roots = ['C4', 'G4', 'A4', 'D4', 'C4', 'A4', 'G4', 'C4'];
  const note = roots[bar];
  for (let i = 0; i < 4; i++) {
    arpPattern.push({ note, start: bar * 4 + i + 0.5, dur: 0.3 });
  }
}

// Render audio
const buffer = new Float32Array(TOTAL_SAMPLES);

function renderNote(pattern, waveFn, volume, envFn) {
  for (const { note, start, dur } of pattern) {
    const freq = NOTES[note];
    if (!freq) continue;
    const startBeat = start * BEAT;
    const duration = dur * BEAT;
    const startSample = Math.floor(startBeat * SAMPLE_RATE);
    const endSample = Math.min(Math.floor((startBeat + duration) * SAMPLE_RATE), TOTAL_SAMPLES);

    for (let i = startSample; i < endSample; i++) {
      const t = (i - startSample) / SAMPLE_RATE;
      const env = envFn(t, duration);
      const wave = waveFn(t, freq);
      buffer[i] += wave * env * volume;
    }
  }
}

// Render melody (square wave, quiet)
renderNote(melodyPattern, squareWave, 0.08, envelope);

// Render bass (triangle wave)
renderNote(bassPattern, triWave, 0.12, bassEnv);

// Render arpeggios (triangle wave, very quiet)
renderNote(arpPattern, triWave, 0.04, (t, dur) => envelope(t, dur, 0.01, 0.05, 0.2, 0.1));

// Soft clipping and normalization
let maxVal = 0;
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  // Soft clip
  buffer[i] = Math.tanh(buffer[i]);
  maxVal = Math.max(maxVal, Math.abs(buffer[i]));
}
if (maxVal > 0) {
  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    buffer[i] = (buffer[i] / maxVal) * 0.7; // normalize to 70%
  }
}

// Write as WAV
function writeWav(samples, sampleRate, outPath) {
  const numSamples = samples.length;
  const bytesPerSample = 2; // 16-bit
  const dataSize = numSamples * bytesPerSample;
  const headerSize = 44;
  const buf = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);

  // fmt chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
  buf.writeUInt16LE(bytesPerSample, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    const intVal = Math.floor(val * 32767);
    buf.writeInt16LE(intVal, headerSize + i * bytesPerSample);
  }

  fs.writeFileSync(outPath, buf);
}

const outPath = path.join(__dirname, '..', 'webview-ui', 'public', 'assets', 'background-music.wav');
writeWav(buffer, SAMPLE_RATE, outPath);

const durationSec = LOOP_DURATION.toFixed(1);
const fileSizeKb = Math.round(fs.statSync(outPath).size / 1024);
console.log(`✅ Generated background-music.wav (${durationSec}s loop, ${fileSizeKb}KB, ${SAMPLE_RATE}Hz mono)`);
