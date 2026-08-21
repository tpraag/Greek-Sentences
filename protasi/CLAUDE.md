# Protasi — Greek Learning PWA

## What this app is

Protasi is a personal Greek learning app. The user writes English sentences, the app auto-translates them to Greek via Google Translate, and generates spoken narration via ElevenLabs. Sentences are grouped into collections. A playback engine reads sentences aloud with configurable order (EN only / GR only / EN→GR / GR→EN), gap between sentences, and loop. The app is a PWA deployed at https://protasi-seven.vercel.app.

## Stack

- **React + Vite + TypeScript** — SPA with CSS Modules
- **Firebase Firestore** (europe-west3) — real-time sync via `onSnapshot` listeners with `persistentLocalCache` for offline/instant reads
- **Firebase Storage** — audio files at `audio/{sentenceId}/{en|gr}.mp3`
- **ElevenLabs** — TTS via `/api/tts` serverless proxy
- **Google Translate v2** — via `/api/translate` serverless proxy (supports `source`/`target` params, defaults to EN→GR)
- **Vercel** — hosting + serverless functions in `api/`
- **vite-plugin-pwa** — service worker, manifest, installable

## Project structure

```
protasi/
  api/
    translate.ts   # POST {text, source?, target?} → {translation}
    tts.ts         # POST {text, voiceId} → audio blob
    voices.ts      # GET → ElevenLabs voice list
  src/
    types/index.ts        # All shared types
    lib/
      firebase.ts         # Firebase init (isFirebaseConfigured guard)
      db.ts               # All Firestore ops — onSnapshot for reads, addDoc/updateDoc/deleteDoc for writes
      api.ts              # Client fetch wrappers for /api/*
    store/index.tsx       # Global state: useReducer + Context (AppProvider)
    screens/
      Library.tsx         # Collection grid
      CollectionView.tsx  # Sentence list with swipe-to-delete
      SentenceDetail.tsx  # Single sentence, word-tap translation, playback controls
      QuickAdd.tsx        # New sentence sheet
      Settings.tsx        # Voices, playback defaults, auto-translate/narrate toggles
    components/
      CollectionIcon.tsx  # Maps IconName → Lucide icon
      CompactPlayer.tsx   # Bottom bar player
      ImmersivePlayer.tsx # Full-screen player
      NewCollectionPanel.tsx
      PlaySetupSheet.tsx
      SwipeToDelete.tsx   # Touch swipe-left to reveal delete button
      TabBar.tsx
```

## Key architecture decisions

- **`onSnapshot` everywhere** — no `getDocs`. Listeners fire instantly from IndexedDB cache, then update when server responds. `subscribeCollections`, `subscribeSentences`, `subscribeSettings` in `db.ts`.
- **No temp IDs** — collections and sentences are added to state with their real Firestore ID (await `db.createX` first). The reducer deduplicates `ADD_COLLECTION` / `ADD_SENTENCE` so `onSnapshot` and the optimistic dispatch can't create duplicates.
- **API keys in Vercel env only** — `ELEVENLABS_API_KEY` and `GOOGLE_TRANSLATE_API_KEY` live in Vercel dashboard, never in the client bundle or Firestore.
- **`playbackRef.current` is synced manually** before calling `playPhase` in `startPlayback` so the correct `greekSpeed` is used immediately (React dispatch is async).

## Design system

### Fonts
- **Figtree** — UI font (400/500/600/700)
- **Literata** — serif font for Greek text; apply with `.serif` class

### Color tokens (CSS variables in `src/index.css`)
```
--bg: #F6F4EF          warm off-white page background
--surface: #FFFFFF      card/sheet background
--border: #ECE8DF       card borders
--divider: #E7E3DA      hairline dividers
--ink: #26241F          primary text
--ink-soft: #6F6A60     secondary text
--ink-muted: #9A9183    labels, captions
--ink-faint: #B7AF9F    very muted
--ink-placeholder: #D8D0BF  input placeholders
--accent: #5B8A7D       teal — primary action color
--accent-tint: #E6EFEC  accent background tint
--accent-light: #8FBDB1 lighter accent
--fav: #C9A24B          gold — favourite star
--destructive: #C0492F  red — delete actions
--dark-bg: #2E3B37      dark teal — immersive player bg
--dark-bar: #26241F     near-black — compact player, toasts
```

### Global component classes (in `src/index.css`)
- `.card` — white card with border-radius 16px
- `.sheet` / `.sheet-overlay` — bottom sheet modal
- `.sheet-handle` — drag handle bar inside a sheet
- `.label` — uppercase small caps section label
- `.chip` / `.chip.active` — pill tag (e.g. collection selector)
- `.hairline` — 1px divider line
- `.btn-accent` — full-width teal CTA button
- `.btn-outline` — bordered secondary button
- `.switch` / `.switch-track` — iOS-style toggle
- `.segmented` — segmented control (e.g. speed selector)
- `.screen-scroll` — scrollable screen body with bottom padding for tab bar; add `with-player` when compact player is visible
- `.toast` — floating notification pill
- `.serif` — apply Literata font

### Layout
- Max width 430px, centered — phone-first
- Tab bar height: `var(--tab-h)` = 86px
- Safe area bottom: `var(--safe-bottom)` = `env(safe-area-inset-bottom, 0px)`
- Viewport: `maximum-scale=1.0` to prevent iOS input zoom

### Icon system
- 60 Lucide icons mapped in `ICON_NAMES` / `ICON_GROUPS` in `src/types/index.ts`
- Rendered via `<CollectionIcon icon={name} accent={color} size={n} />`

### Collection colors
7 presets in `COLOR_PALETTE` — each has `{ bg, accent }`. The accent is used for icons and play buttons.

## Types reference

```ts
type PlaybackOrder = 'en' | 'gr' | 'en-gr' | 'gr-en'
type PlayerView = 'compact' | 'immersive'
type GreekSpeed = 0.7 | 0.85 | 1.0

interface Settings {
  enVoiceId: string       // ElevenLabs voice ID for English
  grVoiceId: string       // ElevenLabs voice ID for Greek
  savedVoices: SavedVoice[]
  order: PlaybackOrder
  gapSeconds: number
  greekSpeed: GreekSpeed
  defaultPlayerView: PlayerView
  autoTranslate: boolean  // auto-translate on sentence save
  autoNarrate: boolean    // auto-generate audio on sentence save
}

interface SavedVoice { id: string; name: string }

interface Sentence {
  id: string; en: string; gr: string | null
  enAudioUrl: string | null; grAudioUrl: string | null
  fav: boolean; learned: boolean; translating?: boolean
  collectionId: string; createdAt: number
}

interface Collection {
  id: string; name: string; icon: IconName; color: CollectionColor; createdAt: number
}
```

## Deploy

```bash
cd protasi
vercel --prod
```

Always run from the `protasi/` subdirectory. The repo root also contains `design_handoff_greek_tutor/` (original design files) and an older `frasi/` folder — ignore those.
