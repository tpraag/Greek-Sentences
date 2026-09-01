import { useState, useEffect, useRef } from 'react'
import { useApp } from '../store'
import { signOutUser } from '../lib/auth'
import { generateSpeech } from '../lib/api'
import { GREEK_VOICES, ENGLISH_VOICES } from '../lib/voices'
import type { Settings as SettingsType, PlaybackOrder, PlayerView, GreekSpeed } from '../types'
import styles from './Settings.module.css'

const PREVIEW_TEXT = {
  en: 'Hello! This is a quick preview of my voice.',
  gr: 'Γεια σου! Αυτή είναι μια σύντομη δοκιμή της φωνής μου.',
}

export default function Settings() {
  const { state, saveSettings, showToast } = useApp()
  const [form, setForm] = useState<SettingsType>(state.settings)
  const [saved, setSaved] = useState(false)
  const [previewing, setPreviewing] = useState<'en' | 'gr' | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement>(new Audio())
  // Caches generated preview audio per voice so re-sampling the same voice is free
  const previewCacheRef = useRef<Map<string, string>>(new Map())

  useEffect(() => { setForm(state.settings) }, [state.settings])

  // Revoke cached preview object URLs when leaving the screen
  useEffect(() => () => {
    previewCacheRef.current.forEach(url => URL.revokeObjectURL(url))
  }, [])

  function set<K extends keyof SettingsType>(k: K, v: SettingsType[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    await saveSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function previewVoice(lang: 'en' | 'gr') {
    const voiceId = lang === 'en' ? form.enVoiceId : form.grVoiceId
    if (!voiceId || previewing) return
    setPreviewing(lang)
    try {
      let url = previewCacheRef.current.get(voiceId)
      if (!url) {
        const blob = await generateSpeech(PREVIEW_TEXT[lang], voiceId)
        url = URL.createObjectURL(blob)
        previewCacheRef.current.set(voiceId, url)
      }
      previewAudioRef.current.src = url
      await previewAudioRef.current.play()
    } catch {
      showToast('Preview failed')
    } finally {
      setPreviewing(null)
    }
  }

  return (
    <div className="screen-scroll">
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </div>

      <div className={styles.body}>

        {/* Voice selection — curated lists, not user-managed */}
        <div className={styles.group}>
          <div className="label" style={{ marginBottom: 8 }}>Voices</div>
          <div className={`card ${styles.card}`}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>English voice</span>
              <div className={styles.voiceSelectGroup}>
                <select
                  className={styles.select}
                  value={form.enVoiceId}
                  onChange={e => set('enVoiceId', e.target.value)}
                >
                  <option value="">Select…</option>
                  {ENGLISH_VOICES.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <button
                  className={styles.previewBtn}
                  disabled={!form.enVoiceId || previewing !== null}
                  onClick={() => previewVoice('en')}
                  aria-label="Preview English voice"
                >
                  {previewing === 'en' ? (
                    <span className={styles.previewSpinner} />
                  ) : (
                    <svg width="10" height="12" viewBox="0 0 12 14" fill="var(--accent)"><polygon points="1 1 11 7 1 13" /></svg>
                  )}
                </button>
              </div>
            </div>
            <div className="hairline" />
            <div className={styles.row}>
              <span className={styles.rowLabel}>Greek voice</span>
              <div className={styles.voiceSelectGroup}>
                <select
                  className={styles.select}
                  value={form.grVoiceId}
                  onChange={e => set('grVoiceId', e.target.value)}
                >
                  <option value="">Select…</option>
                  {GREEK_VOICES.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <button
                  className={styles.previewBtn}
                  disabled={!form.grVoiceId || previewing !== null}
                  onClick={() => previewVoice('gr')}
                  aria-label="Preview Greek voice"
                >
                  {previewing === 'gr' ? (
                    <span className={styles.previewSpinner} />
                  ) : (
                    <svg width="10" height="12" viewBox="0 0 12 14" fill="var(--accent)"><polygon points="1 1 11 7 1 13" /></svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Greek text display */}
        <div className={styles.group}>
          <div className="label" style={{ marginBottom: 8 }}>Greek text</div>
          <div className={`card ${styles.card}`}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Phonetic (Latin) subtitles</span>
              <label className="switch">
                <input type="checkbox" checked={form.showPhonetics ?? true} onChange={e => set('showPhonetics', e.target.checked)} />
                <div className="switch-track" />
              </label>
            </div>
          </div>
        </div>

        {/* Playback defaults */}
        <div className={styles.group}>
          <div className="label" style={{ marginBottom: 8 }}>Playback defaults</div>
          <div className={`card ${styles.card}`}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>Order</span>
              <select className={styles.select} value={form.order} onChange={e => set('order', e.target.value as PlaybackOrder)}>
                <option value="en">English only</option>
                <option value="gr">Greek only</option>
                <option value="en-gr">EN → GR</option>
                <option value="gr-en">GR → EN</option>
              </select>
            </div>
            <div className="hairline" />
            <div className={styles.row}>
              <span className={styles.rowLabel}>Gap between sentences</span>
              <div className={styles.stepperSmall}>
                <button onClick={() => set('gapSeconds', Math.max(0, form.gapSeconds - 1))}>−</button>
                <span>{form.gapSeconds}s</span>
                <button onClick={() => set('gapSeconds', Math.min(10, form.gapSeconds + 1))}>+</button>
              </div>
            </div>
            <div className="hairline" />
            <div className={styles.row}>
              <span className={styles.rowLabel}>Greek speed</span>
              <div className="segmented">
                {([0.7, 0.85, 1.0] as GreekSpeed[]).map(s => (
                  <button key={s} className={form.greekSpeed === s ? 'active' : ''} onClick={() => set('greekSpeed', s)}>
                    {s === 1.0 ? '1×' : `${s}×`}
                  </button>
                ))}
              </div>
            </div>
            <div className="hairline" />
            <div className={styles.row}>
              <span className={styles.rowLabel}>Repeat each sentence</span>
              <div className="segmented">
                {[1, 2, 3, 0].map(n => (
                  <button key={n} className={(form.sentenceRepeat ?? 1) === n ? 'active' : ''} onClick={() => set('sentenceRepeat', n)}>
                    {n === 0 ? '∞' : `${n}×`}
                  </button>
                ))}
              </div>
            </div>
            <div className="hairline" />
            <div className={styles.row}>
              <span className={styles.rowLabel}>Player look</span>
              <select className={styles.select} value={form.defaultPlayerView} onChange={e => set('defaultPlayerView', e.target.value as PlayerView)}>
                <option value="compact">Compact bar</option>
                <option value="immersive">Immersive</option>
              </select>
            </div>
            <div className="hairline" />
            <div className={styles.row}>
              <span className={styles.rowLabel}>Auto-translate on save</span>
              <label className="switch">
                <input type="checkbox" checked={form.autoTranslate ?? true} onChange={e => set('autoTranslate', e.target.checked)} />
                <div className="switch-track" />
              </label>
            </div>
            <div className="hairline" />
            <div className={styles.row}>
              <span className={styles.rowLabel}>Auto-narrate on save</span>
              <label className="switch">
                <input type="checkbox" checked={form.autoNarrate ?? true} onChange={e => set('autoNarrate', e.target.checked)} />
                <div className="switch-track" />
              </label>
            </div>
          </div>
        </div>

        <button className="btn-accent" onClick={handleSave}>
          {saved ? 'Saved ✓' : 'Save settings'}
        </button>

        <button
          className="btn-outline"
          style={{ marginTop: 12, color: 'var(--destructive)', borderColor: 'var(--destructive)' }}
          onClick={() => { if (confirm('Sign out of this device? You’ll need your password to get back in.')) signOutUser() }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
