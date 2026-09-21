import localforage from 'localforage'
import { normalizeWord } from './wordCache'
import { getConjugation } from './api'

// Offline verb conjugations (src/data/greekVerbs.json, built by scripts/build-verbs.mjs from the
// Greek Conjugation App database — 839 verbs from Wiktionary, CC BY-SA 4.0).
// There's no separate lemmatiser — every conjugated form in the data is indexed back to its
// verb, which is what lets a tapped word like μίλησα resolve to μιλώ. Only verbs in the data
// can be resolved; anything else simply has no table.

export type SectionKey = 'pr' | 'pa' | 'im' | 'fu' | 'fc' | 'pf' | 'is' | 'ic'
export type TabKey = 'present' | 'past' | 'imperfect' | 'future' | 'futureCont' | 'perfect' | 'imperative'

export interface VerbEntry {
  m: string                       // English meaning, e.g. "to speak, to talk"
  pas?: 1                         // passive voice
  al?: string[]                   // alternative spellings of the verb itself
  ex?: string[]                   // extra everyday forms, used only for lookup
  pt?: string                     // present participle
  pr?: (string | null)[]          // present
  pa?: (string | null)[]          // aorist (simple past)
  im?: (string | null)[]          // imperfect
  fu?: (string | null)[]          // simple future
  fc?: (string | null)[]          // continuous future
  pf?: (string | null)[]          // present perfect
  is?: (string | null)[]          // simple imperative
  ic?: (string | null)[]          // continuous imperative
}

export interface Tab {
  key: TabKey
  label: string
  note: string
  sections: { key: SectionKey; caption?: string }[]
}

export const TABS: Tab[] = [
  { key: 'present', label: 'Present', note: 'Ενεστώτας · what happens now or habitually', sections: [{ key: 'pr' }] },
  { key: 'past', label: 'Past', note: 'Αόριστος · a completed action in the past', sections: [{ key: 'pa' }] },
  { key: 'imperfect', label: 'Imperfect', note: 'Παρατατικός · an ongoing or repeated past action', sections: [{ key: 'im' }] },
  { key: 'future', label: 'Future', note: 'Απλός μέλλοντας · a single future action', sections: [{ key: 'fu' }] },
  { key: 'futureCont', label: 'Continuous future', note: 'Εξακολουθητικός μέλλοντας · an ongoing or repeated future action', sections: [{ key: 'fc' }] },
  { key: 'perfect', label: 'Perfect', note: 'Παρακείμενος · an action completed, with a result now', sections: [{ key: 'pf' }] },
  {
    key: 'imperative', label: 'Imperative', note: 'Προστακτική · giving an instruction',
    sections: [
      { key: 'is', caption: 'Simple · one request' },
      { key: 'ic', caption: 'Continuous · ongoing or repeated' },
    ],
  },
]

const SECTION_TAB: Record<SectionKey, TabKey> = {
  pr: 'present', pa: 'past', im: 'imperfect', fu: 'future', fc: 'futureCont', pf: 'perfect', is: 'imperative', ic: 'imperative',
}

export const PERSONS = ['εγώ', 'εσύ', 'αυτός/ή', 'εμείς', 'εσείς', 'αυτοί/ές']

interface Hit { lemma: string; tab: TabKey | null; literal: boolean }
interface Loaded {
  verbs: Record<string, VerbEntry>
  index: Map<string, Hit[]>
}

let loading: Promise<Loaded> | null = null

// Loaded lazily so the verb data stays out of the main bundle.
function load(): Promise<Loaded> {
  if (!loading) {
    loading = import('../data/greekVerbs.json').then(mod => {
      const verbs = (mod.default ?? mod) as unknown as Record<string, VerbEntry>
      const index: Loaded['index'] = new Map()
      const add = (word: string, lemma: string, tab: TabKey | null, literal = false) => {
        const hit = { lemma, tab, literal }
        const list = index.get(word)
        if (list) list.push(hit)
        else index.set(word, [hit])
      }
      for (const [lemma, entry] of Object.entries(verbs)) {
        add(lemma.toLowerCase(), lemma, 'present', true)
        entry.al?.forEach(a => add(a.toLowerCase(), lemma, 'present', true))
        entry.ex?.forEach(f => add(lastWord(f), lemma, 'present'))
        if (entry.pt) add(lastWord(entry.pt), lemma, null)
        for (const key of Object.keys(SECTION_TAB) as SectionKey[]) {
          for (const form of entry[key] ?? []) {
            if (!form) continue
            for (const alt of form.split(' / ')) add(lastWord(alt), lemma, SECTION_TAB[key])
          }
        }
      }
      return { verbs, index }
    })
  }
  return loading
}

// "θα μιλήσω" → "μιλήσω", "ας (να) μιλήσει" → "μιλήσει"
function lastWord(form: string): string {
  return form.trim().split(/\s+/).pop()!.toLowerCase()
}

export function formMatches(form: string | null, word: string): boolean {
  if (!form) return false
  const target = normalizeWord(word)
  return form.split(' / ').some(alt => lastWord(alt) === target)
}

export async function getVerb(lemma: string): Promise<VerbEntry | null> {
  return (await load()).verbs[lemma] ?? null
}

// Tabs that actually have data for this verb (a few verbs have no perfect, for example).
export function tabsFor(entry: VerbEntry): Tab[] {
  return TABS.filter(t => t.sections.some(s => entry[s.key]?.some(Boolean)))
}

// The tab whose table contains this word, so the table can open on the right one.
export function tabOfWord(entry: VerbEntry, word: string): TabKey | null {
  for (const t of TABS) {
    if (t.sections.some(s => entry[s.key]?.some(f => formMatches(f, word)))) return t.key
  }
  return null
}

export interface VerbMatch {
  lemma: string
  meaning: string
  tab: TabKey | null
}

// Resolves a tapped word (any conjugated form, or the verb itself) to its verb.
// When several verbs share a form (πήγα → πάω / πηγαίνω), a verb the word literally
// is wins; otherwise the first one in the data.
export async function findVerb(word: string): Promise<VerbMatch | null> {
  const clean = normalizeWord(word)
  if (!clean) return null
  const { verbs, index } = await load()
  const hits = index.get(clean)
  if (!hits?.length) return null
  const hit = hits.find(h => h.literal) ?? hits[0]
  return { lemma: hit.lemma, meaning: verbs[hit.lemma].m, tab: hit.tab }
}

// Tables Claude built for verbs that aren't in the built-in data, kept on the device so
// each verb is only ever asked once.
const claudeTables = localforage.createInstance({
  name: 'protasi',
  storeName: 'verbTables',
  description: 'Conjugation tables generated by Claude',
})

export interface VerbTable {
  entry: VerbEntry
  source: 'data' | 'claude'
}

// Built-in data first (instant, reliable), then the device cache, then Claude.
export async function getVerbTable(lemma: string): Promise<VerbTable | null> {
  const local = await getVerb(lemma)
  if (local) return { entry: local, source: 'data' }
  const key = lemma.toLowerCase()
  const cached = await claudeTables.getItem<VerbEntry>(key)
  if (cached) return { entry: cached, source: 'claude' }
  const entry = (await getConjugation(key)) as unknown as VerbEntry
  await claudeTables.setItem(key, entry)
  return { entry, source: 'claude' }
}
