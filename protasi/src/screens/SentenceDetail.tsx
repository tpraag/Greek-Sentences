import { useState, useRef } from 'react'
import { useApp } from '../store'
import { translateWordCached, normalizeWord } from '../lib/wordCache'
import type { GreekSpeed } from '../types'
import styles from './SentenceDetail.module.css'

interface Props {
  sentenceId: string
  collectionId: string
  onBack: () => void
}

export default function SentenceDetail({ sentenceId, collectionId, onBack }: Props) {
  const { state, updateSentence, translateSentence, generateAudio, deleteSentence, startPlayback, showToast } = useApp()
  const [speed, setSpeed] = useState<GreekSpeed>(state.settings.greekSpeed)
  const [loop, setLoop] = useState(false)
  const [_playingLang, setPlayingLang] = useState<'en' | 'gr' | null>(null)
  const [wordCache, setWordCache] = useState<Record<string, string>>({})
  const [popover, setPopover] = useState<{ word: string; translation: string; loading: boolean } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [editMode, setEditMode] = useState(false)
  const [editEn, setEditEn] = useState('')
  const [editGr, setEditGr] = useState('')
  const [saving, setSaving] = useState(false)

  const sentences = state.sentences[collectionId] ?? []
  const idx = sentences.findIndex(s => s.id === sentenceId)
  const sentence = sentences[idx]
  const col = state.collections.find(c => c.id === collectionId)

  if (!sentence) return null

  const cached = !!(sentence.enAudioUrl && sentence.grAudioUrl)

  async function play(lang: 'en' | 'gr') {
    setPlayingLang(lang)
    try {
      startPlayback(collectionId, [sentenceId], {
        order: lang,
        gapSeconds: 0,
        view: 'compact',
        greekSpeed: speed,
      })
    } finally {
      setPlayingLang(null)
    }
  }

  async function handleWordTap(word: string) {
    const clean = normalizeWord(word)
    if (!clean) return
    if (wordCache[clean]) {
      setPopover({ word: clean, translation: wordCache[clean], loading: false })
      return
    }
    setPopover({ word: clean, translation: '', loading: true })
    try {
      const translation = await translateWordCached(clean)
      setWordCache(c => ({ ...c, [clean]: translation }))
      setPopover({ word: clean, translation, loading: false })
    } catch {
      setPopover({ word: clean, translation: 'Could not translate', loading: false })
    }
  }

  function openEdit() {
    setEditEn(sentence.en)
    setEditGr(sentence.gr ?? '')
    setEditMode(true)
  }

  async function handleEditSave() {
    setSaving(true)
    const enChanged = editEn.trim() !== sentence.en
    const grChanged = editGr.trim() !== (sentence.gr ?? '')
    try {
      if (enChanged) {
        const retranslate = confirm('You changed the English text. Re-translate to Greek?')
        if (retranslate) {
          await updateSentence(sentenceId, collectionId, { en: editEn.trim(), gr: null, enAudioUrl: null, grAudioUrl: null })
          await translateSentence(sentenceId, collectionId)
          // regenerate both audio after translation completes
          if (state.settings.enVoiceId) await generateAudio(sentenceId, collectionId, 'en')
          const updated = (state.sentences[collectionId] ?? []).find(s => s.id === sentenceId)
          if (updated?.gr && state.settings.grVoiceId) await generateAudio(sentenceId, collectionId, 'gr')
        } else {
          // just save the new English text, regenerate EN audio
          await updateSentence(sentenceId, collectionId, { en: editEn.trim(), enAudioUrl: null })
          if (state.settings.enVoiceId) await generateAudio(sentenceId, collectionId, 'en')
        }
      } else if (grChanged) {
        // Only Greek changed — save and regenerate GR audio
        await updateSentence(sentenceId, collectionId, { gr: editGr.trim(), grAudioUrl: null })
        if (state.settings.grVoiceId) await generateAudio(sentenceId, collectionId, 'gr')
      }
      showToast('Saved')
      setEditMode(false)
    } catch {
      showToast('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleRetranslate() {
    await updateSentence(sentenceId, collectionId, { gr: null, grAudioUrl: null })
    await translateSentence(sentenceId, collectionId)
  }

  async function handleRegenAudio() {
    await updateSentence(sentenceId, collectionId, { enAudioUrl: null, grAudioUrl: null })
    if (sentence.en) await generateAudio(sentenceId, collectionId, 'en')
    if (sentence.gr) await generateAudio(sentenceId, collectionId, 'gr')
  }

  async function handleDelete() {
    if (!confirm('Delete this sentence permanently?')) return
    await deleteSentence(sentenceId, collectionId)
    showToast('Sentence deleted')
    onBack()
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        {editMode ? (
          <>
            <button className={styles.back} onClick={() => setEditMode(false)}>Cancel</button>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Edit sentence</span>
            <button className={styles.back} onClick={handleEditSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <>
            <button className={styles.back} onClick={onBack}>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 1 1 7 7 13"/>
              </svg>
              {col?.name}
            </button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className={styles.back} onClick={openEdit} style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Edit</button>
              <button
                className={styles.favBtn}
                onClick={() => updateSentence(sentenceId, collectionId, { fav: !sentence.fav })}
              >
                <span style={{ color: sentence.fav ? 'var(--fav)' : 'var(--ink-placeholder)', fontSize: 22 }}>
                  {sentence.fav ? '★' : '☆'}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      <div className={`screen-scroll ${state.playback.active ? 'with-player' : ''}`}>
        <div className={styles.body}>
          <div className={styles.counter}>English · {idx + 1} of {sentences.length}</div>
          {editMode ? (
            <>
              <textarea
                className={styles.editTextarea}
                value={editEn}
                onChange={e => setEditEn(e.target.value)}
                rows={4}
              />
              <div className="hairline" style={{ margin: '20px 0' }} />
              <div className={styles.counter}>Ελληνικά</div>
              <textarea
                className={`${styles.editTextarea} serif`}
                value={editGr}
                onChange={e => setEditGr(e.target.value)}
                rows={4}
                placeholder="Greek translation…"
              />
            </>
          ) : (
          <>
          <p className={styles.en}>{sentence.en}</p>

          <div className="hairline" style={{ margin: '20px 0' }} />

          <div className={styles.counter}>Ελληνικά</div>
          {sentence.translating ? (
            <p className={styles.translating}>Translating…</p>
          ) : sentence.gr ? (
            <div style={{ position: 'relative' }}>
              <p className={`${styles.gr} serif`} onClick={() => setPopover(null)}>
                {sentence.gr.split(/(\s+)/).map((token, i) =>
                  /\s+/.test(token) ? token :
                  <span
                    key={i}
                    className={styles.grWord}
                    onClick={e => { e.stopPropagation(); handleWordTap(token) }}
                  >{token}</span>
                )}
              </p>
              {popover && (
                <div ref={popoverRef} className={styles.popover}>
                  <span className={styles.popoverWord}>{popover.word}</span>
                  <span className={styles.popoverArrow}>→</span>
                  <span className={styles.popoverTranslation}>
                    {popover.loading ? '…' : popover.translation}
                  </span>
                  <button className={styles.popoverClose} onClick={() => setPopover(null)}>✕</button>
                </div>
              )}
            </div>
          ) : (
            <p className={styles.notTranslated}>Not yet translated</p>
          )}

          {/* Play buttons */}
          <div className={styles.playRow}>
            <button
              className={styles.playEn}
              onClick={() => play('en')}
              disabled={!sentence.enAudioUrl && !sentence.en}
            >
              <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
                <polygon points="1 1 13 8 1 15"/>
              </svg>
              English
            </button>
            <button
              className={styles.playGr}
              onClick={() => play('gr')}
              disabled={!sentence.gr}
            >
              <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
                <polygon points="1 1 13 8 1 15"/>
              </svg>
              Ελληνικά
            </button>
          </div>

          {/* Greek speed */}
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Greek speed</span>
            <div className="segmented">
              {([0.7, 0.85, 1.0] as GreekSpeed[]).map(s => (
                <button key={s} className={speed === s ? 'active' : ''} onClick={() => setSpeed(s)}>
                  {s === 1.0 ? '1×' : `${s}×`}
                </button>
              ))}
            </div>
          </div>

          {/* Loop */}
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Loop this sentence</span>
            <label className="switch">
              <input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} />
              <div className="switch-track" />
            </label>
          </div>

          {/* Cache indicator */}
          {cached && (
            <div className={styles.cached}>
              <div className={styles.cachedDot} />
              Translation & audio cached
            </div>
          )}

          {/* Re-generate buttons */}
          <div className={styles.regenRow}>
            <button className="btn-outline" onClick={handleRetranslate}>Re-translate</button>
            <button className="btn-outline" onClick={handleRegenAudio}>Regenerate audio</button>
          </div>

          {/* Delete sentence */}
          <button className={styles.deleteBtn} onClick={handleDelete}>Delete sentence</button>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
