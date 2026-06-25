export type IconName =
  // Food & drink
  | 'utensils' | 'coffee' | 'wine' | 'pizza' | 'apple' | 'cake'
  // Travel & places
  | 'map-pin' | 'plane' | 'car' | 'train' | 'hotel' | 'compass'
  // People & social
  | 'users' | 'heart' | 'smile' | 'handshake' | 'baby' | 'user'
  // Nature & outdoors
  | 'sun' | 'tree' | 'flower' | 'mountain' | 'waves' | 'cloud'
  // Home & daily life
  | 'home' | 'shopping-bag' | 'shirt' | 'bed' | 'bath' | 'tv'
  // Education & work
  | 'book' | 'graduation-cap' | 'briefcase' | 'pen' | 'calculator' | 'globe'
  // Health & body
  | 'activity' | 'stethoscope' | 'pill' | 'dumbbell' | 'bike' | 'running'
  // Arts & leisure
  | 'music' | 'camera' | 'film' | 'palette' | 'game' | 'theater'
  // Time & numbers
  | 'clock' | 'calendar' | 'star' | 'flag' | 'bell' | 'gift'
  // General / fallback
  | 'folder' | 'tag' | 'bookmark' | 'message' | 'phone' | 'mail'

export interface CollectionColor {
  bg: string
  accent: string
}

export const COLOR_PALETTE: CollectionColor[] = [
  { bg: '#E6EFEC', accent: '#5B8A7D' },
  { bg: '#F0EAE0', accent: '#C9A24B' },
  { bg: '#E9E6F0', accent: '#8579A8' },
  { bg: '#EDE9E0', accent: '#A89D88' },
  { bg: '#EAEFE2', accent: '#7A9A4F' },
  { bg: '#F3E7E1', accent: '#C0764F' },
  { bg: '#E4EAF2', accent: '#5E7CA8' },
]

export const ICON_NAMES: IconName[] = [
  // Food & drink
  'utensils', 'coffee', 'wine', 'pizza', 'apple', 'cake',
  // Travel & places
  'map-pin', 'plane', 'car', 'train', 'hotel', 'compass',
  // People & social
  'users', 'heart', 'smile', 'handshake', 'baby', 'user',
  // Nature & outdoors
  'sun', 'tree', 'flower', 'mountain', 'waves', 'cloud',
  // Home & daily life
  'home', 'shopping-bag', 'shirt', 'bed', 'bath', 'tv',
  // Education & work
  'book', 'graduation-cap', 'briefcase', 'pen', 'calculator', 'globe',
  // Health & body
  'activity', 'stethoscope', 'pill', 'dumbbell', 'bike', 'running',
  // Arts & leisure
  'music', 'camera', 'film', 'palette', 'game', 'theater',
  // Time & numbers
  'clock', 'calendar', 'star', 'flag', 'bell', 'gift',
  // General
  'folder', 'tag', 'bookmark', 'message', 'phone', 'mail',
]

export const ICON_GROUPS: { label: string; icons: IconName[] }[] = [
  { label: 'Food & Drink',    icons: ['utensils', 'coffee', 'wine', 'pizza', 'apple', 'cake'] },
  { label: 'Travel',          icons: ['map-pin', 'plane', 'car', 'train', 'hotel', 'compass'] },
  { label: 'People',          icons: ['users', 'heart', 'smile', 'handshake', 'baby', 'user'] },
  { label: 'Nature',          icons: ['sun', 'tree', 'flower', 'mountain', 'waves', 'cloud'] },
  { label: 'Home & Life',     icons: ['home', 'shopping-bag', 'shirt', 'bed', 'bath', 'tv'] },
  { label: 'Education & Work',icons: ['book', 'graduation-cap', 'briefcase', 'pen', 'calculator', 'globe'] },
  { label: 'Health',          icons: ['activity', 'stethoscope', 'pill', 'dumbbell', 'bike', 'running'] },
  { label: 'Arts & Leisure',  icons: ['music', 'camera', 'film', 'palette', 'game', 'theater'] },
  { label: 'Time & Events',   icons: ['clock', 'calendar', 'star', 'flag', 'bell', 'gift'] },
  { label: 'General',         icons: ['folder', 'tag', 'bookmark', 'message', 'phone', 'mail'] },
]

export interface Sentence {
  id: string
  en: string
  gr: string | null
  enAudioUrl: string | null
  grAudioUrl: string | null
  fav: boolean
  learned: boolean
  translating?: boolean
  enVoiceId?: string
  grVoiceId?: string
  collectionId: string
  createdAt: number
}

export interface Collection {
  id: string
  name: string
  icon: IconName
  color: CollectionColor
  createdAt: number
}

export type PlaybackOrder = 'en' | 'gr' | 'en-gr' | 'gr-en'
export type PlayerView = 'compact' | 'immersive'
export type GreekSpeed = 0.7 | 0.85 | 1.0

export interface SavedVoice {
  id: string        // ElevenLabs voice_id
  name: string      // user-given nickname
}

export interface Settings {
  enVoiceId: string
  grVoiceId: string
  savedVoices: SavedVoice[]
  order: PlaybackOrder
  gapSeconds: number
  greekSpeed: GreekSpeed
  defaultPlayerView: PlayerView
  elevenLabsKey: string
  googleTranslateKey: string
  autoTranslate: boolean
  autoNarrate: boolean
}

export interface PlaybackState {
  active: boolean
  queue: string[]
  qpos: number
  order: PlaybackOrder
  phaseIdx: number
  inGap: boolean
  paused: boolean
  loop: boolean
  view: PlayerView
  collectionId: string | null
  gapSeconds: number
  greekSpeed: GreekSpeed
}
