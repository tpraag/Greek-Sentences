import { useState, useEffect } from 'react'
import { useApp } from '../store'
import type { Settings as SettingsType, PlaybackOrder, PlayerView, GreekSpeed, SavedVoice } from '../types'
import styles from './Settings.module.css'

export default function Settings() {
  const { state, saveSettings } = useApp()
  const [form, setForm] = useState<SettingsType>(state.settings)
  const [saved, setSaved] = useState(false)
  const [newVoiceId, setNewVoiceId] = useState('')
  const [newVoiceName, setNewVoiceName] = useState('')

  useEffect(() => { setForm(state.settings) }, [state.settings])

  function set<K extends keyof SettingsType>(k: K, v: SettingsType[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function addVoice() {
    if (!newVoiceId.trim() || !newVoiceName.trim()) return
    const voice: SavedVoice = { id: newVoiceId.trim(), name: newVoiceName.trim() }
    set('savedVoices', [...(form.savedVoices ?? []), voice])
    setNewVoiceId('')
    setNewVoiceName('')
  }

  function removeVoice(id: string) {
    const updated = (form.savedVoices ?? []).filter(v => v.id !== id)
    set('savedVoices', updated)
    if (form.enVoiceId === id) set('enVoiceId', '')
    if (form.grVoiceId === id) set('grVoiceId', '')
  }

  async function handleSave() {
    await saveSettings(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const voices = form.savedVoices ?? []

  return (
    <div className="screen-scroll">
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </div>

      <div className={styles.body}>

        {/* Saved voices manager */}
        <div className={styles.group}>
          <div className="label" style={{ marginBottom: 8 }}>My Voices</div>
          <div className={`card ${styles.card}`}>
            {voices.length === 0 && (
              <p className={styles.emptyVoices}>No voices saved yet. Add a voice ID from ElevenLabs below.</p>
            )}
            {voices.map(v => (
              <div key={v.id}>
                <div className={styles.voiceRow}>
                  <div className={styles.voiceInfo}>
                    <span className={styles.voiceName}>{v.name}</span>
                    <span className={styles.voiceId}>{v.id}</span>
                  </div>
                  <button className={styles.removeBtn} onClick={() => removeVoice(v.id)}>
                    Remove
                  </button>
                </div>
                <div className="hairline" />
              </div>
            ))}
            <div className={styles.addVoiceRow}>
              <input
                className={styles.voiceInput}
                placeholder="Voice ID (from ElevenLabs)"
                value={newVoiceId}
                onChange={e => setNewVoiceId(e.target.value)}
              />
              <input
                className={styles.voiceInput}
                placeholder="Nickname (e.g. Rachel)"
                value={newVoiceName}
                onChange={e => setNewVoiceName(e.target.value)}
              />
              <button
                className={styles.addVoiceBtn}
                disabled={!newVoiceId.trim() || !newVoiceName.trim()}
                onClick={addVoice}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Voice selection */}
        <div className={styles.group}>
          <div className="label" style={{ marginBottom: 8 }}>Voices</div>
          <div className={`card ${styles.card}`}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>English voice</span>
              {voices.length > 0 ? (
                <select
                  className={styles.select}
                  value={form.enVoiceId}
                  onChange={e => set('enVoiceId', e.target.value)}
                >
                  <option value="">Select…</option>
                  {voices.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              ) : (
                <span className={styles.noVoices}>Add voices above first</span>
              )}
            </div>
            <div className="hairline" />
            <div className={styles.row}>
              <span className={styles.rowLabel}>Greek voice</span>
              {voices.length > 0 ? (
                <select
                  className={styles.select}
                  value={form.grVoiceId}
                  onChange={e => set('grVoiceId', e.target.value)}
                >
                  <option value="">Select…</option>
                  {voices.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              ) : (
                <span className={styles.noVoices}>Add voices above first</span>
              )}
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
      </div>
    </div>
  )
}
