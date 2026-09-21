// Some voices come out of ElevenLabs much quieter than others. Volume can't be raised at
// playback (iPhones ignore it for web audio), so narration is processed in the audio
// itself, to a loud, consistent level:
//   1. bring it to a common starting level,
//   2. gently compress the peaks (so the voice can be lifted without distorting),
//   3. lift it to the target level, with a soft limiter guarding against clipping.
// If anything goes wrong the original is returned unchanged, so narration can't break.

const TARGET_DB = -15         // average speech level to finish at (dBFS, RMS)
const START_DB = -20          // level everything is brought to before compressing
const MAX_GAIN = 10           // never boost more than +20 dB in the first step
const GATE_DB = -50           // ignore silence/pauses when measuring
const COMP_THRESHOLD_DB = -19 // peaks above this get compressed…
const COMP_RATIO = 4          // …at this ratio
const KNEE = 0.65             // above this, peaks are softly rounded instead of clipping…
const CEILING = 0.85          // …and never exceed this (about -1.4 dBFS), leaving room for the MP3 encoder's overshoot
const DONE_TOLERANCE_DB = 2   // already this close to the target means it's done (or loud enough already)

function softLimit(x: number): number {
  const a = Math.abs(x)
  if (a <= KNEE) return x
  const s = KNEE + (CEILING - KNEE) * Math.tanh((a - KNEE) / (CEILING - KNEE))
  return x < 0 ? -s : s
}

async function decode(blob: Blob): Promise<AudioBuffer> {
  const bytes = await blob.arrayBuffer()
  const Offline = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
  const ctx = new Offline(1, 1, 44100)
  // Promise form isn't in old Safari; the callback form works everywhere
  return new Promise((resolve, reject) => { ctx.decodeAudioData(bytes, resolve, reject) })
}

// Average level of the speech itself (silence excluded), in dBFS, or null if there is none
function speechLevelDb(samples: Float32Array, sampleRate: number): number | null {
  const frame = Math.max(1, Math.floor(sampleRate * 0.05))
  const gate = Math.pow(10, GATE_DB / 20)
  let sumSquares = 0
  let counted = 0
  for (let start = 0; start + frame <= samples.length; start += frame) {
    let s = 0
    for (let i = start; i < start + frame; i++) s += samples[i] * samples[i]
    if (Math.sqrt(s / frame) > gate) { sumSquares += s; counted += frame }
  }
  if (!counted) return null
  return 20 * Math.log10(Math.sqrt(sumSquares / counted))
}

// Simple peak compressor: fast attack, slower release
function compress(samples: Float32Array, sampleRate: number): Float32Array {
  const attack = Math.exp(-1 / (0.0015 * sampleRate))
  const release = Math.exp(-1 / (0.1 * sampleRate))
  const slope = 1 - 1 / COMP_RATIO
  const out = new Float32Array(samples.length)
  let env = 0
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i])
    env = a > env ? attack * env + (1 - attack) * a : release * env + (1 - release) * a
    const over = 20 * Math.log10(Math.max(env, 1e-6)) - COMP_THRESHOLD_DB
    out[i] = over > 0 ? samples[i] * Math.pow(10, (-over * slope) / 20) : samples[i]
  }
  return out
}

export async function levelAudio(blob: Blob): Promise<Blob> {
  try {
    const buffer = await decode(blob)
    const samples = buffer.getChannelData(0)
    const level = speechLevelDb(samples, buffer.sampleRate)
    if (level === null) return blob

    // Already at the target level (processed earlier, or naturally loud) — leave it alone,
    // so audio is never processed twice
    if (Math.abs(level - TARGET_DB) < DONE_TOLERANCE_DB) return blob

    const g1 = Math.min(MAX_GAIN, Math.pow(10, (START_DB - level) / 20))
    const start = new Float32Array(samples.length)
    for (let i = 0; i < samples.length; i++) start[i] = samples[i] * g1

    const squashed = compress(start, buffer.sampleRate)
    const squashedLevel = speechLevelDb(squashed, buffer.sampleRate) ?? START_DB
    const g2 = Math.min(4, Math.pow(10, (TARGET_DB - squashedLevel) / 20))

    const pcm = new Int16Array(squashed.length)
    for (let i = 0; i < squashed.length; i++) {
      pcm[i] = Math.round(softLimit(squashed[i] * g2) * 32767)
    }

    // Loaded on demand — the encoder is only needed when something actually gets processed
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
