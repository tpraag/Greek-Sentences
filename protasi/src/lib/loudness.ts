// Some voices come out of ElevenLabs much quieter than others. Volume can't be raised at
// playback (iPhones ignore it for web audio), so quiet narration is lifted in the audio
// itself: measure how loud the speech is, and if it's below the target, boost it and
// re-encode. Louder audio is never touched, and if anything goes wrong the original is
// returned unchanged so narration can't break.

const TARGET_DB = -20     // average speech level to aim for (dBFS, RMS)
const MAX_GAIN = 8        // never boost more than +18 dB
const MIN_GAIN = 1.15     // already close enough — skip the re-encode
const GATE_DB = -50       // ignore silence/pauses when measuring
const KNEE = 0.7          // above this, peaks are softly compressed instead of clipping

// Rounds off peaks above KNEE toward ±1 so a boost can't distort
function softLimit(x: number): number {
  const a = Math.abs(x)
  if (a <= KNEE) return x
  const s = KNEE + (1 - KNEE) * Math.tanh((a - KNEE) / (1 - KNEE))
  return x < 0 ? -s : s
}

async function decode(blob: Blob): Promise<AudioBuffer> {
  const bytes = await blob.arrayBuffer()
  const Offline = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
  const ctx = new Offline(1, 1, 44100)
  // Promise form isn't in old Safari; the callback form works everywhere
  return new Promise((resolve, reject) => { ctx.decodeAudioData(bytes, resolve, reject) })
}

// Average level of the speech itself (silence excluded), in dBFS
function speechLevelDb(samples: Float32Array, sampleRate: number): number | null {
  const frame = Math.max(1, Math.floor(sampleRate * 0.05))
  const gate = Math.pow(10, GATE_DB / 20)
  let sumSquares = 0
  let counted = 0
  for (let start = 0; start + frame <= samples.length; start += frame) {
    let s = 0
    for (let i = start; i < start + frame; i++) s += samples[i] * samples[i]
    const rms = Math.sqrt(s / frame)
    if (rms > gate) { sumSquares += s; counted += frame }
  }
  if (!counted) return null
  return 20 * Math.log10(Math.sqrt(sumSquares / counted))
}

export async function levelAudio(blob: Blob): Promise<Blob> {
  try {
    const buffer = await decode(blob)
    const samples = buffer.getChannelData(0)
    const level = speechLevelDb(samples, buffer.sampleRate)
    if (level === null) return blob

    const gain = Math.min(MAX_GAIN, Math.pow(10, (TARGET_DB - level) / 20))
    if (gain < MIN_GAIN) return blob

    const pcm = new Int16Array(samples.length)
    for (let i = 0; i < samples.length; i++) {
      pcm[i] = Math.round(softLimit(samples[i] * gain) * 32767)
    }

    // Loaded on demand — the encoder is only needed when something actually gets boosted
    const { Mp3Encoder } = await import('@breezystack/lamejs')
    const encoder = new Mp3Encoder(1, buffer.sampleRate, 128)
    const parts: Uint8Array[] = []
    const chunk = 1152
    for (let i = 0; i < pcm.length; i += chunk) {
      const out = encoder.encodeBuffer(pcm.subarray(i, i + chunk))
      if (out.length) parts.push(out)
    }
    const tail = encoder.flush()
    if (tail.length) parts.push(tail)
    return new Blob(parts as BlobPart[], { type: 'audio/mpeg' })
  } catch {
    return blob
  }
}
