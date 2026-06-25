# Handoff: Greek Tutor — sentence-based Greek learning app

## Overview
A personal app for learning Greek. The user writes sentences (or paragraphs/stories) in English, has them auto-translated to Greek, and generates spoken narration for each. Sentences are grouped into custom **collections**. The user reviews a collection by playing each sentence individually, or by pressing **Play all** to run through the whole collection automatically with a configurable pause between items and a choice of language order (English only / Greek only / English→Greek / Greek→English).

Target platform: **web app** (intended to run in a phone browser / installable PWA). It is **not** a native Swift/iOS app — the phone frame in the prototype is presentation only.

Primary user: a single person (the app's author), at least for v1. No multi-user accounts required.

## About the Design Files
The files in this bundle are **design references created in HTML** — interactive prototypes that show the intended look, layout, and behavior. They are **not production code to copy directly**.

- `Greek Tutor App.dc.html` — the **interactive prototype**. Full navigation, state, and a simulated playback engine. This is the source of truth for flow and behavior. (It is authored in a small in-house "Design Component" HTML format with inline styles; treat it as a reference, not as code to lift.)
- `Greek Tutor Static Screens.dc.html` — static, higher-fidelity reference frames of each screen plus three playback-control concepts, useful for seeing screens side by side.

The task is to **recreate these designs in a real web codebase** using an appropriate modern stack and that codebase's conventions — not to ship the HTML. In the prototype, translation and narration are **faked** (canned Greek strings, timed silent "playback"). The real app must call the actual APIs and cache results.

## Fidelity — build this exactly
**High-fidelity. Reproduce the design as-is.** The look in the prototype and screenshots is the intended final design: same layout, colors, typography, spacing, icons, sheets, and motion. Do **not** redesign, re-theme, substitute a component library's default styling, or "improve" it. Match the exact hex values, fonts (Figtree + Literata), radii, and shadows listed under **Design Tokens**. The only things to change from the prototype are (a) the fake data/APIs become real, and (b) the presentation-only phone bezel/status bar is dropped. If a detail is ambiguous, prefer what the screenshots show.

## Screenshots
See `screenshots/` — the exact target appearance (full-screen states, in order):
1. `01` Library
2. `02` Library — new-collection panel (name + 8 icons + 7 colors)
3. `03` Collection (Café & Food)
4. `04` Collection — ⋯ action menu (Rename / Change icon & color / Delete)
5. `05` Icon & color picker sheet
6. `06` Sentence detail & playback controls
7. `07` Quick add (notebook)
8. `08` Settings
9. `09` Play-all setup sheet (order / gap / while-playing)
10. `10` Compact player bar (playing, current row highlighted)
11. `11` Immersive player

## Recommended stack & infrastructure (decisions to confirm with the user)
These are real-build concerns the prototype only simulates. Sensible defaults:

- **Framework**: React + Vite (or plain TS + Vite if you prefer minimal deps). Single-page app.
- **PWA**: add a manifest + service worker so it installs to the home screen and cached audio plays offline.
- **Persistence**: **IndexedDB** (e.g. via `idb`). Store collection/sentence records AND the generated audio as **Blobs**. (localStorage is too small for audio and only holds strings.)
- **API keys**: stored locally on device (Settings screen). Calling ElevenLabs/Google directly from the browser exposes the key in network requests — acceptable for a personal, single-device app. If the app is ever shared or deployed publicly, put a thin proxy (serverless function) in front to hold the keys. Flag this to the user.
- **Translation API**: Google Cloud Translation v2/v3 (`q`, `source=en`, `target=el`). Any equivalent (DeepL, etc.) is fine if the user prefers.
- **TTS API**: ElevenLabs text-to-speech. English and Greek each use a user-selected voice id. Greek playback honors a speed/`stability` style or, more simply, sets `playbackRate` on the HTML `<audio>` element for the "slow Greek" feature (see Playback).

## Data Model
```
Collection {
  id: string
  name: string
  icon: 'circle'|'ring'|'square'|'diamond'|'triangle'|'bar'|'dot'|'folder'
  color: { bg: string, accent: string }   // light bg + accent hex, chosen from palette
  createdAt: number
  sentences: Sentence[]   // or normalized by collectionId
}

Sentence {
  id: string
  en: string                  // English source text (can be a paragraph/story)
  gr: string | null           // Greek translation; null = not yet translated
  enAudio: Blob | null        // cached ElevenLabs narration (English)
  grAudio: Blob | null        // cached ElevenLabs narration (Greek)
  fav: boolean                // favorite (gold star)
  learned: boolean            // marked learned (check)
  translating?: boolean       // transient: translation in flight
  // staleness: when en text is edited, or user taps "Re-translate"/"Regenerate audio",
  // clear gr / enAudio / grAudio so they regenerate. Otherwise NEVER regenerate automatically.
  enVoiceId?: string          // voice used to generate enAudio (for cache invalidation on voice change — optional)
  grVoiceId?: string
}

Settings {
  enVoiceId: string           // ElevenLabs voice for English
  grVoiceId: string           // ElevenLabs voice for Greek
  order: 'en' | 'gr' | 'en-gr' | 'gr-en'   // default playback order
  gapSeconds: number          // pause between sentences (0–10, default 3)
  greekSpeed: number          // 0.7 | 0.85 | 1.0 (audio playbackRate for Greek)
  defaultPlayerView: 'compact' | 'immersive'
  elevenLabsKey: string
  googleTranslateKey: string
}
```

**Caching rule (core requirement):** Once a translation or narration is generated, **persist it and never regenerate** unless the user explicitly taps "Re-translate" / "Regenerate audio" (sentence detail) or edits the English text. This saves API cost and is a stated product goal.

## Screens / Views
All screens are within a single mobile viewport (prototype frame is 390×812). Bottom of the app has a **tab bar** (Library | Settings) with a raised circular **+** button in the center for quick-add. The tab bar is hidden during the immersive player, quick-add, and modal sheets.

### 1. Library
- **Purpose**: top level — browse collections.
- **Layout**: scrollable. Large title "Library", subtitle "N sentences · M collections". A search field (decorative in prototype; implement basic client-side filter). Section header "Collections" with a **+ New** action on the right. Then a vertical list of collection cards.
- **Collection card**: white, 1px border `#ECE8DF`, radius 16, padding 16, row layout. Left: 46×46 rounded-13 tinted square (collection `color.bg`) containing the collection's geometric icon drawn in `color.accent`. Middle: name (16px/600) + sub (13px `#9A9183`, e.g. "12 sentences · 8 narrated"; show "N paragraphs" for story-type). Right: chevron `›`.
- **+ New collection**: opens an inline panel (white card) with a name input + **Add** button, a row of the 8 icon options (tinted squares), and a row of 7 color swatches. Selecting icon/color previews live; Add creates the collection.

### 2. Collection (inside a folder)
- **Purpose**: see and manage the sentences in one collection; start playback.
- **Layout**: back row ("‹ Library"), title row (collection name 27px/700 + a **⋯** menu button), subtitle (count). Then a green **Play all** bar, then the sentence list.
- **Play all bar**: accent `#5B8A7D`, radius 15, white text. Shows a play glyph, "Play all", and a sub line with current order + gap (e.g. "EN → GR · 3s gap"). An "Options" pill on the right. Tapping anywhere opens the **Setup sheet**.
- **Sentence row**: left a 30px circular play button (tinted `#E6EFEC`, accent triangle) — tapping plays just that sentence; middle English line (15px/500) over Greek line (15px, **Literata serif**, `#6F6A60`); right a favorite star (`★` gold `#C9A24B` when on, `☆` `#D8D0BF` when off). Tapping the row (not the play/star) opens the sentence detail. A not-yet-translated sentence shows italic "Tap to translate & narrate" instead of Greek and a muted play button; "Translating…" while in flight.
- **⋯ menu** (action sheet from bottom): **Rename collection**, **Change icon & color**, **Delete collection** (delete in warm red `#C0492F`), Cancel. Rename turns the title into an inline input with a Save button. "Change icon & color" opens the **Icon picker sheet**.

### 3. Sentence detail & playback
- **Purpose**: focus on one sentence; play either language; tune speed; favorite/loop; regenerate.
- **Layout** (full-screen over the collection, with a back row "‹ <collection>" and a favorite star top-right): label "English · X of N", the English text large (25px/600); a hairline; label "Ελληνικά", the Greek text large (26px, Literata serif, `#3A4A45`). Then controls:
  - Two play buttons side by side: **English** (white, outlined) and **Ελληνικά** (accent filled). Each plays that language's cached audio (generating it if missing).
  - **Greek speed**: segmented `0.7× / 0.85× / 1.0×` (sets `playbackRate` on Greek audio).
  - **Loop this sentence**: toggle switch — repeats the current sentence's playback.
  - A "Translation & audio cached" indicator (accent dot).
  - **Re-translate** and **Regenerate audio** buttons (outlined) — these are the *only* ways to invalidate the cache for this sentence besides editing the English.

### 4. Quick add (notebook)
- **Purpose**: capture a sentence fast from anywhere (the center **+** button).
- **Layout**: header "Cancel / New sentence / Save". A large multiline English textarea ("Type a sentence, paragraph, or story…"). Two toggles: **Auto-translate on save**, **Generate narration on save** (both default on). Then "Save to collection" — chips for each collection (selected = accent filled) plus a **+ New** chip that reveals the same inline new-collection panel as the Library. Big **Save sentence** button at the bottom.
- **On save**: create the sentence; if auto-translate on, call Google Translate then (if narration on) ElevenLabs, persisting results; show a small toast ("Saved · translating…", then "Translation & audio ready"). Land the user in the target collection.

### 5. Settings
- **Purpose**: voices, playback defaults, API keys.
- **Layout**: title "Settings", grouped list rows (white cards, hairline dividers):
  - **Voices**: English voice, Greek voice (each opens a voice picker; in prototype these cycle through sample names — real app should list the account's ElevenLabs voices).
  - **Playback defaults**: Order, Gap between sentences, Greek speed, Player look (compact/immersive).
  - **API keys**: ElevenLabs, Google Translate (show connected state; secure entry fields in real app).
  - Footnote: "Keys are stored only on this device."

### Global playback — two looks (one flow)
Pressing **Play all** opens the **Setup sheet** (bottom sheet): title "Play all", count, **Order** (4 chips), **Pause between sentences** (− / value / + stepper, 0–10s), **While playing** (Compact bar vs Immersive), and **Start playing**. After Start, playback runs in the chosen look:

- **Compact bar** (`compact`): a dark docked bar (`#26241F`, radius 18) above the tab bar. Thin progress line on top; "Now · k of N · <language>"; current English title; prev / play-pause / next; chips for order, gap, speed; a Close action. The matching sentence row in the list highlights (tinted `#E6EFEC`).
- **Immersive** (`immersive`): full-screen dark (`#2E3B37`). A down-chevron to dismiss, collection name centered. Progress **dots** (one per sentence, current+past filled). Label "<language> · now playing". The active phrase is large (Literata serif, white); the other language smaller/muted below. Order/gap/speed chips. Large transport row: prev / big play-pause / next.

## Interactions & Behavior — the playback engine
This is the trickiest part; the prototype implements it in `Greek Tutor App.dc.html` (see the `tick`, `_step`, `_dur`, `_advance`, `startPlay`, `next`, `prev` methods) and the real app should mirror the logic but drive **real audio** instead of timers.

- A play session has a **queue** (array of sentence ids — for "Play all" it's every translated sentence in the collection; for a single play it's one id), a **qpos** (index into queue), an **order** (which produces a phase list: `en`→[en], `gr`→[gr], `en-gr`→[en,gr], `gr-en`→[gr,en]), a **phaseIdx**, an **inGap** flag, **paused**, **loop**, and the chosen **view**.
- For each sentence, play each phase in order. Between sentences (not after the last, unless looping) insert a **gap** of `gapSeconds`.
- **Real audio**: for the current phase, get the cached Blob for that sentence+language (generate via ElevenLabs if missing), play it through an `<audio>` element. Greek audio uses `audio.playbackRate = greekSpeed`. When `ended` fires, advance to the next phase / gap / sentence. The gap is a `setTimeout(gapSeconds*1000)`.
- **Controls**: pause/resume pauses the audio and any pending gap timer; next/prev jump to the start of the adjacent sentence (reset phaseIdx, clear gap); close stops everything. Loop (single-sentence) restarts the same sentence after it finishes.
- When the queue finishes and not looping, end the session (hide bar / exit immersive).
- Pre-fetch nicety (optional): generate/cache the next sentence's audio during the current one to avoid gaps.

## State Management
- Global store (or context) for: collections+sentences (persisted to IndexedDB), settings (persisted), and a transient **playback** slice (queue, qpos, phaseIdx, inGap, paused, loop, view, active).
- Navigation/UI state: current screen (library/collection/settings), open collectionId, open sentenceId (detail), open sheets (setup, collection menu, icon picker, quick-add), inline new-collection state (name/icon/color), rename state, toast.
- Data fetching: Google Translate on save / re-translate; ElevenLabs on save / regenerate / first play of a language whose audio is missing. All results written back to IndexedDB immediately.

## Design Tokens
**Colors**
- Page background: `#F6F4EF` (warm off-white); device gallery bg `#E7E5DF`
- Surface / card: `#FFFFFF`
- Hairline / border: `#ECE8DF` (also `#E7E3DA`, `#F0ECE3` for dividers)
- Ink (primary text): `#26241F`
- Ink soft (Greek/secondary): `#6F6A60`; muted `#9A9183`; faint `#B7AF9F` / `#B0A795` / `#D8D0BF`
- Accent (primary/brand): `#5B8A7D` (sage-teal). Accent tint bg: `#E6EFEC`. Accent light (immersive highlight text): `#8FBDB1` / `#9FC4BA`
- Immersive dark bg: `#2E3B37`; compact bar dark: `#26241F`
- Favorite gold: `#C9A24B`
- Destructive red: `#C0492F`
- Collection palette (bg / accent) — 7 options:
  `#E6EFEC`/`#5B8A7D`, `#F0EAE0`/`#C9A24B`, `#E9E6F0`/`#8579A8`, `#EDE9E0`/`#A89D88`, `#EAEFE2`/`#7A9A4F`, `#F3E7E1`/`#C0764F`, `#E4EAF2`/`#5E7CA8`

**Typography**
- UI / sans: **Figtree** (Google Fonts), weights 400/500/600/700.
- Reading & Greek: **Literata** (Google Fonts), 400/500 + italic. Literata covers Greek glyphs; fall back to Georgia/serif.
- Sizes used: screen titles 27–30px/700; sentence (list) 15px/500; Greek (list) 15px; detail English 25px/600; detail Greek 26px; section labels 13px/600 uppercase, letter-spacing ~0.06–0.1em; body 14–15px; small/muted 11–13px.

**Radius**: cards 16; inputs/sheets-buttons 11–15; bottom sheets 26 (top corners); pills 9–13; device screen 39; circular controls 50%.

**Shadows**: card/bar `0 6–12px 16–30px rgba(0,0,0,.08–.28)`; accent buttons `0 6–8px 14–20px rgba(91,138,125,.3–.45)`; bottom sheets `0 -10px 40px rgba(0,0,0,.2)`.

**Spacing**: screen horizontal padding 24px; card padding 14–16px; gaps 8–14px; bottom content padding leaves room for the 86px tab bar + ~98px for the compact player bar.

**Tab bar**: height 86, translucent `rgba(246,244,239,.92)` + blur, top hairline. Center **+** button: 62px circle, accent, raised −22px, white plus.

## Icon library
Eight geometric marks, each drawn from CSS primitives in the collection's accent color (no clip-art / illustration):
`circle` (filled disc), `ring` (outlined circle), `square` (rounded square), `diamond` (rotated square), `triangle` (CSS triangle), `bar` (horizontal rounded bar), `dot` (small disc), `folder` (rounded box with thick top edge). Reproduce these (or map to equivalent icons from the codebase's icon set if one exists).

## Assets
- No bitmap assets. Fonts load from Google Fonts (Figtree, Literata). Icons are CSS shapes. The phone bezel/status bar in the prototype is presentation chrome — drop it; the real app is the screen content itself.

## Files
- `Greek Tutor App.dc.html` — interactive prototype (flow + behavior source of truth; playback engine logic lives in its `<script>` class).
- `Greek Tutor Static Screens.dc.html` — static reference frames of all screens + 3 playback concepts.

## Open decisions to confirm with the user
1. Framework (React+Vite recommended) and whether to make it an installable **PWA** (recommended for offline audio).
2. Stories/paragraphs in **Play all**: play the whole paragraph as one audio chunk (recommended), or split into sentences? Prototype treats a story as one item.
3. Translation provider (Google vs DeepL) and ElevenLabs model/voice settings.
4. Whether keys stay browser-side (personal use) or move behind a small proxy (if ever shared).
5. Search behavior scope (within collection vs global).
