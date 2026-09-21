// Converts the standalone "Greek Conjugation App" database (../Greek Conjugation App/verbs-new-database.js,
// 839 verbs from Wiktionary, CC BY-SA 4.0) into one compact JSON for the app.
//
// Each verb → { m: meaning, pas?: 1 (passive voice), al?: [alternative spellings of the verb],
//              ex?: [extra everyday forms used only for looking a word up], ...sections }
// where a section is an array of six forms in person order (εγώ, εσύ, αυτός/ή, εμείς, εσείς, αυτοί/ές),
// with null where a person doesn't exist (imperatives) or the form is missing (— in the source):
//   pr present · pa aorist (simple past) · im imperfect · fu simple future · fc continuous future
//   pf present perfect · is simple imperative · ic continuous imperative · pt present participle (string)
//
// Run: node scripts/build-verbs.mjs
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = path.resolve(here, '../../Greek Conjugation App/verbs-new-database.js')

const ctx = {}
vm.createContext(ctx)
vm.runInContext(fs.readFileSync(source, 'utf8') + ';this.out = verbs', ctx)

const SECTIONS = {
  pr: 'Ενεστώτας (Present)',
  pa: 'Αόριστος (Simple Past)',
  im: 'Παρατατικός (Continuous Past)',
  fu: 'Μέλλοντας Στιγμιαίος (Simple Future)',
  fc: 'Μέλλοντας Εξακολουθητικός (Continuous Future)',
  pf: 'Παρακείμενος (Present Perfect)',
  is: 'Προστακτική Στιγμιαία (Simple Imperative)',
  ic: 'Προστακτική Εξακολουθητική (Cont. Imperative)',
}
const PARTICIPLE = 'Μετοχή Ενεστώτα (Present Participle)'
const PERSONS = ['εγώ', 'εσύ', 'αυτός/ή/ό', 'εμείς', 'εσείς', 'αυτοί/ές/ά']

// Some source rows have two forms run together in one cell (which shifts everything after
// it by one person). Split them and, if that gives exactly six forms, put them back in order.
const repairs = []
function repairSection(lemma, sectionName, section) {
  const values = PERSONS.map(p => section[p])
  const split = values.flatMap(v =>
    typeof v === 'string' ? v.split(/\s(?=θα\s)|\s(?=έχ\S*\s)/) : [v]
  )
  if (split.length === values.length) return section
  const present = split.filter(v => v !== undefined)
  if (present.length !== 6) return section
  repairs.push(`${lemma} — ${sectionName}`)
  return Object.fromEntries(PERSONS.map((p, i) => [p, present[i]]))
}

// Colloquial -άω verbs (μιλάω, μιλάει, μιλάνε…) are how most of these are actually written;
// the source only lists the -ώ / -άς / -ά / -άν set, so add the common ones for lookup.
function extraForms(present) {
  const you = present?.[1]
  if (!you || !you.endsWith('άς')) return []
  const stem = you.slice(0, -2)
  return [`${stem}άω`, `${stem}άει`, `${stem}άνε`]
}

const clean = f => (typeof f === 'string' && f.trim() && f.trim() !== '—' ? f.trim() : null)

const out = {}
for (const [lemma, data] of Object.entries(ctx.out)) {
  const entry = { m: data.meaning }
  if (data.voice === 'Passive') entry.pas = 1
  if (data._aliases?.length) entry.al = data._aliases
  for (const [key, name] of Object.entries(SECTIONS)) {
    let section = data[name]
    if (!section) continue
    section = repairSection(lemma, name, section)
    const row = PERSONS.map(p => clean(section[p]))
    if (row.some(Boolean)) entry[key] = row
  }
  const known = new Set(Object.values(entry).flat().filter(x => typeof x === 'string'))
  const ex = extraForms(entry.pr).filter(f => !known.has(f))
  if (ex.length) entry.ex = ex
  const participle = clean(data[PARTICIPLE]?.form)
  if (participle) entry.pt = participle
  out[lemma] = entry
}

const target = path.resolve(here, '../src/data/greekVerbs.json')
fs.writeFileSync(target, JSON.stringify(out))
if (repairs.length) console.log(`Repaired merged forms in source data: ${repairs.join('; ')}`)
console.log(`Wrote ${Object.keys(out).length} verbs to ${path.relative(process.cwd(), target)} (${fs.statSync(target).size} bytes)`)
